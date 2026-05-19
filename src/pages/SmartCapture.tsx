import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, X, Check, RotateCcw, Sparkles, ChevronRight, Loader2, ScanLine, Image as ImageIcon, Download, Shield, AlertCircle } from "lucide-react";
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
import { buildSessionZip, downloadBlob, type ExportPhoto } from "@/lib/smartCapture/export";

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
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [vinScanning, setVinScanning] = useState(false);
  const [vinValue, setVinValue] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin gate
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/admin"); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user, authLoading, navigate]);

  // Start camera when capturing
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      toast({
        title: "Kamera nedostupná",
        description: "Použijte tlačítko pro nahrání ze souboru / galerie.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [stream]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Start new session
  const handleStart = async () => {
    setBusy(true);
    try {
      let id = sessionId;
      if (!id) {
        const sess = await createSession.mutateAsync();
        id = sess.id;
        setSessionId(id);
        setSearchParams({ session: id });
      }
      setPhase("capturing");
      await startCamera();
    } catch (e) {
      toast({ title: "Nelze spustit relaci", description: String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

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
    if (!sessionId) return;
    setBusy(true);
    try {
      const blob = await captureFromVideo();
      if (!blob) { toast({ title: "Nelze pořídit snímek", variant: "destructive" }); return; }
      await processAndUpload(blob);
    } finally { setBusy(false); }
  };

  const processAndUpload = async (input: Blob | File) => {
    if (!sessionId) return;
    setBusy(true);
    setLastAnalysis(null);
    try {
      // Process locally (premium dealer look)
      const autoProcess = !settings || (settings as { auto_image_processing?: string }).auto_image_processing !== "off";
      const { blob: processed, width, height } = autoProcess
        ? await processImage(input)
        : { blob: input as Blob, width: 0, height: 0 };

      // Local blur score (always cheap)
      const blurScore = await computeBlurScore(processed).catch(() => 50);

      // AI analyze (optional)
      let ai: AnalysisResult = {};
      if (aiEnabled) {
        try {
          const b64 = await fileToBase64(processed);
          const { data, error } = await supabase.functions.invoke("smart-capture-analyze", {
            body: { imageBase64: b64 },
          });
          if (!error && data) ai = data as AnalysisResult;
        } catch (e) { console.warn("AI analyze fail:", e); }
      }

      setLastAnalysis(ai);

      const detectedType = (ai.shot_type as ShotType) || currentStep?.type || "unknown";
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

      // Auto-advance to next recommended step
      if (currentStepIdx < totalSteps - 1) setCurrentStepIdx((i) => i + 1);
    } catch (e) {
      toast({ title: "Nahrání selhalo", description: String(e), variant: "destructive" });
    } finally { setBusy(false); }
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

  const handleExportZip = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      const items: ExportPhoto[] = photos.map((p, i) => {
        const row = p as { shot_type: ShotType; original_url: string; processed_url: string };
        return {
          shotType: row.shot_type, index: i,
          originalUrl: row.original_url, processedUrl: row.processed_url,
        };
      });
      const brand = ((session as { decoded_data?: { make?: string } })?.decoded_data?.make) || "Vozidlo";
      const model = ((session as { decoded_data?: { model?: string } })?.decoded_data?.model) || "Model";
      const zip = await buildSessionZip(items, { brand, model });
      downloadBlob(zip, `${brand}-${model}-${new Date().toISOString().slice(0, 10)}.zip`);
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
    <div className="fixed inset-0 bg-black text-white z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <button onClick={() => { stopCamera(); navigate("/admin"); }}
          className="p-2 rounded-full hover:bg-white/10">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={16} className="text-blue-400" />
          Smart Capture
          {photos.length > 0 && <span className="text-white/60">· {photos.length} fotek</span>}
        </div>
        <button onClick={finishToReview}
          disabled={photos.length === 0}
          className="text-sm px-3 py-1.5 rounded-full bg-white text-black font-medium disabled:opacity-30">
          Hotovo
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
          <p className="text-white/40 text-sm mb-8 flex items-center gap-2">
            <Shield size={14} /> Existující inzeráty zůstanou nedotčené.
          </p>
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
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

            {/* Guidance overlay */}
            {currentStep && (
              <div className="absolute top-4 left-4 right-4 flex items-start gap-3 bg-black/60 backdrop-blur rounded-2xl p-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 text-sm font-semibold shrink-0">
                  {currentStepIdx + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">📸 {currentStep.label}</div>
                  <div className="text-xs text-white/70 mt-0.5 leading-relaxed">{currentStep.hint}</div>
                </div>
              </div>
            )}

            {/* Last analysis tip */}
            {lastAnalysis?.tip && (
              <div className="absolute bottom-32 left-4 right-4 bg-emerald-500/90 text-black rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                <Sparkles size={14} /> {lastAnalysis.tip}
              </div>
            )}

            {/* Busy overlay */}
            {busy && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="animate-spin" size={36} />
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="shrink-0 bg-black border-t border-white/10 px-4 py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
                title="Z galerie">
                <ImageIcon size={20} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); e.target.value = ""; }} />

              <button onClick={handleShot} disabled={busy || !stream}
                className="w-20 h-20 rounded-full bg-white border-4 border-white/40 active:scale-95 transition disabled:opacity-50" />

              <button
                onClick={() => { setPhase("vin"); }}
                className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
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

          <div className="space-y-2 max-w-md mx-auto">
            <Button onClick={handleExportZip} disabled={busy || photos.length === 0}
              className="w-full bg-white text-black hover:bg-white/90">
              {busy ? <Loader2 className="animate-spin mr-2" size={16} /> : <Download className="mr-2" size={16} />}
              Exportovat ZIP (original + web + inzerce)
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
