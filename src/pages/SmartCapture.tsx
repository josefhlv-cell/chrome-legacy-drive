import { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, X, Check, RotateCcw, Sparkles, ChevronRight, Loader2, ScanLine, Image as ImageIcon, Download, Shield, AlertCircle, Mic, MicOff, SkipForward, Compass, SwitchCamera, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  useCreateSession, useSession, useSessionPhotos, useSessions,
  useUpdateSession, useDeleteSessionPhoto, useSmartCaptureSettings,
} from "@/hooks/useSmartCapture";
import { SHOT_SEQUENCE, SHOT_LABEL_MAP, type ShotType } from "@/lib/smartCapture/types";
import { computeBlurScore } from "@/lib/smartCapture/imageProcessing";
import { buildSessionZip, downloadBlob, type ExportPhoto, type VehicleInfo } from "@/lib/smartCapture/export";
import { createVoiceController, parseDictation, type VoiceCommand } from "@/lib/smartCapture/voiceControl";
import { createHorizonController } from "@/lib/smartCapture/horizonLevel";
import { guideForShot } from "@/lib/smartCapture/dealerGuide";
import { CaptureFilmstrip } from "@/components/admin/CaptureFilmstrip";
import { enqueuePhoto, photoQueue, restoreQueue, retrySessionPhotos } from "@/lib/smartCapture/photoQueue";
import { advanceProgress, readProgress, type CaptureProgress } from "@/lib/smartCapture/workflow";
import { Copy, List } from "lucide-react";
import { openCamera, findWidestRearCamera, resetCameraCache } from "@/lib/smartCapture/camera";



type Phase = "intro" | "capturing" | "review";

