import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, X, Check, RotateCcw, Sparkles, ChevronRight, Loader2, ScanLine, Image as ImageIcon, Download, Shield, AlertCircle, Mic, MicOff, SkipForward, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  useCreateSession, useSession, useSessionPhotos, useUploadPhoto,
  useUpdateSession, useDeleteSessionPhoto, useSmartCaptureSettings,
} from "@/hooks/useSmartCapture";
import { SHOT_SEQUENCE, SHOT_LABEL_MAP, type ShotType } from "@/lib/smartCapture/types";
import { processImage, computeBlurScore, fileToBase64 } from "@/lib/smartCapture/imageProcessing";
import { buildSessionZip, downloadBlob, type ExportPhoto, type VehicleInfo } from "@/lib/smartCapture/export";
import { createVoiceController, parseDictation, type VoiceCommand } from "@/lib/smartCapture/voiceControl";
import { createHorizonController } from "@/lib/smartCapture/horizonLevel";

interface AnalysisResult {
  shot_type?: string;
  quality_score?: number;
  sharpness?: number;
  exposure?: number;
  composition?: number;
  issues?: string[];
  tip?: string;
  is_blurry?: boolean;
  is_overexposed?: boolean;
  is_underexposed?: boolean;
  dirty_lens?: boolean;
  obstructions?: boolean;
}

type Phase = "intro" | "capturing" | "vin" | "review";

