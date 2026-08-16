import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Box, Loader2, X } from "lucide-react";

const MODEL_GLB = "/models/pacifica.glb";
const MODEL_USDZ = "/models/pacifica.usdz";

/** Kolik ms čekáme na stažení modelu po kliknutí, než ukážeme chybu. */
const LOAD_TIMEOUT_MS = 15000;

type Platform = "android" | "ios" | "other";
type Status = "idle" | "loading" | "ready" | "unsupported" | "error";
type ErrorReason = "timeout" | "network" | "generic" | null;

type Props = {
  onExitAR?: () => void;
};

const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent || "";

  if (/android/i.test(ua)) return "android";

  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);

  if (isIOS) return "ios";

  return "other";
};

let modelViewerLoaded = false;
let modelViewerLoading: Promise<void> | null = null;

const loadModelViewer = () => {
  if (modelViewerLoaded) return Promise.resolve();
  if (modelViewerLoading) return modelViewerLoading;

  modelViewerLoading = import("@google/model-viewer")
    .then(() => {
      modelViewerLoaded = true;
    })
    .catch((error) => {
      modelViewerLoading = null;
      throw error;
    });

  return modelViewerLoading;
};

export const ARPreviewButton = ({ onExitAR }: Props) => {
  const [platform, setPlatform] = useState<Platform>("other");
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] = useState<ErrorReason>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);

  const viewerRef = useRef<any>(null);
  const modelLoadedRef = useRef(false);
  // Zaznamená, jestli model-viewer nahlásil chybu ještě předtím, než uživatel
  // vůbec klikl (model se stahuje na pozadí hned od začátku).
  const loadErrorRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    void loadModelViewer().catch((error) => {
      console.error("Nepodařilo se načíst @google/model-viewer:", error);
      loadErrorRef.current = true;
    });
  }, []);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Timeout se stará jen o to, aby uživatel nekoukal na "Připravujeme AR
  // náhled…" donekonečna, pokud se model kvůli slabému/výpadku připojení
  // nikdy nestáhne a nepřijde ani onLoad, ani onError.
  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    timeoutRef.current = window.setTimeout(() => {
      setStatus("error");
      setErrorReason("timeout");
    }, LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  useEffect(() => clearLoadTimeout, [clearLoadTimeout]);

  const handleViewerLoad = useCallback(() => {
    modelLoadedRef.current = true;
    loadErrorRef.current = false;
    setViewerReady(true);
  }, []);

  const handleViewerError = useCallback((event: Event) => {
    modelLoadedRef.current = false;
    loadErrorRef.current = true;
    setViewerReady(false);
    console.error("Nepodařilo se načíst AR model:", event);

    // Pokud uživatel právě čeká (sheet je otevřený), rovnou mu to ukážeme.
    clearLoadTimeout();
    setStatus((prev) => (prev === "loading" ? "error" : prev));
    setErrorReason("network");
  }, [clearLoadTimeout]);

  /** Skutečné spuštění AR -- voláno buď hned po kliknutí (model je
   *  už připravený), nebo automaticky, jakmile se model dostáhne. */
  const launchAR = useCallback(() => {
    clearLoadTimeout();
    const el = viewerRef.current;

    if (!el) {
      setStatus("error");
      setErrorReason("generic");
      return;
    }

    if (!el.canActivateAR) {
      setStatus("unsupported");
      return;
    }

    setStatus("ready");

    void el
      .activateAR()
      .then(() => {
        setShowSheet(false);
        setStatus("idle");
        onExitAR?.();
      })
      .catch((error: unknown) => {
        console.error("AR aktivace selhala:", error);
        setStatus("error");
        setErrorReason("generic");
      });
  }, [clearLoadTimeout, onExitAR]);

  const handleActivate = useCallback(() => {
    const currentPlatform = detectPlatform();

    if (currentPlatform === "other") {
      setShowQR(true);
      return;
    }

    if (!viewerRef.current) {
      setStatus("error");
      setErrorReason("generic");
      setShowSheet(true);
      return;
    }

    if (loadErrorRef.current) {
      setStatus("error");
      setErrorReason("network");
      setShowSheet(true);
      return;
    }

    if (modelLoadedRef.current && viewerReady) {
      setShowSheet(true);
      launchAR();
      return;
    }

    // Model se ještě stahuje -- ukázat loading a počkat na dokončení.
    // Automatické pokračování zajišťuje useEffect níže (sleduje viewerReady).
    setStatus("loading");
    setErrorReason(null);
    setShowSheet(true);
    startLoadTimeout();
  }, [viewerReady, launchAR, startLoadTimeout]);

  // Jakmile se model doráhne na pozadí PO kliknutí (uživatel čeká na
  // obrazovce "Připravujeme AR náhled…"), automaticky pokračovat k AR.
  useEffect(() => {
    if (viewerReady && showSheet && status === "loading") {
      launchAR();
    }
  }, [viewerReady, showSheet, status, launchAR]);

  const closeSheet = useCallback(() => {
    clearLoadTimeout();
    setShowSheet(false);
    setStatus("idle");
    setErrorReason(null);
  }, [clearLoadTimeout]);

  return (
    <>
      <button
        type="button"
        onClick={handleActivate}
        aria-label="Zobrazit vůz v rozšířené realitě (AR)"
        className="
          h-11 w-11 rounded-full border border-white/12 bg-white/8
          backdrop-blur-md grid place-items-center text-white/85
          transition hover:bg-white/16 focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-primary active:scale-95
        "
        title="Zobrazit v AR"
      >
        <Box className="h-4 w-4" />
      </button>

      {platform !== "other" && (
        <model-viewer
          ref={viewerRef}
          src={MODEL_GLB}
          ios-src={MODEL_USDZ}
          ar
          ar-modes="scene-viewer quick-look"
          ar-scale="fixed"
          ar-placement="floor"
          alt="Chrysler Pacifica — 3D model pro AR náhled"
          onLoad={handleViewerLoad}
          onError={handleViewerError}
          style={{
            position: "fixed",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
            left: 0,
            top: 0,
          }}
        />
      )}

      {showSheet &&
        createPortal(
          <div
            className="
              fixed inset-0 z-[60] flex items-end justify-center
              bg-black/60 backdrop-blur-sm sm:items-center
            "
            onClick={closeSheet}
          >
            <div
              className="
                w-full max-w-sm rounded-t-2xl sm:rounded-2xl
                border border-white/10 bg-[#0b0d12] p-5 text-center
                shadow-2xl
              "
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Zavřít"
                className="ml-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>

              {status === "loading" && (
                <>
                  <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-white/85">
                    Připravujeme AR náhled…
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Model se ještě načítá (cca 20&nbsp;MB).
                  </p>
                </>
              )}

              {status === "ready" && (
                <>
                  <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-white/85">
                    Spouštíme AR…
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Za chvíli se otevře AR náhled.
                  </p>
                </>
              )}

              {status === "unsupported" && (
                <>
                  <p className="text-sm text-white/85">
                    AR náhled na tomto zařízení není dostupný.
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Zkuste kompatibilní Android s ARCore nebo iPhone/iPad
                    s podporou AR Quick Look.
                  </p>
                </>
              )}

              {status === "error" && (
                <>
                  <p className="text-sm text-white/85">
                    {errorReason === "timeout"
                      ? "Model se nepodařilo načíst včas."
                      : errorReason === "network"
                        ? "Model se nepodařilo stáhnout."
                        : "AR náhled se nepodařilo spustit."}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    {errorReason === "timeout" || errorReason === "network"
                      ? "Zkontrolujte připojení k internetu (model má cca 20\u00a0MB) a zkuste to znovu."
                      : "Zkuste to prosím znovu."}
                  </p>
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="mt-3 h-9 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
                  >
                    Zavřít
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {showQR &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          >
            <div
              className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#0b0d12] p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowQR(false)}
                aria-label="Zavřít"
                className="ml-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mx-auto mb-4 w-fit rounded-xl bg-white p-3">
                <QRCodeSVG
                  value={
                    typeof window !== "undefined"
                      ? window.location.href
                      : ""
                  }
                  size={168}
                />
              </div>

              <p className="text-sm text-white/85">
                Naskenujte mobilem
              </p>
              <p className="mt-1 text-xs text-white/40">
                AR náhled funguje na kompatibilním Androidu nebo iPhonu/iPadu.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default ARPreviewButton;
