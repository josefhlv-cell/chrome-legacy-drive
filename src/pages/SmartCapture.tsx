import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, X, Check, RotateCcw, Sparkles, ChevronRight, Loader2, ScanLine, Image as ImageIcon, Download, Shield, AlertCircle, Mic, MicOff, SkipForward, Compass, SwitchCamera, ChevronLeft } from "lucide-react";
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
import { CAPTURE_BG_URL, THUMB_PLACEMENT, composeThumbnail, frameToThumbnail } from "@/lib/smartCapture/thumbnail";
import { guideForShot } from "@/lib/smartCapture/dealerGuide";
import { openCamera, findWidestRearCamera, resetCameraCache } from "@/lib/smartCapture/camera";



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
  /** Právě pořízený snímek — čeká na „Použít fotografii“ / „Vyfotit znovu“.
   *  Kamera přitom BĚŽÍ dál (žádná reinicializace MediaStreamu). */
  const [pending, setPending] = useState<{ blob: Blob; url: string; stepIdx: number } | null>(null);
  /** Skutečný poměr stran streamu — zjištěn z videoWidth/videoHeight, ne z CSS. */
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
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
  const facingRef = useRef<"environment" | "user">("environment");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [switching, setSwitching] = useState(false);
  const shootingRef = useRef(false);
  const shotIndexRef = useRef(0);

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
  const landscapeEnabled = useMemo(() => {
    if (!settings) return true;
    return (settings as { landscape_capture?: string }).landscape_capture !== "off";
  }, [settings]);
  const gridEnabled = useMemo(() => {
    if (!settings) return true;
    return (settings as { grid_overlay?: string }).grid_overlay !== "off";
  }, [settings]);
  /**
   * Miniatura na přednastaveném pozadí (vypínatelné v nastavení Smart Capture).
   * "off"     = úplně vypnuto
   * "suggest" = pozadí se jen zobrazí v hledáčku jako vodítko (nic se neskládá)
   * "on"      = navíc se z prvního záběru automaticky složí miniatura
   */
  const thumbBgMode = useMemo(() => {
    return ((settings as { thumbnail_background?: string })?.thumbnail_background ?? "off") as "on" | "suggest" | "off";
  }, [settings]);
  const thumbOverlayEnabled = thumbBgMode !== "off";
  const thumbComposeEnabled = thumbBgMode === "on";
  /** Dealer Mode — jednotné měřítko a kompozice u všech vozidel (default OFF). */
  const dealerMode = useMemo(() => !!(settings as { dealer_mode?: boolean })?.dealer_mode, [settings]);

  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbOverlayOn, setThumbOverlayOn] = useState(true);

  /** Skutečné rozměry viewportu (ne CSS odhad) — přepočítají se i po otočení. */
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 0,
    h: typeof window !== "undefined" ? window.innerHeight : 0,
  }));
  const isLandscape = viewport.w > viewport.h;
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    const so = (window.screen as unknown as { orientation?: EventTarget })?.orientation;
    so?.addEventListener?.("change", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      so?.removeEventListener?.("change", onResize);
    };
  }, []);
  const landscapeMode = isLandscape && landscapeEnabled;

  /**
   * Viditelná plocha obrazu: stream se vždy vejde CELÝ (object-contain), takže
   * nikdy nevzniká digitální zoom ani nechtěný ořez. Overlaye (Dealer rámeček,
   * mřížka) se kotví přesně na tuto plochu, ne na celý displej.
   */
  const frameBox = useMemo(() => {
    const vw = viewport.w || 1, vh = viewport.h || 1;
    const ar = videoAspect ?? vw / vh;
    const fitH = vw / ar <= vh;
    const w = fitH ? vw : vh * ar;
    const h = fitH ? vw / ar : vh;
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }, [viewport, videoAspect]);

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
  // Nejširší zadní objektiv, plný senzor (4:3), zoom 1× — bez digitálního přiblížení.
  const wideDeviceRef = useRef<string | null>(null);
  const requestCamera = useCallback(async (mode: "environment" | "user" = facingRef.current): Promise<MediaStream> => {
    const stream = await openCamera(mode, mode === "environment" ? wideDeviceRef.current : null);
    // Labely objektivů jsou dostupné až po přidělení oprávnění → doplň cache pro další start.
    if (mode === "environment" && !wideDeviceRef.current) {
      resetCameraCache();
      void findWidestRearCamera().then((id) => { wideDeviceRef.current = id; });
    }
    return stream;
  }, []);

  // ⚡ Předehřátí: seznam objektivů zjistíme dopředu, aby start kamery byl okamžitý.
  useEffect(() => {
    void findWidestRearCamera().then((id) => { wideDeviceRef.current = id; });
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

  // Switch between rear/front camera without leaving the capture UI.
  // Guarded — a second tap while the new stream is being acquired used to flip
  // the camera twice (and on iOS could hijack a shutter tap).
  const switchCamera = useCallback(async () => {
    if (switching || shootingRef.current) return;
    setSwitching(true);
    const next = facingRef.current === "environment" ? "user" : "environment";
    facingRef.current = next;
    setFacing(next);
    stopCamera();
    try { setStream(await requestCamera(next)); }
    catch (e) { setCameraError(e instanceof Error ? e.message : "Kamera nedostupná"); }
    finally { setSwitching(false); }
  }, [requestCamera, stopCamera, switching]);



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
    if (!v.videoWidth || !v.videoHeight) return null;   // stream not ready yet
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    if (facingRef.current === "user") {
      // Front camera preview is mirrored — save what the user actually sees.
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    return await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), "image/jpeg", 0.92));
  };

  const handleFilePicked = async (file: File) => {
    if (!sessionId) return;
    await processAndUpload(file);
  };

  /**
   * Z prvního záběru vytvoří miniaturu na FIXNÍM přednastaveném pozadí.
   * 1) snímek se nahraje do storage (kvůli výřezu potřebuje Remove.bg URL)
   * 2) edge funkce `remove-background` vrátí PNG s alfou (žádné AI pozadí)
   * 3) canvas složí výřez na totožné pozadí (deterministická geometrie)
   * 4) výsledek se nahraje a uloží do metadat relace jako `thumbnail_url`
   * Pokud výřez selže, použije se snímek přímo (uživatel fotil do reálného pozadí).
   */
  const buildThumbnail = async (frame: Blob, sid: string) => {
    setThumbBusy(true);
    try {
      const srcPath = `${sid}/thumb-src-${Date.now()}.jpg`;
      const up = await supabase.storage.from("smart-capture")
        .upload(srcPath, frame, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("smart-capture").getPublicUrl(srcPath);

      let thumb: Blob | null = null;
      try {
        const { data, error } = await supabase.functions.invoke("remove-background", {
          body: { imageUrl: pub.publicUrl },
        });
        if (error) throw error;
        const png = data instanceof Blob ? data : new Blob([data as BlobPart], { type: "image/png" });
        thumb = await composeThumbnail(png, { dealerMode });
      } catch (cutErr) {
        console.warn("[thumbnail] cutout failed, using raw frame", cutErr);
        thumb = await frameToThumbnail(frame);
      }

      const thumbPath = `${sid}/thumbnail.jpg`;
      const upT = await supabase.storage.from("smart-capture")
        .upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: true });
      if (upT.error) throw upT.error;
      const { data: pubT } = supabase.storage.from("smart-capture").getPublicUrl(thumbPath);
      const url = `${pubT.publicUrl}?v=${Date.now()}`;
      setThumbnailUrl(url);

      await updateSession.mutateAsync({
        id: sid,
        updates: {
          metadata: {
            ...((session as { metadata?: Record<string, unknown> })?.metadata ?? {}),
            thumbnail_url: url,
          },
        },
      });
      toast({ title: "Miniatura připravena", description: "Použije se pouze v nabídce vozů, v detailu nikoli." });
    } catch (e) {
      toast({ title: "Miniatura se nevytvořila", description: String(e), variant: "destructive" });
    } finally {
      setThumbBusy(false);
    }
  };

  const handleShot = async () => {
    if (!sessionId || busy || switching || pending || shootingRef.current) return;
    shootingRef.current = true;
    try {
      // ⚡ Mikro-blok jen na zachycení snímku z videa (~20 ms).
      const blob = await captureFromVideo();
      if (!blob) { toast({ title: "Nelze pořídit snímek", description: "Kamera ještě není připravená, zkuste to znovu.", variant: "destructive" }); return; }
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 120);
      // Kontrola snímku — teprve „Použít fotografii“ ho uloží.
      setPending({ blob, url: URL.createObjectURL(blob), stepIdx: currentStepIdx });
    } finally {
      setTimeout(() => { shootingRef.current = false; }, 200);
    }
  };

  /** „Použít fotografii“ — upload běží na pozadí, uživatel pokračuje dál. */
  const acceptPending = () => {
    if (!pending || !sessionId) return;
    const { blob, url, stepIdx } = pending;
    setPending(null);
    URL.revokeObjectURL(url);
    if (stepIdx < totalSteps - 1) setCurrentStepIdx(stepIdx + 1);
    void processAndUpload(blob, stepIdx);
    if (stepIdx === 0 && thumbComposeEnabled && !thumbBusy) void buildThumbnail(blob, sessionId);
  };

  /** „Vyfotit znovu“ — snímek se zahodí, kamera zůstává připravená. */
  const retakePending = () => {
    setPending((p) => { if (p) URL.revokeObjectURL(p.url); return null; });
  };

  // Cleanup posledního náhledu při odchodu z obrazovky (žádné visící Blob URL).
  useEffect(() => () => { setPending((p) => { if (p) URL.revokeObjectURL(p.url); return null; }); }, []);




  const processAndUpload = async (input: Blob | File, stepIdx?: number) => {
    if (!sessionId) return;
    // Claim a unique shot index up-front — parallel uploads used to reuse
    // photos.length and produce duplicate ordering.
    shotIndexRef.current = Math.max(shotIndexRef.current, photos.length);
    const myIndex = shotIndexRef.current++;
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
        shotIndex: myIndex,
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
    if (typeof meta.thumbnail_url === "string") setThumbnailUrl(meta.thumbnail_url);

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

  const handleExportZip = async (opts?: { skipInfo?: boolean }) => {
    if (!sessionId) return;
    const skipInfo = !!opts?.skipInfo;
    if (!skipInfo && !requiredInfoFilled) {
      toast({
        title: "Vyplňte informace o voze",
        description: "Před exportem musí být vyplněna značka, model, rok, najezd, cena a popis — nebo použijte tlačítko Přeskočit.",
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
    /* 100dvh + safe-area: na iPhonu (dynamický toolbar Safari, notch, home indicator)
       je `fixed inset-0` samo o sobě nespolehlivé — obsah se schovával pod lištu. */
    <div
      className="fixed inset-0 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 text-white z-50 flex flex-col overflow-hidden"
      style={{ height: "100dvh", width: "100dvw" }}
    >
      {/* Header — hidden while capturing (full-screen camera) */}
      {phase !== "capturing" && (
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0 backdrop-blur-xl bg-black/40"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >


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
      )}


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

      {/* Capturing — 100% full-screen native-style camera */}
      {phase === "capturing" && (
        <div className="absolute inset-0 bg-black overflow-hidden">
          {/* Preview — celý displej, plné zorné pole objektivu.
              object-contain = žádný digitální zoom, žádný ořez, žádná deformace.
              Skutečný poměr stran čteme z videoWidth/videoHeight, ne z CSS. */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
            }}
            playsInline muted autoPlay
          />

          {/* DEALER MODE — průhledné vodítko pro vůz (pouze overlay, nikdy neovlivní snímek) */}
          {dealerMode && stream && !cameraError && !pending && (() => {
            const g = guideForShot(currentStep?.type, currentStep?.category);
            const gw = frameBox.width * g.width;
            const gh = frameBox.height * g.height;
            const gl = frameBox.left + frameBox.width * g.centerX - gw / 2;
            const gt = frameBox.top + frameBox.height * g.centerY - gh / 2;
            return (
              <div className="pointer-events-none absolute inset-0 z-20">
                <div
                  className="absolute rounded-xl ring-2 ring-amber-300/70"
                  style={{ left: gl, top: gt, width: gw, height: gh, boxShadow: "0 0 0 9999px rgba(0,0,0,0.18)" }}
                >
                  {/* Rohové značky pro rychlé zaměření */}
                  <span className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-amber-200 rounded-tl-xl" />
                  <span className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-amber-200 rounded-tr-xl" />
                  <span className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-amber-200 rounded-bl-xl" />
                  <span className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-amber-200 rounded-br-xl" />
                </div>
                <div
                  className="absolute text-[11px] text-amber-100 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full whitespace-nowrap max-w-[90vw] truncate"
                  style={{ left: frameBox.left + frameBox.width / 2, top: gt + gh + 8, transform: "translateX(-50%)" }}
                >
                  {Math.abs(horizonAngle) > 4 ? "Narovnejte telefon" : g.hint}
                </div>
              </div>
            );
          })()}


          {/* Přednastavené pozadí pro MINIATURU — vidíte ho už při focení
              prvního záběru a vozidlo do něj „zaparkujete". */}
          {thumbOverlayEnabled && thumbOverlayOn && currentStepIdx === 0 && stream && !cameraError && (
            <div className="pointer-events-none absolute inset-0 z-10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${CAPTURE_BG_URL})`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.5,
                }}
              />
              {/* Vodítka: středová osa + linie kol (asfalt) + rámec vozidla */}
              <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-300/50" />
              <div className="absolute inset-x-0 h-px bg-emerald-300/70" style={{ top: `${THUMB_PLACEMENT.wheelLineRatio * 100}%` }} />
              <div
                className="absolute border border-dashed border-emerald-300/60 rounded-md"
                style={{
                  left: `${(1 - THUMB_PLACEMENT.widthRatio) * 50}%`,
                  width: `${THUMB_PLACEMENT.widthRatio * 100}%`,
                  top: `${(THUMB_PLACEMENT.wheelLineRatio - THUMB_PLACEMENT.maxHeightRatio) * 100}%`,
                  height: `${THUMB_PLACEMENT.maxHeightRatio * 100}%`,
                }}
              />
            </div>
          )}


          {/* Composition grid (rule of thirds) */}
          {gridEnabled && stream && !cameraError && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/15" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/15" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/15" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/15" />
            </div>
          )}

          {/* Horizon level guide — only the guide rotates, the preview stays put */}
          {horizonEnabledSetting && stream && !cameraError && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`h-px transition-colors ${Math.abs(horizonAngle) < 0.5 ? "bg-emerald-400/80 w-44" : "bg-white/40 w-32"}`}
                style={{ transform: `rotate(${-horizonAngle}deg)` }} />
              <div className="absolute w-2 h-2 rounded-full bg-white/70" />
            </div>
          )}

          {/* Top bar — floating glass (nad overlayem pozadí, respektuje notch) */}
          <div
            className={`absolute top-0 inset-x-0 z-40 flex items-center justify-between gap-3 ${landscapeMode ? "px-4 pt-2" : "px-4 pt-4"}`}
            style={{
              paddingTop: landscapeMode ? "max(0.5rem, env(safe-area-inset-top))" : "max(1rem, env(safe-area-inset-top))",
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
          >

            <button onClick={() => { stopCamera(); navigate("/admin"); }}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center hover:bg-black/60 transition">
              <X size={18} />
            </button>

            <div className="flex items-center gap-2">
              {queueCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-200 bg-blue-500/25 backdrop-blur-xl ring-1 ring-blue-300/30 px-2.5 py-1 rounded-full">
                  <Loader2 size={10} className="animate-spin" /> {queueCount}
                </span>
              )}
              {voiceEnabledSetting && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-xl text-[10px] font-medium ring-1 ${
                  voiceActive ? "bg-emerald-500/25 ring-emerald-300/40 text-emerald-100" : "bg-black/40 ring-white/15 text-white/60"
                }`}>
                  {voiceActive ? <Mic size={11} /> : <MicOff size={11} />} hlas
                </span>
              )}
              {horizonEnabledSetting && Math.abs(horizonAngle) > 0.5 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 text-[10px] text-white/80 tabular-nums">
                  <Compass size={11} /> {horizonAngle > 0 ? "+" : ""}{horizonAngle.toFixed(0)}°
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 text-[10px] tabular-nums text-white/80">
                {currentStepIdx + 1} / {totalSteps}
              </span>
            </div>

            <button onClick={finishToReview} disabled={photos.length === 0}
              className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold disabled:opacity-30 hover:bg-white/90 transition">
              Hotovo
            </button>
          </div>

          {/* Instruction card — floating glass */}
          {currentStep && stream && !cameraError && (
            <div className={`absolute ${landscapeMode ? "top-16 left-4 max-w-xs" : "top-20 left-4 right-4"} flex items-start gap-3 bg-black/45 backdrop-blur-2xl ring-1 ring-white/15 rounded-2xl p-3 shadow-2xl`}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-lg shadow-blue-500/40 tabular-nums">
                {currentStepIdx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold tracking-tight">{currentStep.label}</div>
                <div className="text-xs text-white/70 mt-0.5 leading-relaxed">{currentStep.hint}</div>
              </div>
            </div>
          )}

          {/* Last analysis tip */}
          {lastAnalysis?.tip && stream && (
            <div className={`absolute ${landscapeMode ? "bottom-28 left-4 max-w-sm" : "bottom-48 left-4 right-4"} bg-gradient-to-r from-emerald-400 to-emerald-500 text-black rounded-xl px-3 py-2 text-sm flex items-center gap-2 shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-300`}>
              <Sparkles size={14} /> {lastAnalysis.tip}
            </div>
          )}

          {/* Waiting-for-camera placeholder */}
          {!stream && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
              <Loader2 className="animate-spin" size={28} />
              <div className="text-xs">Aktivuji kameru…</div>
              <div className="text-[11px] text-white/40">Pokud se objeví dotaz, povolte přístup ke kameře.</div>
            </div>
          )}

          {/* Camera error fallback */}
          {cameraError && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center px-6 text-center z-20">
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

          {/* Hidden gallery input (shared by both layouts) */}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); e.target.value = ""; }} />

          {landscapeMode ? (
            <>
              {/* LEFT column — navigation + secondary controls (kept away from the shutter) */}
              <div className="absolute left-0 inset-y-0 w-24 flex flex-col items-center justify-center gap-3 pointer-events-none z-30"
                style={{ paddingLeft: "env(safe-area-inset-left)" }}>
                <button onClick={() => setCurrentStepIdx((i) => Math.max(0, i - 1))} disabled={currentStepIdx === 0}
                  className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center disabled:opacity-30 hover:bg-black/60 transition"
                  title="Předchozí">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => setCurrentStepIdx((i) => Math.min(totalSteps - 1, i + 1))}
                  className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center hover:bg-black/60 transition"
                  title="Přeskočit">
                  <ChevronRight size={20} />
                </button>
                <button onClick={() => setPhase("vin")}
                  className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center hover:bg-black/60 transition"
                  title="VIN scan">
                  <ScanLine size={18} />
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center hover:bg-black/60 transition"
                  title="Z galerie">
                  <ImageIcon size={18} />
                </button>
                <button onClick={switchCamera} disabled={switching}
                  className="pointer-events-auto w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center disabled:opacity-40 hover:bg-black/60 transition"
                  title="Přepnout kameru">
                  {switching ? <Loader2 size={18} className="animate-spin" /> : <SwitchCamera size={18} />}
                </button>
              </div>

              {/* RIGHT column — POUZE spoušť; nic jiného tap nesebere.
                  onPointerUp + onClick (guardované shootingRef) = spolehlivé i v iOS landscape,
                  kde se click u pravého okraje občas zahodí. */}
              <div className="absolute right-0 inset-y-0 w-28 flex items-center justify-center pointer-events-none z-50"
                style={{ paddingRight: "max(0.5rem, env(safe-area-inset-right))" }}>
                <button
                  onPointerUp={(e) => { e.preventDefault(); handleShot(); }}
                  onClick={handleShot}
                  disabled={!stream || switching || !!pending}
                  style={{ touchAction: "manipulation" }}
                  className="pointer-events-auto relative w-[78px] h-[78px] rounded-full bg-white/20 backdrop-blur-xl ring-2 ring-white/70 active:scale-90 transition-transform disabled:opacity-40 shadow-[0_0_40px_rgba(255,255,255,0.25)]"
                  title="Vyfotit" aria-label="Vyfotit">
                  <span className="absolute inset-2 rounded-full bg-white" />
                </button>
              </div>



              {/* BOTTOM filmstrip */}
              {photos.length > 0 && (
                <div className="absolute bottom-0 left-24 right-28 px-4 pb-3 z-20"
                  style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((p) => {
                      const row = p as { id: string; processed_url: string; shot_type: string; quality_score: number };
                      return (
                        <div key={row.id} className="relative shrink-0">
                          <img src={row.processed_url} alt={row.shot_type}
                            className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/25" />
                          <span className="absolute -top-1 -right-1 text-[9px] bg-black/80 backdrop-blur rounded-full px-1.5 py-0.5">
                            {row.quality_score}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* PORTRAIT — floating bottom console */
            <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-5 pt-4 bg-gradient-to-t from-black via-black/80 to-transparent"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
              {photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-3">
                  {photos.map((p) => {
                    const row = p as { id: string; processed_url: string; shot_type: string; quality_score: number };
                    return (
                      <div key={row.id} className="relative shrink-0">
                        <img src={row.processed_url} alt={row.shot_type}
                          className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/25" />
                        <span className="absolute -top-1 -right-1 text-[9px] bg-black/80 backdrop-blur rounded-full px-1.5 py-0.5">
                          {row.quality_score}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <Progress value={((currentStepIdx + 1) / totalSteps) * 100} className="h-1 mb-4 bg-white/10" />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => fileInputRef.current?.click()}
                    className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center transition"
                    title="Z galerie" aria-label="Z galerie">
                    <ImageIcon size={19} />
                  </button>
                  <button onClick={() => setCurrentStepIdx((i) => Math.max(0, i - 1))} disabled={currentStepIdx === 0}
                    className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center disabled:opacity-30 transition"
                    title="Předchozí" aria-label="Předchozí">
                    <ChevronLeft size={19} />
                  </button>
                </div>

                <button
                  onPointerUp={(e) => { e.preventDefault(); handleShot(); }}
                  onClick={handleShot}
                  disabled={!stream || switching || !!pending}
                  style={{ touchAction: "manipulation" }}
                  className="relative w-20 h-20 shrink-0 rounded-full bg-white/20 backdrop-blur-xl ring-2 ring-white/70 active:scale-90 transition-transform disabled:opacity-40 shadow-[0_0_40px_rgba(255,255,255,0.25)]"
                  title="Vyfotit" aria-label="Vyfotit">
                  <span className="absolute inset-2 rounded-full bg-white" />
                </button>

                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentStepIdx((i) => Math.min(totalSteps - 1, i + 1))}
                    className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center transition"
                    title="Přeskočit" aria-label="Přeskočit">
                    <ChevronRight size={19} />
                  </button>
                  <button onClick={switchCamera} disabled={switching}
                    className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center disabled:opacity-40 transition"
                    title="Přepnout kameru" aria-label="Přepnout kameru">
                    {switching ? <Loader2 size={18} className="animate-spin" /> : <SwitchCamera size={18} />}
                  </button>
                  <button onClick={() => setPhase("vin")}
                    className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center transition"
                    title="VIN scan" aria-label="VIN scan">
                    <ScanLine size={19} />
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* KONTROLA SNÍMKU — kamera běží dál, žádná reinicializace streamu */}
          {pending && (
            <div className="absolute inset-0 z-[60] bg-black/95 flex flex-col">
              <img src={pending.url} alt="Náhled pořízené fotografie"
                className="absolute inset-0 w-full h-full object-contain" />
              <div
                className={`absolute z-10 ${landscapeMode ? "right-0 inset-y-0 w-40 flex-col justify-center" : "bottom-0 inset-x-0 flex-row"} flex items-center gap-3 p-4 bg-black/50 backdrop-blur-xl`}
                style={{
                  paddingBottom: landscapeMode ? undefined : "max(1.25rem, env(safe-area-inset-bottom))",
                  paddingRight: "max(1rem, env(safe-area-inset-right))",
                  paddingLeft: "max(1rem, env(safe-area-inset-left))",
                }}
              >
                <button onPointerUp={(e) => { e.preventDefault(); retakePending(); }} onClick={retakePending}
                  style={{ touchAction: "manipulation" }}
                  className="flex-1 w-full min-h-[52px] rounded-2xl bg-white/10 ring-1 ring-white/25 text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition">
                  <RotateCcw size={17} /> Vyfotit znovu
                </button>
                <button onPointerUp={(e) => { e.preventDefault(); acceptPending(); }} onClick={acceptPending}
                  style={{ touchAction: "manipulation" }}
                  className="flex-1 w-full min-h-[52px] rounded-2xl bg-white text-black text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition">
                  <Check size={17} /> Použít fotografii
                </button>
              </div>
            </div>
          )}

          {/* ⚡ Shutter flash */}
          {shutterFlash && (
            <div className="absolute inset-0 bg-white pointer-events-none animate-in fade-in duration-75" style={{ animationDirection: "alternate" }} />
          )}

        </div>
      )}


      {/* VIN phase */}
      {phase === "vin" && (
        <div className="flex-1 flex flex-col p-6">
          <h2 className="text-2xl font-light mb-2">Naskenujte VIN</h2>
          <p className="text-white/60 text-sm mb-6">Štítek bývá ve dveřích řidiče, pod kapotou nebo na čelním skle.</p>

          <div className="relative aspect-video bg-white/5 rounded-2xl overflow-hidden mb-4 flex items-center justify-center">
            {stream ? <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />
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

          {/* Miniatura na přednastaveném pozadí — jen pro nabídku vozů */}
          {(thumbOverlayEnabled || thumbnailUrl) && (
            <div className="max-w-md mx-auto mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Miniatura pro nabídku vozů</h3>
                {thumbBusy && <span className="text-[11px] text-blue-300 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> skládám…</span>}
              </div>
              {thumbnailUrl ? (
                <>
                  <img src={thumbnailUrl} alt="Miniatura vozidla na showroom pozadí"
                    className="w-full aspect-video object-cover rounded-xl ring-1 ring-white/15" />
                  <p className="text-[11px] text-white/50 mt-2">
                    Použije se pouze jako miniatura v nabídce vozů — v detailu vozidla se nezobrazuje.
                  </p>
                </>
              ) : (
                <p className="text-xs text-white/50">
                  Miniatura se vytvoří z prvního záběru pořízeného s vloženým pozadím.
                </p>
              )}
            </div>
          )}



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
            {/* Diktování údajů hlasem */}
            {voiceEnabledSetting && !voiceUnsupported && (
              <Button
                variant="outline"
                onClick={() => {
                  const v = voiceRef.current; if (!v) return;
                  if (dictating) {
                    v.setDictationHandler(null);
                    v.stop();
                    setDictating(false);
                    toast({ title: "Diktování ukončeno" });
                  } else {
                    v.setDictationHandler((text) => {
                      const parsed = parseDictation(text);
                      if (Object.keys(parsed).length === 0) {
                        // Nothing structured — push to description
                        setVehicleInfo((s) => ({ ...s, description: ((s.description ?? "") + " " + text).trim() }));
                      } else {
                        setVehicleInfo((s) => ({ ...s, ...parsed }));
                      }
                      toast({ title: "Zaznamenáno", description: text });
                    });
                    v.start();
                    setDictating(true);
                    toast({ title: "Diktování spuštěno", description: "Např.: značka Škoda, model Octavia, rok 2018, najezd 120000, cena 250000, nafta automat." });
                  }
                }}
                className={`w-full border-white/20 bg-transparent ${dictating ? "ring-2 ring-emerald-400/60" : ""}`}>
                {dictating ? <MicOff className="mr-2" size={16} /> : <Mic className="mr-2" size={16} />}
                {dictating ? "Zastavit diktování" : "Nadiktovat údaje o voze"}
              </Button>
            )}

            <Button onClick={() => handleExportZip()} disabled={busy || photos.length === 0 || !requiredInfoFilled}
              className="w-full bg-white text-black hover:bg-white/90 disabled:bg-white/30 disabled:text-white/60">
              {busy ? <Loader2 className="animate-spin mr-2" size={16} /> : <Download className="mr-2" size={16} />}
              {requiredInfoFilled
                ? "Exportovat ZIP (original + inzertní 1MB + web + info.txt)"
                : "Vyplňte povinné údaje o voze"}
            </Button>

            {/* Přeskočit info — dokončit i bez vyplnění */}
            {!requiredInfoFilled && (
              <Button onClick={() => handleExportZip({ skipInfo: true })} disabled={busy || photos.length === 0}
                variant="outline"
                className="w-full border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200">
                <SkipForward className="mr-2" size={16} /> Přeskočit údaje a exportovat ZIP
              </Button>
            )}

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