export default function SmartCapture() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const sessionIdFromUrl = searchParams.get("session");
  const [sessionId, setSessionId] = useState<string | undefined>(sessionIdFromUrl ?? undefined);
  const createSession = useCreateSession();
  const { data: session } = useSession(sessionId);
  const { data: photos = [], refetch: refetchPhotos } = useSessionPhotos(sessionId);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeleteSessionPhoto();
  const updateSession = useUpdateSession();
  const { data: settings } = useSmartCaptureSettings();

  const [phase, setPhase] = useState<Phase>("intro");
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [queueCount, setQueueCount] = useState(0);   // ⚡ kolik fotek se zpracovává na pozadí
  const [shutterFlash, setShutterFlash] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [vinScanning, setVinScanning] = useState(false);
  const [vinValue, setVinValue] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    brand: "", model: "", year: "", vin: "", mileage: "",
    price: "", fuel: "", transmission: "", color: "", power: "",
    description: "",
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackUploadRef = useRef<HTMLInputElement>(null);

  // Voice + horizon
  const voiceEnabledSetting = useMemo(() => {
    if (!settings) return true;
    return (settings as { voice_control?: string }).voice_control !== "off";
  }, [settings]);
  const horizonEnabledSetting = useMemo(() => {
    if (!settings) return true;
    return (settings as { horizon_auto_level?: string }).horizon_auto_level !== "off";
  }, [settings]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceUnsupported, setVoiceUnsupported] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [voiceLegendOpen, setVoiceLegendOpen] = useState(false);
  const [horizonAngle, setHorizonAngle] = useState(0);
  const voiceRef = useRef<ReturnType<typeof createVoiceController> | null>(null);
  const horizonRef = useRef<ReturnType<typeof createHorizonController> | null>(null);

  // Admin gate
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/admin"); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user, authLoading, navigate]);

  // Attach stream to video as soon as element + stream are ready. NEVER await play()
  // — on iOS Safari it can hang indefinitely, causing the "stuck loader" bug.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    try {
      v.srcObject = stream;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => { /* ignore autoplay reject */ });
    } catch { /* ignore */ }
  }, [stream, phase]);

  const stopCamera = useCallback(() => {
    setStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
  }, []);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  // Gesture-safe camera request — must be the FIRST await after the user click
  // on iOS Safari, otherwise the permission prompt is silently dropped.
  const requestCamera = useCallback(async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Tento prohlížeč nepodporuje přístup ke kameře.");
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError")
        throw new Error("Přístup ke kameře byl zamítnut. Povolte kameru v nastavení prohlížeče.");
      if (name === "NotFoundError" || name === "OverconstrainedError")
        throw new Error("Nebyla nalezena žádná kamera.");
      if (name === "NotReadableError")
        throw new Error("Kamera je obsazena jinou aplikací.");
      throw new Error("Nepodařilo se aktivovat kameru.");
    }
  }, []);

  // Start: switch UI immediately, create session in background, request camera
  // as the FIRST await (gesture-preserving on iOS).
  const handleStart = async () => {
    setCameraError(null);
    setPhase("capturing");
    if (!sessionId) {
      createSession.mutateAsync()
        .then((sess) => { setSessionId(sess.id); setSearchParams({ session: sess.id }); })
        .catch((e) => toast({ title: "Relace se nevytvořila", description: String(e), variant: "destructive" }));
    }
    try {
      const s = await requestCamera();
      setStream(s);
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Kamera nedostupná");
    }
  };

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try { setStream(await requestCamera()); }
    catch (e) { setCameraError(e instanceof Error ? e.message : "Kamera nedostupná"); }
  }, [requestCamera]);

  const currentStep = SHOT_SEQUENCE[currentStepIdx];
  const totalSteps = SHOT_SEQUENCE.length;

  const aiEnabled = useMemo(() => {
    if (!settings) return true;
    if ((settings as { safe_mode?: boolean }).safe_mode) return false;
    return (settings as { ai_quality_check?: string }).ai_quality_check !== "off";
  }, [settings]);

  // Capture from video
  const captureFromVideo = async (): Promise<Blob | null> => {
    if (!videoRef.current || !stream) return null;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    return await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), "image/jpeg", 0.92));
  };

  const handleFilePicked = async (file: File) => {
    if (!sessionId) return;
    await processAndUpload(file);
  };

  const handleShot = async () => {
    if (!sessionId || busy) return;
    // ⚡ Mikro-blok jen na zachycení snímku z videa (~20 ms),
    //    pak ihned advance + processing/upload na pozadí.
    const blob = await captureFromVideo();
    if (!blob) { toast({ title: "Nelze pořídit snímek", variant: "destructive" }); return; }
    // ⚡ Okamžitě posuň krok — uživatel může fotit dál, nečeká na upload
    const stepAtShot = currentStepIdx;
    if (currentStepIdx < totalSteps - 1) setCurrentStepIdx((i) => i + 1);
    // shutter feedback
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 120);
    void processAndUpload(blob, stepAtShot);
  };

  const processAndUpload = async (input: Blob | File, stepIdx?: number) => {
    if (!sessionId) return;
    setQueueCount((n) => n + 1);
    setLastAnalysis(null);
    try {
      const autoProcess = !settings || (settings as { auto_image_processing?: string }).auto_image_processing !== "off";

      // ⚡ Paralelně: processing + blur score (oba potřebují bitmap, sdílejí cache prohlížeče)
      const processedPromise = autoProcess
        ? processImage(input)
        : Promise.resolve({ blob: input as Blob, width: 0, height: 0 });

      const { blob: processed, width, height } = await processedPromise;

      // ⚡ Blur score paralelně s případnou AI analýzou + uploadem
      const blurPromise = computeBlurScore(processed).catch(() => 50);

      // AI analyze — non-blocking pro UI; pokud je vypnuto, přeskoč úplně
      let aiPromise: Promise<AnalysisResult> = Promise.resolve({});
      if (aiEnabled) {
        aiPromise = (async () => {
          try {
            const b64 = await fileToBase64(processed);
            const { data, error } = await supabase.functions.invoke("smart-capture-analyze", {
              body: { imageBase64: b64 },
            });
            return !error && data ? (data as AnalysisResult) : {};
          } catch { return {}; }
        })();
      }

      const [blurScore, ai] = await Promise.all([blurPromise, aiPromise]);
      setLastAnalysis(ai);

      const fallbackType = SHOT_SEQUENCE[stepIdx ?? currentStepIdx]?.type ?? "unknown";
      const detectedType = (ai.shot_type as ShotType) || fallbackType;
      const score = ai.quality_score ?? Math.round((blurScore + 60) / 2);
      const isMain = detectedType === "predni-pravy-roh" && !photos.some((p) => (p as { is_main: boolean }).is_main);

      await uploadPhoto.mutateAsync({
        sessionId,
        shotType: detectedType,
        shotIndex: photos.length,
        originalBlob: input,
        processedBlob: processed,
        width, height,
        quality: { blur: blurScore, ai },
        qualityScore: score,
        aiClassification: ai as Record<string, unknown>,
        isMain,
      });
    } catch (e) {
      toast({ title: "Nahrání selhalo", description: String(e), variant: "destructive" });
    } finally {
      setQueueCount((n) => Math.max(0, n - 1));
    }
  };

  // VIN scan
  const handleVinScan = async (file?: File) => {
    if (!sessionId) return;
    let blob: Blob | null = file ?? null;
    if (!blob) blob = await captureFromVideo();
    if (!blob) return;
    setVinScanning(true);
    try {
      const b64 = await fileToBase64(blob);
      const { data } = await supabase.functions.invoke("smart-capture-vin-ocr", { body: { imageBase64: b64 } });
      const vin = (data as { vin?: string })?.vin ?? "";
      if (vin && vin.length >= 11) {
        setVinValue(vin);
        toast({ title: "VIN rozpoznán", description: vin });
        // VIN decode
        const { data: dec } = await supabase.functions.invoke("vin-decode", { body: { vin } });
        await updateSession.mutateAsync({
          id: sessionId,
          updates: { vin, decoded_data: (dec as Record<string, unknown>)?.decoded ?? {} },
        });
      } else {
        toast({ title: "VIN nečitelný", description: "Zkuste přiblížit nebo zadat ručně." });
      }
    } catch (e) {
      toast({ title: "OCR selhal", description: String(e), variant: "destructive" });
    } finally { setVinScanning(false); }
  };

  const finishToReview = async () => {
    stopCamera();
    if (sessionId) {
      const avgScore = photos.length
        ? Math.round(photos.reduce((s, p) => s + ((p as { quality_score: number }).quality_score || 0), 0) / photos.length)
        : 0;
      const has360 = photos.filter((p) => {
        const t = (p as { shot_type: string }).shot_type;
        return t.includes("roh") || t.includes("bok") || t.includes("cast");
      }).length >= 6;
      await updateSession.mutateAsync({
        id: sessionId,
        updates: { quality_score: avgScore, has_360: has360, status: "review" },
      });
    }
    setPhase("review");
  };

  // ===== Voice control =====
  const handleVoiceCommand = useCallback((cmd: VoiceCommand) => {
    if (phase !== "capturing") {
      if (cmd === "done" && phase === "vin") finishToReview();
      return;
    }
    switch (cmd) {
      case "shot": void handleShot(); break;
      case "next": setCurrentStepIdx((i) => Math.min(totalSteps - 1, i + 1)); break;
      case "prev": setCurrentStepIdx((i) => Math.max(0, i - 1)); break;
      case "retake": {
        const last = photos[photos.length - 1] as { id: string } | undefined;
        if (last && sessionId) {
          deletePhoto.mutate({ id: last.id, sessionId });
          setCurrentStepIdx((i) => Math.max(0, i - 1));
        }
        break;
      }
      case "vin": setPhase("vin"); break;
      case "done": finishToReview(); break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, photos, sessionId, totalSteps]);

  // Init voice controller once
  useEffect(() => {
    if (voiceRef.current) return;
    const v = createVoiceController();
    voiceRef.current = v;
    if (!v.isSupported) setVoiceUnsupported(true);
  }, []);

  // Always feed latest handler into voice controller
  useEffect(() => {
    voiceRef.current?.setHandler((cmd) => handleVoiceCommand(cmd));
  }, [handleVoiceCommand]);

  // Auto-start voice when capturing & enabled; stop on unmount/leave
  useEffect(() => {
    const v = voiceRef.current;
    if (!v || !v.isSupported) return;
    if (phase === "capturing" && voiceEnabledSetting) {
      v.start(); setVoiceActive(true);
    } else if (!dictating) {
      v.stop(); setVoiceActive(false);
    }
    return () => { if (phase !== "capturing" && !dictating) v.stop(); };
  }, [phase, voiceEnabledSetting, dictating]);

  // ===== Horizon (gyroscope) =====
  useEffect(() => {
    if (!horizonEnabledSetting || phase !== "capturing") {
      horizonRef.current?.stop(); horizonRef.current = null;
      setHorizonAngle(0);
      return;
    }
    const h = createHorizonController(setHorizonAngle);
    horizonRef.current = h;
    void h.start();
    return () => { h.stop(); horizonRef.current = null; };
  }, [horizonEnabledSetting, phase]);



  // Prefill vehicle info from VIN-decoded data + saved session metadata
  useEffect(() => {
    if (!session) return;
    const decoded = ((session as { decoded_data?: Record<string, unknown> }).decoded_data ?? {}) as Record<string, unknown>;
    const meta = ((session as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>;
    const savedInfo = (meta.vehicle_info ?? {}) as Partial<VehicleInfo>;
    setVehicleInfo((cur) => {
      const next: VehicleInfo = { ...cur, ...savedInfo };
      if (!next.brand && decoded.make) next.brand = String(decoded.make);
      if (!next.model && decoded.model) next.model = String(decoded.model);
      if (!next.year && decoded.year) next.year = String(decoded.year);
      if (!next.vin && (session as { vin?: string }).vin) next.vin = (session as { vin?: string }).vin ?? "";
      if (!next.fuel && decoded.fuel) next.fuel = String(decoded.fuel);
      if (!next.transmission && decoded.transmission) next.transmission = String(decoded.transmission);
      if (!next.color && decoded.color) next.color = String(decoded.color);
      if (!next.power && decoded.power) next.power = String(decoded.power);
      return next;
    });
  }, [session]);

  const requiredInfoFilled = useMemo(() => {
    const req: (keyof VehicleInfo)[] = ["brand", "model", "year", "mileage", "price", "description"];
    return req.every((k) => String(vehicleInfo[k] ?? "").trim().length > 0);
  }, [vehicleInfo]);

  const updateInfoField = (k: keyof VehicleInfo, v: string) => {
    setVehicleInfo((s) => ({ ...s, [k]: v }));
  };

  const handleExportZip = async () => {
    if (!sessionId) return;
    if (!requiredInfoFilled) {
      toast({
        title: "Vyplňte informace o voze",
        description: "Před exportem musí být vyplněna značka, model, rok, najezd, cena a popis.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      // Persist info into session metadata so příště je předvyplněno
      await updateSession.mutateAsync({
        id: sessionId,
        updates: { metadata: { ...(session as { metadata?: Record<string, unknown> })?.metadata, vehicle_info: vehicleInfo } },
      });

      const items: ExportPhoto[] = photos.map((p, i) => {
        const row = p as { shot_type: ShotType; original_url: string; processed_url: string };
        return {
          shotType: row.shot_type, index: i,
          originalUrl: row.original_url, processedUrl: row.processed_url,
        };
      });
      const zip = await buildSessionZip(items, vehicleInfo);
      const safe = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "");
      downloadBlob(zip, `${safe(vehicleInfo.brand)}-${safe(vehicleInfo.model)}-${new Date().toISOString().slice(0, 10)}.zip`);
      toast({ title: "Export hotov", description: "ZIP obsahuje original, inzertní (1MB), web + info.txt." });
    } catch (e) {
      toast({ title: "Export selhal", description: String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  // === RENDER ===

  if (authLoading || isAdmin === null) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <Loader2 className="animate-spin" />
    </div>;
  }
  if (!isAdmin) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">
      Přístup pouze pro administrátory.
    </div>;
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 text-white z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0 backdrop-blur-xl bg-black/40">
        <button onClick={() => { stopCamera(); navigate("/admin"); }}
          className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Sparkles size={12} />
          </div>
          Smart Capture
          {photos.length > 0 && <span className="text-white/50 tabular-nums">· {photos.length}</span>}
          {queueCount > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded-full">
              <Loader2 size={10} className="animate-spin" /> {queueCount}
            </span>
          )}
        </div>
        <button onClick={() => {
            if (phase === "review") { stopCamera(); navigate("/admin"); }
            else { finishToReview(); }
          }}
          disabled={phase !== "review" && photos.length === 0}
          className="text-sm px-4 py-1.5 rounded-full bg-white text-black font-medium disabled:opacity-30 hover:bg-white/90 transition">
          {phase === "review" ? "Zavřít" : "Hotovo"}
        </button>
      </header>

      {/* Intro */}
      {phase === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6">
            <Camera size={36} />
          </div>
          <h1 className="text-3xl font-light mb-3">Připraveni na focení</h1>
          <p className="text-white/70 max-w-sm mb-2">
            Inteligentní průvodce vás povede ideálním pořadím záběrů. Můžete kdykoliv pokračovat svým způsobem.
          </p>
          <p className="text-white/40 text-sm mb-6 flex items-center gap-2">
            <Shield size={14} /> Existující inzeráty zůstanou nedotčené.
          </p>

          {/* Voice / Horizon legenda */}
          {(voiceEnabledSetting || horizonEnabledSetting) && (
            <div className="max-w-sm w-full mb-6 rounded-2xl bg-white/5 border border-white/10 p-4 text-left text-sm">
              {voiceEnabledSetting && (
                <>
                  <div className="flex items-center gap-2 font-medium mb-2">
                    <Mic size={14} className="text-emerald-400" /> Hlasové ovládání
                    {voiceUnsupported && <span className="text-[10px] text-amber-300 ml-auto">prohlížeč nepodporuje</span>}
                  </div>
                  <ul className="text-white/70 text-xs space-y-1 mb-3">
                    <li>„<b>vyfotit</b>" / „<b>foť</b>" — pořídí snímek</li>
                    <li>„<b>další</b>" — přejde na další krok</li>
                    <li>„<b>zpět</b>" — vrátí se o krok zpět</li>
                    <li>„<b>přefotit</b>" — smaže poslední foto a opakuje</li>
                    <li>„<b>VIN</b>" — přepne na VIN scan</li>
                    <li>„<b>hotovo</b>" — ukončí focení</li>
                  </ul>
                  <p className="text-[10px] text-white/40 mb-3">Po startu poslouchá na pozadí. Lze vypnout v nastavení Smart Capture.</p>
                </>
              )}
              {horizonEnabledSetting && (
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <Compass size={14} className="text-blue-400" />
                  Auto-rovnání horizontu (gyroskop) je aktivní.
                </div>
              )}
            </div>
          )}

          <Button size="lg" onClick={handleStart} disabled={busy}
            className="bg-white text-black hover:bg-white/90 px-10 py-6 text-lg rounded-full">
            {busy ? <Loader2 className="animate-spin" /> : <><Camera className="mr-2" size={20} />Spustit Smart Capture</>}
          </Button>
        </div>
      )}

      {/* Capturing */}
      {phase === "capturing" && (
        <>
          {/* Camera preview */}
          <div className="relative flex-1 bg-black overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover transition-transform duration-100"
              style={horizonEnabledSetting ? { transform: `scale(1.08) rotate(${-horizonAngle}deg)` } : undefined}
              playsInline muted autoPlay
            />

            {/* Voice + horizon status badges */}
            {(voiceEnabledSetting || horizonEnabledSetting) && stream && !cameraError && (
              <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 z-10">
                {voiceEnabledSetting && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-medium ring-1 ${
                    voiceActive ? "bg-emerald-500/20 ring-emerald-400/40 text-emerald-200" : "bg-white/10 ring-white/15 text-white/60"
                  }`}>
                    {voiceActive ? <Mic size={11} /> : <MicOff size={11} />} hlas
                  </div>
                )}
                {horizonEnabledSetting && Math.abs(horizonAngle) > 0.5 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 ring-1 ring-blue-400/40 backdrop-blur-md text-[10px] text-blue-200 tabular-nums">
                    <Compass size={11} /> {horizonAngle > 0 ? "+" : ""}{horizonAngle.toFixed(0)}°
                  </div>
                )}
              </div>
            )}

            {/* Horizon level guide */}
            {horizonEnabledSetting && stream && !cameraError && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
                <div className="w-32 h-px bg-white/40" style={{ transform: `rotate(${-horizonAngle}deg)` }} />
                <div className="absolute w-2 h-2 rounded-full bg-white/60" />
              </div>
            )}

            {/* Waiting-for-camera placeholder (only when no error, no stream) */}
            {!stream && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                <Loader2 className="animate-spin" size={28} />
                <div className="text-xs">Aktivuji kameru…</div>
                <div className="text-[11px] text-white/40">Pokud se objeví dotaz, povolte přístup ke kameře.</div>
              </div>
            )}

            {/* Camera error fallback */}
            {cameraError && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                  <AlertCircle className="text-red-400" size={26} />
                </div>
                <h3 className="text-lg font-medium mb-1">Nepodařilo se aktivovat kameru</h3>
                <p className="text-sm text-white/60 max-w-xs mb-5">{cameraError}</p>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <Button onClick={startCamera} className="bg-white text-black hover:bg-white/90">
                    <RotateCcw size={16} className="mr-2" /> Zkusit znovu
                  </Button>
                  <Button variant="outline" onClick={() => fallbackUploadRef.current?.click()}
                    className="border-white/20 bg-transparent">
                    <ImageIcon size={16} className="mr-2" /> Nahrát fotografie ručně
                  </Button>
                  <input ref={fallbackUploadRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      for (const f of files) await handleFilePicked(f);
                    }} />
                </div>
              </div>
            )}

            {/* Guidance overlay — glassmorphism */}
            {currentStep && stream && !cameraError && (
              <div className="absolute top-4 left-4 right-4 flex items-start gap-3 bg-gradient-to-br from-black/70 to-black/40 backdrop-blur-xl ring-1 ring-white/10 rounded-2xl p-3 shadow-2xl">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-lg shadow-blue-500/40 tabular-nums">
                  {currentStepIdx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold tracking-tight">{currentStep.label}</div>
                  <div className="text-xs text-white/70 mt-0.5 leading-relaxed">{currentStep.hint}</div>
                </div>
                <div className="text-[10px] text-white/40 tabular-nums shrink-0 mt-0.5">
                  {currentStepIdx + 1}/{totalSteps}
                </div>
              </div>
            )}

            {/* Last analysis tip */}
            {lastAnalysis?.tip && stream && (
              <div className="absolute bottom-32 left-4 right-4 bg-gradient-to-r from-emerald-400 to-emerald-500 text-black rounded-xl px-3 py-2 text-sm flex items-center gap-2 shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-300">
                <Sparkles size={14} /> {lastAnalysis.tip}
              </div>
            )}

            {/* ⚡ Shutter flash — vizuální feedback místo blokujícího spinneru */}
            {shutterFlash && (
              <div className="absolute inset-0 bg-white pointer-events-none animate-in fade-in duration-75" style={{ animationDirection: "alternate" }} />
            )}
          </div>

          {/* Bottom controls */}
          <div className="shrink-0 bg-gradient-to-t from-black via-black to-black/80 border-t border-white/5 px-4 py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur flex items-center justify-center transition-colors"
                title="Z galerie">
                <ImageIcon size={20} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); e.target.value = ""; }} />

              {/* ⚡ Shutter: vždy aktivní (neblokuje), jen vizuálně pulsuje při flash */}
              <button onClick={handleShot} disabled={!stream}
                className="relative w-20 h-20 rounded-full bg-white border-4 border-white/30 active:scale-90 transition-transform disabled:opacity-40 shadow-[0_0_40px_rgba(255,255,255,0.25)]">
                <span className="absolute inset-2 rounded-full bg-white ring-2 ring-black/10" />
              </button>

              <button
                onClick={() => { setPhase("vin"); }}
                className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur flex items-center justify-center transition-colors"
                title="VIN scan">
                <ScanLine size={20} />
              </button>
            </div>

            {/* Step navigation */}
            <div className="flex items-center justify-between text-xs">
              <button onClick={() => setCurrentStepIdx((i) => Math.max(0, i - 1))}
                className="text-white/60 px-2 py-1" disabled={currentStepIdx === 0}>← Předchozí</button>
              <div className="text-white/40">{currentStepIdx + 1} / {totalSteps}</div>
              <button onClick={() => setCurrentStepIdx((i) => Math.min(totalSteps - 1, i + 1))}
                className="text-white/60 px-2 py-1">Přeskočit →</button>
            </div>
            <Progress value={((currentStepIdx + 1) / totalSteps) * 100} className="h-1 mt-2 bg-white/10" />

            {/* Thumbnails strip */}
            {photos.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {photos.map((p) => {
                  const row = p as { id: string; processed_url: string; shot_type: string; quality_score: number };
                  return (
                    <div key={row.id} className="relative shrink-0">
                      <img src={row.processed_url} alt={row.shot_type}
                        className="w-14 h-14 rounded-lg object-cover" />
                      <span className="absolute -top-1 -right-1 text-[9px] bg-black/80 rounded-full px-1.5 py-0.5">
                        {row.quality_score}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* VIN phase */}
      {phase === "vin" && (
        <div className="flex-1 flex flex-col p-6">
          <h2 className="text-2xl font-light mb-2">Naskenujte VIN</h2>
          <p className="text-white/60 text-sm mb-6">Štítek bývá ve dveřích řidiče, pod kapotou nebo na čelním skle.</p>

          <div className="relative aspect-video bg-white/5 rounded-2xl overflow-hidden mb-4 flex items-center justify-center">
            {stream ? <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              : <div className="text-white/40 text-sm">Kamera neaktivní — použijte galerii</div>}
            {vinScanning && <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="animate-spin" />
            </div>}
          </div>

          <div className="flex gap-2 mb-4">
            <Button onClick={() => handleVinScan()} disabled={vinScanning || !stream} className="flex-1 bg-white text-black">
              <ScanLine className="mr-2" size={16} /> Scan VIN
            </Button>
            <label className="flex-1">
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVinScan(f); }} />
              <span className="flex items-center justify-center w-full h-10 rounded-md bg-white/10 cursor-pointer text-sm">
                <ImageIcon className="mr-2" size={16} /> Z galerie
              </span>
            </label>
          </div>

          <input
            type="text"
            placeholder="…nebo zadejte VIN ručně"
            value={vinValue}
            onChange={(e) => setVinValue(e.target.value.toUpperCase())}
            className="w-full bg-white/10 rounded-lg px-3 py-3 mb-3 font-mono tracking-wider"
            maxLength={17}
          />

          {(session as { decoded_data?: { name?: string } })?.decoded_data?.name && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mb-4 text-sm">
              <div className="flex items-center gap-2 text-emerald-300 mb-1">
                <Check size={14} /> Vozidlo identifikováno
              </div>
              <div className="text-white/80">{String((session as unknown as { decoded_data?: { name?: string } })?.decoded_data?.name ?? "")}</div>
            </div>
          )}

          <div className="mt-auto flex gap-2">
            <Button variant="outline" onClick={() => setPhase("capturing")} className="flex-1 border-white/20 bg-transparent">
              Zpět k focení
            </Button>
            <Button onClick={async () => {
              if (vinValue && vinValue !== (session as { vin?: string })?.vin) {
                await updateSession.mutateAsync({ id: sessionId!, updates: { vin: vinValue } });
              }
              finishToReview();
            }} className="flex-1 bg-white text-black">
              Dokončit <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Review */}
      {phase === "review" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <Check size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-light mb-1">Galerie připravena</h2>
            <p className="text-white/60 text-sm">📸 {photos.length} fotografií · 📊 Kvalita {(session as { quality_score?: number })?.quality_score ?? 0} %
              {(session as { has_360?: boolean })?.has_360 && " · 🔄 360° připraveno"}
            </p>
          </div>

          {/* Gallery */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {photos.map((p) => {
              const row = p as { id: string; processed_url: string; shot_type: string; quality_score: number };
              return (
                <div key={row.id} className="relative aspect-square rounded-lg overflow-hidden group bg-white/5">
                  <img src={row.processed_url} alt={row.shot_type} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-1.5">
                    <span className="text-[10px] truncate">{SHOT_LABEL_MAP[row.shot_type as ShotType] ?? row.shot_type}</span>
                  </div>
                  <button onClick={() => sessionId && deletePhoto.mutate({ id: row.id, sessionId })}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100">
                    <X size={12} />
                  </button>
                  <span className="absolute top-1 left-1 bg-black/70 text-[9px] px-1.5 py-0.5 rounded">
                    {row.quality_score}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Informace o voze — povinné pro export */}
          <div className="max-w-md mx-auto mb-4 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Informace o voze</h3>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${requiredInfoFilled ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                {requiredInfoFilled ? "Vyplněno" : "Povinné pro export"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["brand", "Značka *"], ["model", "Model *"],
                ["year", "Rok *"], ["mileage", "Najezd (km) *"],
                ["price", "Cena (Kč) *"], ["vin", "VIN"],
                ["fuel", "Palivo"], ["transmission", "Převodovka"],
                ["color", "Barva"], ["power", "Výkon"],
              ] as [keyof VehicleInfo, string][]).map(([k, label]) => (
                <input
                  key={k}
                  placeholder={label}
                  value={String(vehicleInfo[k] ?? "")}
                  onChange={(e) => updateInfoField(k, e.target.value)}
                  className="bg-white/10 rounded-md px-2.5 py-2 text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/30"
                />
              ))}
            </div>
            <textarea
              placeholder="Popis vozu * (bude vložen do info.txt v ZIP)"
              value={vehicleInfo.description ?? ""}
              onChange={(e) => updateInfoField("description", e.target.value)}
              rows={4}
              className="w-full mt-2 bg-white/10 rounded-md px-2.5 py-2 text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/30 resize-none"
            />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <Button onClick={handleExportZip} disabled={busy || photos.length === 0 || !requiredInfoFilled}
              className="w-full bg-white text-black hover:bg-white/90 disabled:bg-white/30 disabled:text-white/60">
              {busy ? <Loader2 className="animate-spin mr-2" size={16} /> : <Download className="mr-2" size={16} />}
              {requiredInfoFilled
                ? "Exportovat ZIP (original + inzertní 1MB + web + info.txt)"
                : "Vyplňte povinné údaje o voze"}
            </Button>
            <Button variant="outline" onClick={async () => {
              await startCamera(); setPhase("capturing");
            }} className="w-full border-white/20 bg-transparent">
              <Camera className="mr-2" size={16} /> Pokračovat ve focení
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin")}
              className="w-full border-white/20 bg-transparent">
              Zavřít
            </Button>
          </div>

          {(session as { has_360?: boolean })?.has_360 === false && (
            <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm">
              <div className="flex items-center gap-2 text-blue-300 mb-1">
                <AlertCircle size={14} /> 360° zatím není kompletní
              </div>
              <div className="text-white/70 text-xs leading-relaxed">
                Pro 360° doporučujeme: více úhlů kolem vozidla, podobnou vzdálenost a výšku telefonu, doplnit chybějící boky.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
