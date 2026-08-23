import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Box, Loader2, RotateCcw, X } from "lucide-react";
import { trackTourEvent } from "../lib/tourAnalytics";
import { buildShareUrl } from "../lib/tourUrlState";
import usdzAsset from "./pacifica.usdz.asset.json";

const MODEL_GLB = "/models/pacifica.glb";
/** USDZ pro AR Quick Look — externí asset (same-origin URL, bez CORS). */
const MODEL_USDZ = usdzAsset.url;
/** AR Quick Look poster — viz poznámka u <a rel="ar"> níže. */
const AR_POSTER = "/pacifica-hero.webp";

/** Pouze pojistka při opravdu pomalém nebo přerušeném načítání. */
const LOAD_TIMEOUT_MS = 30000;

/** Reálné rozměry vozu — uživatel musí vědět, kolik místa potřebuje. */
export const AR_SPACE_HINT =
  "Vůz je 5,19 m dlouhý — namiřte telefon na podlahu a mějte kolem sebe alespoň 6 m volného místa.";

type Platform = "android" | "ios" | "other";
type Status = "idle" | "loading" | "ready" | "unsupported" | "error";
type ErrorReason = "timeout" | "network" | "generic" | null;

type Props = {
  onExitAR?: () => void;
  /** Barva laku zvolená v prohlídce (hex) — přenese se do AR na Androidu. */
  colorHex?: string | null;
  /** Klíč barvy pro deep-link a měření. */
  colorKey?: string;
  /** Otevře poptávkový formulář po ukončení AR. */
  onWantLive?: () => void;
  /** Automatické spuštění AR (deep-link ?ar=1). */
  autoStart?: boolean;
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

/**
 * iOS/iPadOS: AR Quick Look funguje jen tam, kde Safari umí `rel="ar"`.
 * Starší iPady a iPady bez podpory AR odkaz jen otevřou jako soubor —
 * proto podporu ověřujeme přes relList a uživatele informujeme,
 * místo aby skončil u mlčícího prázdného okna.
 */
const supportsQuickLook = (): boolean => {
  if (typeof document === "undefined") return false;

  const link = document.createElement("a");
  return !!link.relList?.supports?.("ar");
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

/** Přebarví lak v model-viewer scéně (Android AR i desktop náhled). */
const applyColor = (element: unknown, hex?: string | null) => {
  if (!hex) return;

  const model = (element as { model?: { materials?: unknown[] } } | null)?.model;
  const materials = model?.materials;

  if (!materials) return;

  const rgb = [1, 3, 5].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );

  materials.forEach((raw) => {
    const material = raw as {
      name?: string;
      pbrMetallicRoughness?: {
        setBaseColorFactor?: (color: number[]) => void;
      };
    };

    const name = (material.name || "").toLowerCase();

    if (!name.includes("body") && !name.includes("paint")) return;

    material.pbrMetallicRoughness?.setBaseColorFactor?.([...rgb, 1]);
  });
};

export const ARPreviewButton = ({
  onExitAR,
  colorHex = null,
  colorKey = "original",
  onWantLive,
  autoStart = false,
}: Props) => {
  const [platform, setPlatform] = useState<Platform>("other");
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] = useState<ErrorReason>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showDesktopViewer, setShowDesktopViewer] = useState(false);
  const [viewerNeeded, setViewerNeeded] = useState(false);
  const [iosProgress, setIosProgress] = useState(0);
  const [afterAR, setAfterAR] = useState(false);

  const viewerRef = useRef<HTMLElement | null>(null);
  const desktopRef = useRef<HTMLElement | null>(null);
  const loadErrorRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const usdzUrlRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  /* --------------------------------------------------------------------- */
  /* model-viewer: načítáme AŽ když je potřeba (žádných 3,3 MB předem)     */
  /* --------------------------------------------------------------------- */

  useEffect(() => {
    if (!viewerNeeded) return;

    void loadModelViewer().catch((error) => {
      console.error("Nepodařilo se načíst @google/model-viewer:", error);
      loadErrorRef.current = true;
    });
  }, [viewerNeeded]);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    timeoutRef.current = window.setTimeout(() => {
      setStatus("error");
      setErrorReason("timeout");
    }, LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  useEffect(() => clearLoadTimeout, [clearLoadTimeout]);

  useEffect(
    () => () => {
      if (usdzUrlRef.current) URL.revokeObjectURL(usdzUrlRef.current);
    },
    [],
  );

  /* --------------------------------------------------------------------- */
  /* Skrytý model-viewer (Android) — listenery bez JSX onLoad/onError      */
  /* --------------------------------------------------------------------- */

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) return;

    const onLoad = () => {
      loadErrorRef.current = false;
      applyColor(element, colorHex);
    };

    const onError = (event: Event) => {
      loadErrorRef.current = true;
      console.error("Nepodařilo se načíst AR model:", event);

      clearLoadTimeout();
      setStatus((prev) => (prev === "loading" ? "error" : prev));
      setErrorReason("network");
    };

    element.addEventListener("load", onLoad);
    element.addEventListener("error", onError);

    return () => {
      element.removeEventListener("load", onLoad);
      element.removeEventListener("error", onError);
    };
  }, [viewerNeeded, colorHex, clearLoadTimeout]);

  useEffect(() => {
    applyColor(viewerRef.current, colorHex);
    applyColor(desktopRef.current, colorHex);
  }, [colorHex, showDesktopViewer]);

  /* --------------------------------------------------------------------- */
  /* Android                                                              */
  /* --------------------------------------------------------------------- */

  const launchAndroidAR = useCallback(async () => {
    clearLoadTimeout();

    try {
      await loadModelViewer();
      await customElements.whenDefined("model-viewer");

      const element = viewerRef.current as
        | (HTMLElement & { canActivateAR?: boolean; activateAR?: () => Promise<void> })
        | null;

      if (!element) {
        setStatus("error");
        setErrorReason("generic");
        return;
      }

      // Jediný zdroj pravdy o podpoře AR — žádný seznam konkrétních telefonů.
      if (!element.canActivateAR) {
        setStatus("unsupported");
        trackTourEvent("ar_unsupported", { meta: { platform: "android" } });
        return;
      }

      setStatus("ready");
      applyColor(element, colorHex);

      trackTourEvent("ar_launch", {
        color: colorKey,
        meta: { platform: "android" },
      });

      await element.activateAR?.();

      setShowSheet(false);
      setStatus("idle");
      setAfterAR(true);
      trackTourEvent("ar_exit", { color: colorKey, meta: { platform: "android" } });
      onExitAR?.();
    } catch (error: unknown) {
      console.error("AR aktivace selhala:", error);
      setStatus("error");
      setErrorReason("generic");
    }
  }, [clearLoadTimeout, colorHex, colorKey, onExitAR]);

  /* --------------------------------------------------------------------- */
  /* iOS — s progresem, ne mlčící klik                                     */
  /* --------------------------------------------------------------------- */

  const launchIosAR = useCallback(async () => {
    if (!supportsQuickLook()) {
      setStatus("unsupported");
      setShowSheet(true);
      trackTourEvent("ar_unsupported", { meta: { platform: "ios" } });
      return;
    }

    setStatus("loading");
    setErrorReason(null);
    setIosProgress(0);
    setShowSheet(true);
    startLoadTimeout();

    try {
      const response = await fetch(MODEL_USDZ);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const total = Number(response.headers.get("content-length") || 0);
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          chunks.push(value);
          received += value.byteLength;

          if (total) setIosProgress(Math.min(99, Math.round((received / total) * 100)));
        }
      }

      const blob = reader
        ? new Blob(chunks as BlobPart[], { type: "model/vnd.usdz+zip" })
        : await response.blob();

      clearLoadTimeout();
      setIosProgress(100);

      if (usdzUrlRef.current) URL.revokeObjectURL(usdzUrlRef.current);
      usdzUrlRef.current = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.rel = "ar";
      link.href = usdzUrlRef.current;

      // Safari spustí Quick Look jen tehdy, když je prvním potomkem <img>.
      const img = document.createElement("img");
      img.src = AR_POSTER;
      img.alt = "";
      link.appendChild(img);

      document.body.appendChild(link);

      trackTourEvent("ar_launch", { color: colorKey, meta: { platform: "ios" } });

      link.click();
      link.remove();

      setStatus("idle");
      setShowSheet(false);
      setAfterAR(true);
      trackTourEvent("ar_exit", { color: colorKey, meta: { platform: "ios" } });
      onExitAR?.();
    } catch (error) {
      console.error("AR Quick Look selhal:", error);
      clearLoadTimeout();
      setStatus("error");
      setErrorReason("network");
    }
  }, [clearLoadTimeout, colorKey, onExitAR, startLoadTimeout]);

  /* --------------------------------------------------------------------- */

  const handleActivate = useCallback(() => {
    const currentPlatform = detectPlatform();

    trackTourEvent("ar_open", {
      color: colorKey,
      meta: { platform: currentPlatform },
    });

    if (currentPlatform === "other") {
      setViewerNeeded(true);
      setShowDesktopViewer(true);
      return;
    }

    if (currentPlatform === "ios") {
      void launchIosAR();
      return;
    }

    if (loadErrorRef.current) {
      setStatus("error");
      setErrorReason("network");
      setShowSheet(true);
      return;
    }

    setViewerNeeded(true);
    setStatus("loading");
    setErrorReason(null);
    setShowSheet(true);
    startLoadTimeout();

    // Nečekáme na kompletní onLoad GLB. Scene Viewer si model načte sám.
    void launchAndroidAR();
  }, [colorKey, launchAndroidAR, launchIosAR, startLoadTimeout]);

  /* Deep-link ?ar=1 → AR se pokusí spustit samo.
     Na desktopu se místo AR otevře 3D náhled s QR kódem pro přenos do mobilu. */
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;

    autoStartedRef.current = true;
    handleActivate();
  }, [autoStart, handleActivate]);

  const closeSheet = useCallback(() => {
    clearLoadTimeout();
    setShowSheet(false);
    setStatus("idle");
    setErrorReason(null);
  }, [clearLoadTimeout]);

  const buttonClass = `
    h-11 w-11 rounded-full border border-white/12 bg-white/8
    backdrop-blur-md grid place-items-center text-white/85
    transition hover:bg-white/16 focus-visible:outline-none
    focus-visible:ring-2 focus-visible:ring-primary active:scale-95
  `;

  return (
    <>
      <button
        type="button"
        onClick={handleActivate}
        aria-label={
          platform === "other"
            ? "Otevřít 3D náhled vozu"
            : "Zobrazit vůz v rozšířené realitě (AR)"
        }
        className={buttonClass}
        title={platform === "other" ? "3D náhled vozu" : "Zobrazit v AR"}
      >
        <Box className="h-4 w-4" />
      </button>

      {viewerNeeded && platform === "android" && (
        <model-viewer
          ref={viewerRef as never}
          src={MODEL_GLB}
          ios-src={MODEL_USDZ}
          ar
          ar-modes="scene-viewer quick-look"
          ar-scale="fixed"
          ar-placement="floor"
          alt="Chrysler Pacifica — 3D model pro AR náhled"
          loading="lazy"
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
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            onClick={closeSheet}
          >
            <div
              className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-[#0b0d12] p-5 text-center shadow-2xl sm:rounded-2xl"
              onClick={(event) => event.stopPropagation()}
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
                  <p className="text-sm text-white/85">Připravujeme AR náhled…</p>

                  {platform === "ios" && (
                    <>
                      <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/12">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-200"
                          style={{ width: `${Math.max(4, iosProgress)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-white/40">
                        Stahujeme AR model {iosProgress > 0 ? `(${iosProgress} %)` : ""}
                      </p>
                    </>
                  )}

                  <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                    {AR_SPACE_HINT}
                  </p>
                </>
              )}

              {status === "ready" && (
                <>
                  <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-white/85">Spouštíme AR…</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                    {AR_SPACE_HINT}
                  </p>
                </>
              )}

              {status === "unsupported" && (
                <>
                  <p className="text-sm text-white/85">
                    AR náhled na tomto zařízení není dostupný.
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Zařízení nepodporuje AR (ARCore na Androidu, AR Quick Look na
                    iPhonu/iPadu). Vůz si můžete prohlédnout ve 3D prohlídce.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      closeSheet();
                      setViewerNeeded(true);
                      setShowDesktopViewer(true);
                    }}
                    className="mt-3 h-10 w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  >
                    Otevřít 3D náhled
                  </button>
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
                      ? "Zkontrolujte připojení k internetu a zkuste to znovu."
                      : "Zkuste to prosím znovu."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("idle");
                      setErrorReason(null);
                      handleActivate();
                    }}
                    className="mt-3 h-10 w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  >
                    Zkusit znovu
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Desktop: skutečný 3D náhled, QR kód je jen doplněk. */}
      {showDesktopViewer &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setShowDesktopViewer(false)}
          >
            <div
              className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d12] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 px-5 pt-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-primary">
                    3D náhled
                  </p>
                  <h2 className="mt-0.5 font-serif text-lg text-white">
                    Chrysler <span className="italic">Pacifica</span>
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDesktopViewer(false)}
                  aria-label="Zavřít 3D náhled"
                  className="grid h-9 w-9 place-items-center rounded-full text-white/50 transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <model-viewer
                ref={desktopRef as never}
                src={MODEL_GLB}
                alt="Chrysler Pacifica — otočitelný 3D model"
                camera-controls
                auto-rotate
                auto-rotate-delay="600"
                rotation-per-second="14deg"
                interaction-prompt="none"
                environment-image="neutral"
                tone-mapping="aces"
                shadow-intensity="1.15"
                shadow-softness="0.7"
                exposure="1"
                camera-orbit="35deg 78deg 105%"
                min-camera-orbit="auto 25deg auto"
                max-camera-orbit="auto 90deg 140%"
                field-of-view="28deg"
                loading="eager"
                style={{
                  width: "100%",
                  height: "min(56vh, 420px)",
                  background: "transparent",
                }}
              />


              <div className="flex flex-col items-center gap-4 border-t border-white/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[11px] text-white/45">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Táhnutím myší vůz otočíte, kolečkem přibližujete.
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white p-1.5">
                    <QRCodeSVG value={buildShareUrl({ ar: true, color: colorKey })} size={64} />
                  </div>

                  <p className="max-w-[190px] text-[11px] leading-relaxed text-white/55">
                    Nebo si vůz postavte k sobě domů — naskenujte kód mobilem
                    a spustí se AR.
                  </p>
                </div>
              </div>
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
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 w-fit rounded-xl bg-white p-3">
                <QRCodeSVG value={buildShareUrl({ ar: true, color: colorKey })} size={168} />
              </div>

              <p className="text-sm text-white/85">Naskenujte mobilem</p>
            </div>
          </div>,
          document.body,
        )}

      {/* Po ukončení AR — nejsilnější „wow“ moment, hned nabídneme prohlídku naživo. */}
      {afterAR &&
        onWantLive &&
        createPortal(
          <div className="fixed inset-x-0 bottom-0 z-[65] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/12 bg-[#0b0d12]/95 p-3 shadow-2xl backdrop-blur-xl">
              <p className="flex-1 text-[12px] leading-snug text-white/80">
                Chcete Pacificu vidět i naživo v Pardubicích?
              </p>

              <button
                type="button"
                onClick={() => {
                  setAfterAR(false);
                  onWantLive();
                }}
                className="h-10 shrink-0 rounded-full bg-primary px-4 text-[12px] font-semibold text-primary-foreground"
              >
                Chci ji vidět
              </button>

              <button
                type="button"
                onClick={() => setAfterAR(false)}
                aria-label="Zavřít nabídku"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/45 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default ARPreviewButton;