export default function SmartCapture() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const lastSessionKey = user ? `capture-last-session:${user.id}` : undefined;
  useEffect(() => {
    if (!lastSessionKey) return;
    try {
      if (searchParams.get("session")) localStorage.setItem(lastSessionKey, searchParams.get("session") ?? "");
      else if (mobile) {
        const last = localStorage.getItem(lastSessionKey);
        if (last) setSearchParams({ session: last }, { replace: true });
      }
    } catch { /* Storage can be disabled in private browsing. */ }
  // mobile is derived from the device, not reactive state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSessionKey, searchParams, setSearchParams]);
  const sessionIdFromUrl = searchParams.get("session");
  const [sessionId, setSessionId] = useState<string | undefined>(sessionIdFromUrl ?? undefined);
  useEffect(() => {
    if ((sessionIdFromUrl ?? undefined) !== sessionId) { setSessionId(sessionIdFromUrl ?? undefined); setPhase(sessionIdFromUrl ? "review" : "intro"); }
  // URL navigation, not local session creation, drives this synchronization.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromUrl]);
  const createSession = useCreateSession();
  const { data: session, isLoading: sessionLoading, error: sessionError } = useSession(sessionId);
  const { data: sessions = [], refetch: refetchSessions } = useSessions();
  const { data: photos = [], refetch: refetchPhotos } = useSessionPhotos(sessionId);
  const allQueued = useSyncExternalStore(photoQueue.subscribe, photoQueue.getSnapshot);
  const queued = useMemo(() => allQueued.filter(p => p.sessionId === sessionId), [allQueued, sessionId]);
  const queueCount = queued.filter(p => p.status === "uploading").length;
  const [starting, setStarting] = useState(false);
  const startRef = useRef(false);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
  const [progress, setProgress] = useState<CaptureProgress>({ skipped_steps: [], next_step: 0 });
  const progressRef = useRef(progress);
  const metadataChain = useRef<Promise<unknown>>(Promise.resolve());
  const [progressError, setProgressError] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const progressWrites = useRef(0);
  const initializedSession = useRef<string>();
  const completionStep = useRef<number | null>(null);

  const saveProgress = useCallback((next: CaptureProgress, sid = sessionId) => {
    if (!sid) return;
    progressRef.current = next; setProgress(next);
    try { localStorage.setItem(`capture-progress:${sid}`, JSON.stringify(next)); } catch { /* Remote saving still proceeds. */ }
    progressWrites.current++; setProgressSaving(true);
    metadataChain.current = metadataChain.current.catch(() => undefined).then(async () => {
      const { data, error } = await supabase.from("smart_capture_sessions").select("metadata").eq("id", sid).single();
      if (error) throw error;
      const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {};
      const result = await supabase.from("smart_capture_sessions").update({ metadata: { ...metadata, ...next } }).eq("id", sid);
      if (result.error) throw result.error;
      // Only remove the local checkpoint when it is still the same revision.
      if (localStorage.getItem(`capture-progress:${sid}`) === JSON.stringify(next)) localStorage.removeItem(`capture-progress:${sid}`);
      setProgressError(false);
    }).catch(() => {
      setProgressError(true);
      toast({ title: "Průběh zatím uložen jen v tomto zařízení", description: "Zkuste uložení znovu před otevřením na PC.", variant: "destructive" });
    }).finally(() => {
      progressWrites.current = Math.max(0, progressWrites.current - 1);
      setProgressSaving(progressWrites.current > 0);
    });
  }, [sessionId, toast]);

  const copyLink = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/admin/smart-capture?session=${sessionId}`);
      toast({ title: "Odkaz zkopírován" });
    } catch { toast({ title: "Odkaz nelze zkopírovat", description: "Zkopírujte adresu z adresního řádku.", variant: "destructive" }); }
  };

  useEffect(() => {
    if (!sessionId || !session || initializedSession.current === sessionId) return;
    initializedSession.current = sessionId;
    let next = readProgress(session.metadata);
    let checkpoint: string | null = null;
    try { checkpoint = localStorage.getItem(`capture-progress:${sessionId}`); } catch { /* Recover from durable photo records below. */ }
    if (checkpoint) { try { next = readProgress(JSON.parse(checkpoint)); saveProgress(next); } catch { /* invalid checkpoint */ } }
    progressRef.current = next; setProgress(next);
    setCurrentStepIdx(Math.min(19, next.next_step));
    setPhase("review");
    void restoreQueue(sessionId).then(stored => {
      const latest = stored?.filter(p => p.progress).sort((a, b) => b.shotIndex - a.shotIndex)[0]?.progress;
      // Photo and its progress are one atomic record if the page died before saveProgress.
      if (latest && (!checkpoint || latest.next_step > progressRef.current.next_step)) {
        saveProgress(latest); setCurrentStepIdx(Math.min(19, latest.next_step));
      }
    }).catch(() => toast({ title: "Místní frontu se nepodařilo obnovit", variant: "destructive" }));
  }, [sessionId, session, saveProgress, toast]);

  useEffect(() => {
    const online = () => { if (sessionId) { saveProgress(progressRef.current); retrySessionPhotos(sessionId); } void refetchPhotos(); };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [sessionId, saveProgress, refetchPhotos]);

  useEffect(() => { if (sessionId && queueCount === 0) void refetchPhotos(); }, [sessionId, queueCount, refetchPhotos]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (queued.some(p => p.status !== "done") || progressError || progressSaving) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [queued, progressError, progressSaving]);
  const deletePhoto = useDeleteSessionPhoto();
  const updateSession = useUpdateSession();
  const { data: settings } = useSmartCaptureSettings();

  const [phase, setPhase] = useState<Phase>("intro");
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraGeneration = useRef(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const acceptingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  /** Právě pořízený snímek — čeká na „Použít fotografii“ / „Vyfotit znovu“.
   *  Kamera přitom BĚŽÍ dál (žádná reinicializace MediaStreamu). */
  const [pending, setPending] = useState<{ blob: Blob; url: string; stepIdx: number } | null>(null);
  /** Skutečný poměr stran streamu — zjištěn z videoWidth/videoHeight, ne z CSS. */
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pendingTip, setPendingTip] = useState<string>();
  const pendingToken = useRef(0);
  const pendingRef = useRef<{ url: string } | null>(null);
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
  const thumbOverlayEnabled = false;
  /** Dealer Mode — jednotné měřítko a kompozice u všech vozidel (default OFF). */
  const dealerMode = useMemo(() => !!(settings as { dealer_mode?: boolean })?.dealer_mode, [settings]);

  const thumbBusy = false;
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);


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


  const [voiceUnsupported, setVoiceUnsupported] = useState(false);
  const [dictating, setDictating] = useState(false);

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
    setCameraReady(false);
    let timeout: ReturnType<typeof setTimeout>;
    const ready = () => {
      if (v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= 2) { setCameraReady(true); clearTimeout(timeout); }
    };
    v.addEventListener("loadeddata", ready); v.addEventListener("playing", ready);
    timeout = setTimeout(() => {
      if (!v.videoWidth || v.readyState < 2) setCameraError("Kamera se neprobudila. Klepněte na Zkusit znovu.");
    }, 10000);
    try {
      v.srcObject = stream;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => { /* ignore autoplay reject */ });
    } catch { /* ignore */ }
    const ended = () => { setCameraReady(false); setCameraError("Kamera byla přerušena. Klepněte na Zkusit znovu."); };
    stream.getVideoTracks().forEach(t => t.addEventListener("ended", ended));
    return () => {
      clearTimeout(timeout); v.removeEventListener("loadeddata", ready); v.removeEventListener("playing", ready);
      stream.getVideoTracks().forEach(t => t.removeEventListener("ended", ended));
    };
  }, [stream, phase]);

  const stopCamera = useCallback(() => {
    cameraGeneration.current++;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    setCameraReady(false); setStream(null);
  }, []);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden" && phase === "capturing") {
        stopCamera(); setCameraError("Kamera byla pozastavena. Klepněte na Zkusit znovu.");
      }
    };
    const hide = () => { if (phase === "capturing") { stopCamera(); setCameraError("Kamera byla pozastavena. Klepněte na Zkusit znovu."); } };
    document.addEventListener("visibilitychange", hidden); window.addEventListener("pagehide", hide);
    return () => { document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", hide); };
  }, [phase, stopCamera]);

  // Gesture-safe camera request — must be the FIRST await after the user click
  // on iOS Safari, otherwise the permission prompt is silently dropped.
  // Nejširší zadní objektiv, plný senzor (4:3), zoom 1× — bez digitálního přiblížení.
  const wideDeviceRef = useRef<string | null>(null);
  const requestCamera = useCallback(async (mode: "environment" | "user" = facingRef.current): Promise<MediaStream> => {
    const generation = ++cameraGeneration.current;
    const stream = await openCamera(mode, mode === "environment" ? wideDeviceRef.current : null);
    if (generation !== cameraGeneration.current) {
      stream.getTracks().forEach(t => t.stop()); throw new Error("Otevření kamery bylo přerušeno. Zkuste to znovu.");
    }
    streamRef.current = stream;
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


  // Request camera inside the click gesture, but enable capture only after a valid session.
  const handleStart = async () => {
    if (startRef.current || (sessionId && !session)) return;
    startRef.current = true; setStarting(true); setCameraError(null);
    let acquired: MediaStream | undefined;
    const cameraPromise = requestCamera().then(value => { acquired = value; return value; }).catch(e => {
      setCameraError(e instanceof Error ? e.message : "Kamera nedostupná"); return undefined;
    });
    try {
      if (!sessionId) {
        const created = await createSession.mutateAsync();
        initializedSession.current = created.id;
        setSessionId(created.id); setSearchParams({ session: created.id });
        progressRef.current = { skipped_steps: [], next_step: 0 }; setProgress(progressRef.current);
        setCurrentStepIdx(0); void refetchSessions();
      }
      const camera = await cameraPromise;
      if (camera) setStream(camera);
      setPhase("capturing");
    } catch (e) {
      toast({ title: "Relace se nevytvořila", description: String(e), variant: "destructive" });
      void cameraPromise.then(value => value?.getTracks().forEach(t => t.stop()));
      acquired?.getTracks().forEach(t => t.stop());
      setPhase("intro");
    } finally { startRef.current = false; setStarting(false); }
  };

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try { setStream(await requestCamera()); }
    catch (e) { setCameraError(e instanceof Error ? e.message : "Kamera nedostupná"); }
  }, [requestCamera, stopCamera]);

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
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    if (facingRef.current === "user") {
      // Front camera preview is mirrored — save what the user actually sees.
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    return await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), "image/jpeg", 0.92));
  };

  const handleFilePicked = (file: File) => {
    if (!sessionId) return;
    void acceptPhoto(file, currentStepIdx);
  };

  const handleShot = async () => {
    if (!sessionId || busy || switching || pending || shootingRef.current || !cameraReady) return;
    shootingRef.current = true;
    try {
      // ⚡ Mikro-blok jen na zachycení snímku z videa (~20 ms).
      const blob = await captureFromVideo();
      if (!blob) { toast({ title: "Nelze pořídit snímek", description: "Kamera ještě není připravená, zkuste to znovu.", variant: "destructive" }); return; }
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 120);
      // Kontrola snímku — teprve „Použít fotografii“ ho uloží.
      const preview = { blob, url: URL.createObjectURL(blob), stepIdx: currentStepIdx };
      pendingRef.current = preview; setPending(preview); setPendingTip(undefined);
      const token = ++pendingToken.current;
      void computeBlurScore(blob).then(score => {
        if (token === pendingToken.current && score < 35) setPendingTip("Fotka vypadá mírně rozmazaná");
      }).catch(() => undefined);
    } finally {
      shootingRef.current = false;
    }
  };

  const advance = (stepIdx: number, skipped: boolean) => {
    saveProgress(advanceProgress(progressRef.current, stepIdx, skipped));
    if (completionStep.current !== null) {
      completionStep.current = null; stopCamera(); setPhase("review");
    } else if (stepIdx < totalSteps - 1) setCurrentStepIdx(stepIdx + 1);
    else { stopCamera(); setPhase("review"); }
  };

  const acceptPhoto = async (blob: Blob, stepIdx: number) => {
    if (!sessionId || acceptingRef.current) return false;
    acceptingRef.current = true; setAccepting(true);
    try {
    shotIndexRef.current = Math.max(shotIndexRef.current, ...photos.map(p => p.shot_index + 1), ...queued.map(p => p.shotIndex + 1));
    await enqueuePhoto({ sessionId, blob, shotType: SHOT_SEQUENCE[stepIdx].type,
      progress: advanceProgress(progressRef.current, stepIdx, false),
      shotIndex: shotIndexRef.current++, autoProcess: settings?.auto_image_processing !== "off", aiEnabled });
    advance(stepIdx, false);
    return true;
    } catch (e) {
      toast({ title: "Fotografii se nepodařilo uložit v telefonu", description: "Snímek zůstává v náhledu. Uvolněte místo a zkuste Použít fotografii znovu.", variant: "destructive" });
      return false;
    } finally { acceptingRef.current = false; setAccepting(false); }
  };

  const acceptPending = async () => {
    if (!pending || !sessionId || acceptingRef.current) return;
    shootingRef.current = true;
    const { blob, url, stepIdx } = pending;
    if (!await acceptPhoto(blob, stepIdx)) { shootingRef.current = false; return; }
    pendingToken.current++; pendingRef.current = null; setPending(null); setPendingTip(undefined); URL.revokeObjectURL(url);
    setTimeout(() => { shootingRef.current = false; }, 0);
  };

  useEffect(() => () => { if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.url); }, []);

  const retakePending = () => {
    if (acceptingRef.current) return;
    pendingToken.current++; pendingRef.current = null; setPendingTip(undefined);
    setPending(p => { if (p) URL.revokeObjectURL(p.url); return null; });
  };

  const skipStep = () => {
    if (!sessionId || acceptingRef.current) return;
    retakePending(); advance(currentStepIdx, true);
  };

  const leaveCamera = () => { if (acceptingRef.current) return; retakePending(); stopCamera(); setPhase("review"); };

  const finishToReview = () => {
    if (!sessionId) return;
    leaveCamera();
    updateSession.mutate({ id: sessionId, updates: { status: "review" } }, {
      onError: e => toast({ title: "Stav relace se neuložil", description: String(e), variant: "destructive" }),
    });
  };

  // ===== Voice control =====
  const handleVoiceCommand = useCallback((cmd: VoiceCommand) => {
    if (phase !== "capturing") {
      return;
    }
    switch (cmd) {
      // Při kontrole snímku plní hlas roli tlačítek Použít / Vyfotit znovu.
      case "shot": if (pending) acceptPending(); else void handleShot(); break;
      case "next": skipStep(); break;
      case "prev": setCurrentStepIdx((i) => Math.max(0, i - 1)); break;
      case "retake": {
        if (pending) { retakePending(); break; }

        const last = photos[photos.length - 1] as { id: string } | undefined;
        if (last && sessionId) {
          deletePhoto.mutate({ id: last.id, sessionId });
          setCurrentStepIdx((i) => Math.max(0, i - 1));
        }
        break;
      }
      case "vin": break;
      case "done": finishToReview(); break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, photos, sessionId, totalSteps, pending]);

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
    if (phase === "capturing" && voiceEnabledSetting && !mobile) {
      v.start();
    } else if (!dictating) {
      v.stop();
    }
    return () => { if (phase !== "capturing" && !dictating) v.stop(); };
  }, [phase, voiceEnabledSetting, dictating, mobile]);

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



  useEffect(() => {
    if (mobile || phase !== "review" || !session || progressError || progressSaving) return;
    const next = readProgress(session.metadata);
    if (next.next_step < progressRef.current.next_step) return;
    progressRef.current = next; setProgress(next);
  }, [session, mobile, phase, progressError, progressSaving]);

  const infoSessionRef = useRef<string>();
  // Prefill vehicle info from VIN-decoded data + saved session metadata
  useEffect(() => {
    if (!session || infoSessionRef.current === session.id) return;
    infoSessionRef.current = session.id;
    const decoded = ((session as { decoded_data?: Record<string, unknown> }).decoded_data ?? {}) as Record<string, unknown>;
    const meta = ((session as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>;
    const savedInfo = (meta.vehicle_info ?? {}) as Partial<VehicleInfo>;
    if (typeof meta.thumbnail_url === "string") setThumbnailUrl(meta.thumbnail_url);

    setVehicleInfo(() => {
      const next: VehicleInfo = { brand: "", model: "", ...savedInfo };
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

  const saveVehicleInfo = async () => {
    if (!sessionId) return;
    await metadataChain.current;
    const { data, error } = await supabase.from("smart_capture_sessions").select("metadata").eq("id", sessionId).single();
    if (error) throw error;
    const metadata = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? data.metadata : {};
    await updateSession.mutateAsync({ id: sessionId, updates: { metadata: { ...metadata, vehicle_info: vehicleInfo } } });
  };

  const handleExportZip = async (opts?: { skipInfo?: boolean }) => {
    if (!sessionId || queued.some(p => p.status !== "done")) return;
    await metadataChain.current;
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
      await saveVehicleInfo();
      const fresh = await refetchPhotos();
      if (fresh.error) throw fresh.error;
      const exportPhotos = fresh.data ?? [];

      const items: ExportPhoto[] = exportPhotos.map((p, i) => {
        const row = p as {
          shot_type: ShotType; original_url: string; processed_url: string;
          created_at?: string;
        };
        return {
          shotType: row.shot_type, index: i,
          originalUrl: row.original_url, processedUrl: row.processed_url,
          // Skutečné datum pořízení → součást názvu souboru v ZIPu.
          capturedAt: row.created_at ?? null,
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
      className="fixed inset-0 bg-background text-foreground z-[100] flex flex-col overflow-hidden"
      style={{ height: "100dvh", width: "100vw", minHeight: "100dvh" }}
    >
      {phase !== "capturing" && <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-background"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <Button size="icon" variant="ghost" onClick={() => { stopCamera(); navigate("/admin"); }} aria-label="Zavřít Smart Capture"><X size={20} /></Button>
        <div className="flex items-center gap-2 text-sm"><Camera size={16} /> Smart Capture <span className="text-muted-foreground">{photos.length ? `· ${photos.length}` : ""}</span></div>
        <Button variant="secondary" size="sm" onClick={() => { stopCamera(); navigate("/admin"); }}>Zavřít</Button>
      </header>}

      {phase === "intro" && (
        <div className="flex-1 overflow-y-auto p-6 bg-background text-foreground">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-heading mb-6">Smart Capture</h1>
            <Button size="lg" onClick={handleStart} disabled={starting}>
              {starting ? <Loader2 className="animate-spin" /> : <Camera />} Nové focení
            </Button>
            {!mobile && <section className="mt-8">
              <h2 className="text-lg mb-3">Relace</h2>
              {sessions.length === 0 && <p className="text-muted-foreground">Zatím žádné relace</p>}
              <div className="divide-y divide-border">{sessions.map(row => {
                const meta = row.metadata as Record<string, unknown> | null;
                const info = meta?.vehicle_info as VehicleInfo | undefined;
                return <Button key={row.id} variant="ghost" className="w-full h-auto justify-between py-4" onClick={() => {
                  stopCamera(); setSessionId(row.id); setSearchParams({ session: row.id }); setPhase("review");
                }}>
                  <span>{[info?.brand, info?.model].filter(Boolean).join(" ") || row.vin || "Bez identifikace"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("cs-CZ")}</span>
                </Button>;
              })}</div>
            </section>}
          </div>
        </div>
      )}

      {phase === "capturing" && (
        <div className="absolute inset-0 bg-background overflow-hidden text-foreground">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain" playsInline muted autoPlay
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} />
          {dealerMode && stream && !pending && (() => {
            const guide = guideForShot(currentStep?.type, currentStep?.category);
            return <div className="pointer-events-none absolute border border-primary/70 rounded-md" style={{
              left: `${(guide.centerX - guide.width / 2) * 100}%`, top: `${(guide.centerY - guide.height / 2) * 100}%`,
              width: `${guide.width * 100}%`, height: `${guide.height * 100}%`,
            }} />;
          })()}
          {horizonEnabledSetting && stream && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="w-32 h-px bg-primary/70" style={{ transform: `rotate(${-horizonAngle}deg)` }} /></div>}
          {gridEnabled && stream && <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-border/40" /><div className="absolute inset-y-0 left-2/3 w-px bg-border/40" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-border/40" /><div className="absolute inset-x-0 top-2/3 h-px bg-border/40" />
          </div>}
          <div className="absolute top-0 inset-x-0 z-20 flex items-start justify-between gap-3 p-3"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <Button size="icon" variant="secondary" onClick={leaveCamera} aria-label="Ukončit focení"><X /></Button>
            <div className="bg-background/85 rounded-md px-3 py-2 text-center min-w-0">
              <div className="text-sm font-semibold">{currentStepIdx + 1} / {totalSteps} · {currentStep?.label}</div>
              <div className="text-xs text-muted-foreground mt-1 max-w-sm">{currentStep?.hint}</div>
            </div>
            <Button size="icon" variant="secondary" onClick={copyLink} title="Zkopírovat odkaz" aria-label="Zkopírovat odkaz"><Copy /></Button>
          </div>
          {progressError && <Button variant="secondary" size="sm" className="absolute top-24 left-3 z-20" onClick={() => saveProgress(progressRef.current)}>Znovu uložit průběh</Button>}
          {!stream && !cameraError && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
          {cameraError && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-background/90">
            <AlertCircle /><p>{cameraError}</p>
            <Button onClick={startCamera}><RotateCcw /> Zkusit znovu</Button>
            <Button variant="outline" onClick={() => fallbackUploadRef.current?.click()}><ImageIcon /> Nahrát fotografii</Button>
          </div>}
          <input ref={fallbackUploadRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const file = e.target.files?.[0]; if (file) handleFilePicked(file); e.target.value = "";
          }} />
          <div className={`absolute z-20 ${landscapeMode ? "right-3 top-1/2 -translate-y-1/2 flex-col" : "bottom-28 inset-x-0 justify-center"} flex items-center gap-4`}>
            <Button variant="secondary" onClick={skipStep}><SkipForward size={16} /> Přeskočit</Button>
            <Button size="icon" onClick={handleShot} disabled={!stream || !cameraReady || !sessionId || !!pending} aria-label="Vyfotit"
              className="w-20 h-20 rounded-full border-4 border-border touch-manipulation"><Camera size={32} /></Button>
          </div>
          {[...queued].reverse().find(p => p.tip)?.tip && !pending && <p className={`absolute ${landscapeMode ? "bottom-28 left-3 max-w-xs" : "bottom-52 left-3 right-3"} bg-background/90 text-muted-foreground text-xs rounded-md px-3 py-2`}>{[...queued].reverse().find(p => p.tip)?.tip}</p>}
          <div className={`absolute bottom-0 z-20 bg-background/75 px-3 ${landscapeMode ? "left-0 right-40" : "inset-x-0"}`}
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <CaptureFilmstrip queue={queued} photos={photos} />
          </div>
          {pending && <div className="absolute inset-0 z-30 bg-background flex flex-col">
            <img src={pending.url} alt="Náhled pořízené fotografie" className="w-full flex-1 min-h-0 object-contain" />
            {pendingTip && <p className="text-sm text-center px-4 py-2 text-muted-foreground">{pendingTip}</p>}
            <div className="flex flex-wrap justify-center gap-3 p-4 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <Button variant="secondary" onClick={retakePending} disabled={accepting}><RotateCcw size={17} /> Vyfotit znovu</Button>
              <Button onClick={acceptPending} disabled={accepting}>{accepting ? <Loader2 className="animate-spin" size={17} /> : <Check size={17} />} Použít fotografii</Button>
            </div>
          </div>}
          {shutterFlash && <div className="absolute inset-0 bg-foreground/30 pointer-events-none" />}
        </div>
      )}

      {sessionId && sessionLoading && phase !== "capturing" && <div className="p-6 text-center"><Loader2 className="animate-spin mx-auto" /></div>}
      {sessionId && !sessionLoading && (sessionError || !session) && phase !== "capturing" && <div className="p-6 text-center text-foreground bg-background">
        <p>Relaci nelze otevřít. Zkontrolujte odkaz a přihlášení.</p>
        <Button variant="outline" className="mt-3" onClick={() => { setSessionId(undefined); setSearchParams({}); setPhase("intro"); }}>Seznam relací</Button>
      </div>}
      {phase === "review" && session && mobile && (
        <div className="flex-1 overflow-y-auto p-4 bg-background text-foreground">
          <h2 className="text-xl mb-4">Focení uloženo</h2>
          <CaptureFilmstrip queue={queued} photos={photos} />
          {queueCount > 0 && <p className="text-sm my-3">Nahrává se {queueCount} fotografií. Nechte tuto stránku otevřenou.</p>}
          {queued.some(p => p.status === "error") && <p className="text-sm my-3 text-destructive">Některé fotografie se nenahrály. Zkuste je znovu.</p>}
          {progressError && <Button variant="outline" onClick={() => saveProgress(progressRef.current)}>Znovu uložit průběh</Button>}
          <div className="flex flex-col gap-3 mt-6">
            <Button onClick={copyLink}><Copy /> Zkopírovat odkaz</Button>
            <Button variant="outline" onClick={() => { setCurrentStepIdx(Math.min(19, progress.next_step)); void handleStart(); }} disabled={starting}><Camera /> Pokračovat ve focení</Button>
          </div>
        </div>
      )}
      {/* Desktop review of the same session */}
      {phase === "review" && session && !mobile && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
              <Check size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-light mb-1">Galerie připravena</h2>
            <p className="text-muted-foreground text-sm">{photos.length} fotografií · {progress.skipped_steps.length} přeskočených kroků</p>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <Button variant="secondary" onClick={copyLink}><Copy /> Zkopírovat odkaz</Button>
            <Button variant="secondary" onClick={() => { setSessionId(undefined); setSearchParams({}); setPhase("intro"); void refetchSessions(); }}><List /> Seznam relací</Button>
          </div>
          <CaptureFilmstrip queue={queued} photos={photos} />
          {progressError && <Button variant="outline" onClick={() => saveProgress(progressRef.current)}>Znovu uložit průběh</Button>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {SHOT_SEQUENCE.map((step, index) => {
              if (photos.some(p => p.shot_type === step.type) || queued.some(p => p.shotType === step.type && p.status !== "error")) return null;
              return <div key={step.type} className="border border-border bg-background text-foreground rounded-md p-3">
                <div className="text-sm font-medium">{index + 1}. {step.label}</div>
                <p className="text-xs text-muted-foreground my-2">{progress.skipped_steps.includes(step.type) ? "Přeskočeno" : "Chybí fotografie"}</p>
                <Button size="sm" variant="outline" onClick={() => { completionStep.current = index; setCurrentStepIdx(index); fileInputRef.current?.click(); }}><ImageIcon size={14} /> Doplnit</Button>
              </div>;
            })}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const file = e.target.files?.[0];
            if (file) void acceptPhoto(file, completionStep.current ?? currentStepIdx);
            e.target.value = "";
          }} />
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
            <Button variant="outline" className="w-full" onClick={() => void saveVehicleInfo().then(() => toast({ title: "Údaje uloženy" })).catch(e => toast({ title: "Údaje se neuložily", description: String(e), variant: "destructive" }))}><Check size={16} /> Uložit údaje</Button>
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

            <Button onClick={() => handleExportZip()} disabled={busy || photos.length === 0 || !requiredInfoFilled || queued.some(p => p.status !== "done")}
              className="w-full bg-white text-black hover:bg-white/90 disabled:bg-white/30 disabled:text-white/60">
              {busy ? <Loader2 className="animate-spin mr-2" size={16} /> : <Download className="mr-2" size={16} />}
              {requiredInfoFilled
                ? "Exportovat ZIP (original + inzertní 1MB + web + info.txt)"
                : "Vyplňte povinné údaje o voze"}
            </Button>

            {/* Přeskočit info — dokončit i bez vyplnění */}
            {!requiredInfoFilled && (
              <Button onClick={() => handleExportZip({ skipInfo: true })} disabled={busy || photos.length === 0 || queued.some(p => p.status !== "done")}
                variant="outline"
                className="w-full border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200">
                <SkipForward className="mr-2" size={16} /> Přeskočit údaje a exportovat ZIP
              </Button>
            )}

            <Button variant="outline" onClick={async () => {
              setCurrentStepIdx(Math.min(19, progress.next_step)); await handleStart();
            }} className="w-full border-white/20 bg-transparent">
              <Camera className="mr-2" size={16} /> Pokračovat ve focení
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin")}
              className="w-full border-white/20 bg-transparent">
              Zavřít
            </Button>
          </div>


        </div>
      )}
    </div>
  );
}
