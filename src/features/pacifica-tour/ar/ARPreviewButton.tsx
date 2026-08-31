import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Box, Loader2, RotateCcw, X } from "lucide-react";
import { trackTourEvent } from "../lib/tourAnalytics";
import { buildShareUrl } from "../lib/tourUrlState";
import pacificaGlbAsset from "./pacifica.glb.asset.json";
import pacificaUsdzAsset from "./pacifica.usdz.asset.json";

/**
 * Základní modely Chrysler Pacifica.
 *
 * DŮLEŽITÉ:
 * Modely se používají PŘESNĚ TAK, jak byly dodány.
 * Žádná decimace, konverze, recompression ani změna geometrie.
 */
const MODEL_GLB = pacificaGlbAsset.url;
const MODEL_USDZ = pacificaUsdzAsset.url;

/**
 * Poster pro iOS Quick Look.
 * Musí existovat v public/pacifica/front.webp.
 */
const AR_POSTER = "/pacifica/front.webp";

const LOAD_TIMEOUT_MS = 30000;

export const AR_SPACE_HINT =
  "Vůz je 5,19 m dlouhý — namiřte telefon na podlahu a mějte kolem sebe alespoň 6 m volného místa.";

type Platform = "android" | "ios" | "other";
type Status = "idle" | "loading" | "ready" | "unsupported" | "error";
type ErrorReason = "timeout" | "network" | "generic" | null;

type Props = {
  onExitAR?: () => void;
  colorHex?: string | null;
  colorKey?: string;
  onWantLive?: () => void;
  autoStart?: boolean;
  variant?: "icon" | "pill";
  label?: string;
  vehicleId?: string;
  vehicleName?: string;
  showColorDisclaimer?: boolean;
  modelUrl?: string | null;
  usdzUrl?: string | null;
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
 * Ověření podpory AR Quick Look.
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

/**
 * Přenese zvolenou barvu pouze na materiály karoserie.
 *
 * GLB se fyzicky nemění.
 * Mění se pouze runtime materiál v model-viewer.
 */
const applyColor = (element: unknown, hex?: string | null) => {
  if (!hex) return;

  const model = (
    element as {
      model?: {
        materials?: unknown[];
      };
    } | null
  )?.model;

  const materials = model?.materials;

  if (!materials) return;

  const cleanHex = hex.replace("#", "");

  if (cleanHex.length !== 6) return;

  const rgb = [0, 2, 4].map(
    (offset) => parseInt(cleanHex.slice(offset, offset + 2), 16) / 255,
  );

  materials.forEach((raw) => {
    const material = raw as {
      name?: string;
      pbrMetallicRoughness?: {
        setBaseColorFactor?: (color: number[]) => void;
      };
    };

    const name = (material.name || "").toLowerCase();

    const isBody =
      name.includes("body") ||
      name.includes("paint") ||
      name.includes("carpaint") ||
      name.includes("exterior") ||
      name.includes("shell");

    if (!isBody) return;

    material.pbrMetallicRoughness?.setBaseColorFactor?.([
      ...rgb,
      1,
    ]);
  });
};

/**
 * Nastavení renderingu model-viewer.
 *
 * Cíl:
 * - maximální vizuální kvalita
 * - realistické PBR nasvícení
 * - kvalitní stíny
 * - žádná změna geometrie
 * - žádná decimace
 */
const configureHighQualityViewer = (element: unknown) => {
  const viewer = element as HTMLElement & {
    shadowIntensity?: number;
    shadowSoftness?: number;
    exposure?: number;
    environmentImage?: string;
    toneMapping?: string;
    interactionPrompt?: string;
    minCameraOrbit?: string;
    maxCameraOrbit?: string;
    fieldOfView?: string;
  };

  if (!viewer) return;

  viewer.setAttribute("tone-mapping", "aces");
  viewer.setAttribute("environment-image", "neutral");

  /**
   * Vyšší expozice pouze lehce.
   * Nepřehánět, aby se bílé části auta nepřepalovaly.
   */
  viewer.setAttribute("exposure", "1.05");

  /**
   * Výraznější, ale měkký kontakt se zemí.
   */
  viewer.setAttribute("shadow-intensity", "1.2");
  viewer.setAttribute("shadow-softness", "0.42");

  /**
   * Zabraňuje zbytečným animacím uživatelského promptu.
   */
  viewer.setAttribute("interaction-prompt", "none");

  /**
   * PBR modely vypadají lépe s kontrolovanou kamerou.
   */
  viewer.setAttribute("field-of-view", "26deg");

  /**
   * Necháme uživatele obejít celé auto.
   */
  viewer.setAttribute(
    "min-camera-orbit",
    "auto 20deg auto",
  );

  viewer.setAttribute(
    "max-camera-orbit",
    "auto 100deg auto",
  );
};

export const ARPreviewButton = ({
  onExitAR,
  colorHex = null,
  colorKey = "original",
  onWantLive,
  autoStart = false,
  variant = "icon",
  label = "Zobrazit v AR",
  vehicleId,
  vehicleName,
  showColorDisclaimer = false,
  modelUrl = null,
  usdzUrl = null,
}: Props) => {
  /**
   * Konkrétní model vozidla má vždy přednost.
   */
  const glbSrc = modelUrl || MODEL_GLB;
  const usdzBase = usdzUrl || MODEL_USDZ;

  /**
   * iOS Quick Look: allowsContentScaling=0 zamkne měřítko na 1:1,
   * takže model odpovídá reálným rozměrům vozu (5,19 m) a uživatel
   * ho nemůže omylem zvětšit/zmenšit gestem.
   */
  const usdzSrc = usdzBase.includes("#")
    ? usdzBase
    : `${usdzBase}#allowsContentScaling=0`;

  const analyticsMeta = useMemo(
    () => ({
      vehicle_id: vehicleId ?? null,
      vehicle_name: vehicleName ?? null,
      color_hex: colorHex ?? null,
    }),
    [vehicleId, vehicleName, colorHex],
  );

  const [platform, setPlatform] = useState<Platform>("other");
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] =
    useState<ErrorReason>(null);

  const [showSheet, setShowSheet] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showDesktopViewer, setShowDesktopViewer] =
    useState(false);

  const [viewerNeeded, setViewerNeeded] = useState(false);

  /**
   * Opravena logika:
   * afterAR se NESMÍ nastavovat při samotném spuštění iOS AR.
   *
   * Quick Look běží mimo DOM aplikace.
   * Proto zde nabídku pouze připravíme a zobrazíme ji až po návratu
   * do stránky přes visibilitychange/page focus.
   */
  const [afterAR, setAfterAR] = useState(false);

  const viewerRef = useRef<HTMLElement | null>(null);
  const desktopRef = useRef<HTMLElement | null>(null);

  const loadErrorRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const autoStartedRef = useRef(false);

  /**
   * Určuje, zda právě probíhá iOS Quick Look.
   */
  const iosARActiveRef = useRef(false);

  /**
   * Pomáhá rozlišit návrat z Quick Look od běžného
   * přepnutí karty/aplikace.
   */
  const iosARLaunchTimeRef = useRef(0);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  /**
   * Dynamické načtení model-viewer až při potřebě.
   */
  useEffect(() => {
    if (!viewerNeeded) return;

    void loadModelViewer().catch((error) => {
      console.error(
        "Nepodařilo se načíst @google/model-viewer:",
        error,
      );

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

  /**
   * iOS Quick Look:
   * když se uživatel vrátí do Safari po spuštění AR,
   * nabídneme další CTA.
   */
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        iosARActiveRef.current
      ) {
        const elapsed =
          Date.now() - iosARLaunchTimeRef.current;

        /**
         * Ignorujeme velmi rychlé přepnutí.
         * Reálný návrat z Quick Look má obvykle delší interval.
         */
        if (elapsed > 700) {
          iosARActiveRef.current = false;

          setAfterAR(true);

          trackTourEvent("ar_exit", {
            color: colorKey,
            meta: {
              platform: "ios",
              ...analyticsMeta,
            },
          });

          onExitAR?.();
        }
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    window.addEventListener("pageshow", handleVisibility);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );

      window.removeEventListener(
        "pageshow",
        handleVisibility,
      );
    };
  }, [analyticsMeta, colorKey, onExitAR]);

  /**
   * Android / desktop viewer.
   */
  useEffect(() => {
    const element = viewerRef.current;

    if (!element) return;

    configureHighQualityViewer(element);

    const onLoad = () => {
      loadErrorRef.current = false;

      configureHighQualityViewer(element);
      applyColor(element, colorHex);
    };

    const onError = (event: Event) => {
      loadErrorRef.current = true;

      console.error(
        "Nepodařilo se načíst AR model:",
        event,
      );

      clearLoadTimeout();

      setStatus((prev) =>
        prev === "loading" ? "error" : prev,
      );

      setErrorReason("network");
    };

    element.addEventListener("load", onLoad);
    element.addEventListener("error", onError);

    return () => {
      element.removeEventListener("load", onLoad);
      element.removeEventListener("error", onError);
    };
  }, [
    viewerNeeded,
    colorHex,
    clearLoadTimeout,
  ]);

  /**
   * Runtime nastavení barvy.
   */
  useEffect(() => {
    applyColor(viewerRef.current, colorHex);
    applyColor(desktopRef.current, colorHex);

    configureHighQualityViewer(viewerRef.current);
    configureHighQualityViewer(desktopRef.current);
  }, [
    colorHex,
    showDesktopViewer,
  ]);

  /**
   * Android AR.
   */
  const launchAndroidAR = useCallback(async () => {
    clearLoadTimeout();

    try {
      await loadModelViewer();

      await customElements.whenDefined(
        "model-viewer",
      );

      const element = viewerRef.current as
        | (HTMLElement & {
            canActivateAR?: boolean;
            activateAR?: () => Promise<void>;
          })
        | null;

      if (!element) {
        setStatus("error");
        setErrorReason("generic");
        return;
      }

      configureHighQualityViewer(element);

      if (!element.canActivateAR) {
        setStatus("unsupported");

        trackTourEvent("ar_unsupported", {
          meta: {
            platform: "android",
            ...analyticsMeta,
          },
        });

        return;
      }

      setStatus("ready");

      applyColor(element, colorHex);

      trackTourEvent("ar_launch", {
        color: colorKey,
        meta: {
          platform: "android",
          ...analyticsMeta,
        },
      });

      await element.activateAR?.();

      setShowSheet(false);
      setStatus("idle");
    } catch (error: unknown) {
      console.error(
        "AR aktivace selhala:",
        error,
      );

      setStatus("error");
      setErrorReason("generic");
    }
  }, [
    analyticsMeta,
    clearLoadTimeout,
    colorHex,
    colorKey,
  ]);

  /**
   * iOS Quick Look.
   *
   * Zásadní pravidlo:
   * žádný fetch
   * žádný blob:
   * žádný await před kliknutím
   * žádný programový click
   *
   * Safari dostane skutečný <a rel="ar">.
   */
  const launchIosAR = useCallback(() => {
    if (!supportsQuickLook()) {
      setStatus("unsupported");
      setShowSheet(true);

      trackTourEvent("ar_unsupported", {
        meta: {
          platform: "ios",
          ...analyticsMeta,
        },
      });

      return;
    }

    setErrorReason(null);
    setStatus("ready");

    /**
     * Zapamatujeme si, že právě spouštíme Quick Look.
     */
    iosARActiveRef.current = true;
    iosARLaunchTimeRef.current = Date.now();

    trackTourEvent("ar_launch", {
      color: colorKey,
      meta: {
        platform: "ios",
        ...analyticsMeta,
      },
    });

    /**
     * Přímý Quick Look anchor.
     */
    const link = document.createElement("a");

    link.rel = "ar";
    link.href = usdzSrc;

    /**
     * Safari Quick Look vyžaduje IMG jako prvního potomka.
     */
    const img = document.createElement("img");

    img.src = AR_POSTER;
    img.alt = "";
    img.width = 32;
    img.height = 32;

    link.appendChild(img);

    link.style.position = "fixed";
    link.style.left = "-9999px";
    link.style.top = "0";
    link.style.width = "32px";
    link.style.height = "32px";

    document.body.appendChild(link);

    /**
     * DŮLEŽITÉ:
     * click proběhne synchronně v rámci uživatelského gesta.
     */
    link.click();

    link.remove();
  }, [
    analyticsMeta,
    colorKey,
    usdzSrc,
  ]);

  /**
   * Hlavní aktivace.
   */
  const handleActivate = useCallback(() => {
    const currentPlatform = detectPlatform();

    trackTourEvent("ar_open", {
      color: colorKey,
      meta: {
        platform: currentPlatform,
        ...analyticsMeta,
      },
    });

    /**
     * Desktop:
     * zobrazíme kvalitní 3D viewer.
     */
    if (currentPlatform === "other") {
      setViewerNeeded(true);
      setShowDesktopViewer(true);

      return;
    }

    /**
     * iOS:
     * přímý Quick Look.
     */
    if (currentPlatform === "ios") {
      launchIosAR();

      return;
    }

    /**
     * Android.
     */
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

    void launchAndroidAR();
  }, [
    analyticsMeta,
    colorKey,
    launchAndroidAR,
    launchIosAR,
    startLoadTimeout,
  ]);

  /**
   * Deep-link ?ar=1.
   */
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;

    autoStartedRef.current = true;

    handleActivate();
  }, [
    autoStart,
    handleActivate,
  ]);

  const closeSheet = useCallback(() => {
    clearLoadTimeout();

    setShowSheet(false);
    setStatus("idle");
    setErrorReason(null);
  }, [clearLoadTimeout]);

  /**
   * Vizuální tlačítko.
   */
  const buttonClass =
    variant === "pill"
      ? `inline-flex h-11 items-center gap-2 rounded-full border border-primary/30
         bg-primary/10 px-4 text-xs font-semibold uppercase tracking-wider text-primary
         font-montserrat transition hover:bg-primary/20 focus-visible:outline-none
         focus-visible:ring-2 focus-visible:ring-primary active:scale-95`
      : `h-11 w-11 rounded-full border border-white/12 bg-white/8
         backdrop-blur-md grid place-items-center text-white/85
         transition hover:bg-white/16 focus-visible:outline-none
         focus-visible:ring-2 focus-visible:ring-primary active:scale-95`;

  /**
   * QR URL.
   */
  const shareUrl = useMemo(() => {
    if (!vehicleId) {
      return buildShareUrl({
        ar: true,
        color: colorKey,
      });
    }

    if (typeof window === "undefined") {
      return "";
    }

    const params = new URLSearchParams({
      ar: "1",
      utm_source: "qr",
      utm_medium: "vehicle-detail",
      utm_campaign: "vehicle-ar",
    });

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [
    vehicleId,
    colorKey,
  ]);

  /**
   * Handler pro přímý iOS anchor.
   */
  const handleIosAnchorClick = useCallback(() => {
    trackTourEvent("ar_open", {
      color: colorKey,
      meta: {
        platform: "ios",
        ...analyticsMeta,
      },
    });

    if (!supportsQuickLook()) {
      setStatus("unsupported");
      setShowSheet(true);

      trackTourEvent("ar_unsupported", {
        meta: {
          platform: "ios",
          ...analyticsMeta,
        },
      });

      return;
    }

    /**
     * Quick Look se nyní opravdu spouští.
     * afterAR se nastaví až při návratu.
     */
    iosARActiveRef.current = true;
    iosARLaunchTimeRef.current = Date.now();

    trackTourEvent("ar_launch", {
      color: colorKey,
      meta: {
        platform: "ios",
        ...analyticsMeta,
      },
    });
  }, [
    analyticsMeta,
    colorKey,
  ]);

  const ariaLabel =
    platform === "other"
      ? `Otevřít 3D náhled vozu${
          vehicleName
            ? ` ${vehicleName}`
            : ""
        }`
      : `Zobrazit vůz${
          vehicleName
            ? ` ${vehicleName}`
            : ""
        } v rozšířené realitě (AR)`;

  return (
    <>
      {/* --------------------------------------------------------------- */}
      {/* iOS AR QUICK LOOK                                               */}
      {/* --------------------------------------------------------------- */}

      {platform === "ios" ? (
        <a
          rel="ar"
          href={usdzSrc}
          aria-label={ariaLabel}
          title="Zobrazit v AR"
          className={`${buttonClass} relative overflow-hidden`}
          onClick={handleIosAnchorClick}
        >
          <img
            src={AR_POSTER}
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="absolute inset-0 h-full w-full object-cover opacity-0"
          />

          <Box className="pointer-events-none relative h-4 w-4" />

          {variant === "pill" && (
            <span className="relative">
              {label}
            </span>
          )}
        </a>
      ) : (
        <button
          type="button"
          onClick={handleActivate}
          aria-label={ariaLabel}
          className={buttonClass}
          title={
            platform === "other"
              ? "3D náhled vozu"
              : "Zobrazit v AR"
          }
        >
          <Box className="h-4 w-4" />

          {variant === "pill" && (
            <span>{label}</span>
          )}
        </button>
      )}

      {/* --------------------------------------------------------------- */}
      {/* ANDROID MODEL VIEWER                                           */}
      {/* --------------------------------------------------------------- */}

      {viewerNeeded &&
        platform === "android" && (
          <model-viewer
            ref={viewerRef as never}
            src={glbSrc}
            ios-src={usdzSrc}
            ar
            ar-modes="webxr scene-viewer quick-look"
            ar-scale="fixed"
            ar-placement="floor"
            xr-environment
            environment-image="neutral"
            tone-mapping="aces"
            exposure="1.05"
            shadow-intensity="1.2"
            shadow-softness="0.42"
            interaction-prompt="none"
            camera-controls
            loading="eager"
            alt="3D model vozu pro AR náhled"
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

      {/* --------------------------------------------------------------- */}
      {/* STATUS SHEET                                                   */}
      {/* --------------------------------------------------------------- */}

      {showSheet &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            onClick={closeSheet}
          >
            <div
              className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-[#0b0d12] p-5 text-center shadow-2xl sm:rounded-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
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

                  <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                    {AR_SPACE_HINT}
                  </p>
                </>
              )}

              {status === "ready" && (
                <>
                  {platform === "ios" ? (
                    <>
                      <p className="text-sm text-white/85">
                        AR náhled je připraven
                      </p>

                      <p className="mt-1 text-xs text-white/40">
                        Pokud se AR nespustilo automaticky,
                        klepněte na tlačítko níže.
                      </p>

                      {showColorDisclaimer && (
                        <p className="mt-2 text-[11px] leading-relaxed text-amber-300/80">
                          Na iPhonu se zobrazí model v
                          základní barvě — rozměry i tvar
                          odpovídají skutečnému vozu.
                        </p>
                      )}

                      <a
                        rel="ar"
                        href={usdzSrc}
                        onClick={handleIosAnchorClick}
                        className="relative mt-3 flex h-11 w-full items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                      >
                        <img
                          src={AR_POSTER}
                          alt=""
                          aria-hidden="true"
                          width={32}
                          height={32}
                          className="absolute inset-0 h-full w-full object-cover opacity-0"
                        />

                        <span className="relative">
                          Spustit AR
                        </span>
                      </a>
                    </>
                  ) : (
                    <>
                      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />

                      <p className="text-sm text-white/85">
                        Spouštíme AR…
                      </p>
                    </>
                  )}

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
                    Zařízení nepodporuje potřebné AR
                    funkce. Vůz si můžete prohlédnout
                    ve 3D.
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
                    {errorReason === "timeout" ||
                    errorReason === "network"
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

      {/* --------------------------------------------------------------- */}
      {/* DESKTOP / TABLET 3D VIEWER                                    */}
      {/* --------------------------------------------------------------- */}

      {showDesktopViewer &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() =>
              setShowDesktopViewer(false)
            }
          >
            <div
              className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d12] shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="flex items-start justify-between gap-3 px-5 pt-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.3em] text-primary">
                    3D náhled
                  </p>

                  <h2 className="mt-0.5 font-serif text-lg text-white">
                    {vehicleName ?? (
                      <>
                        Chrysler{" "}
                        <span className="italic">
                          Pacifica
                        </span>
                      </>
                    )}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowDesktopViewer(false)
                  }
                  aria-label="Zavřít 3D náhled"
                  className="grid h-9 w-9 place-items-center rounded-full text-white/50 transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <model-viewer
                ref={desktopRef as never}
                src={glbSrc}
                alt="Otočitelný 3D model vozu"
                camera-controls
                auto-rotate
                auto-rotate-delay="1200"
                rotation-per-second="10deg"
                interaction-prompt="none"
                environment-image="neutral"
                tone-mapping="aces"
                exposure="1.05"
                shadow-intensity="1.2"
                shadow-softness="0.42"
                camera-orbit="35deg 76deg 82%"
                min-camera-orbit="auto 20deg auto"
                max-camera-orbit="auto 100deg auto"
                field-of-view="26deg"
                loading="eager"
                style={{
                  width: "100%",
                  height: "min(56vh, 460px)",
                  background: "transparent",
                }}
              />

              <div className="flex flex-col items-center gap-4 border-t border-white/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[11px] text-white/45">
                  <RotateCcw className="h-3.5 w-3.5" />

                  Táhnutím myší vůz otočíte,
                  kolečkem přibližujete.
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white p-1.5">
                    <QRCodeSVG
                      value={shareUrl}
                      size={64}
                    />
                  </div>

                  <p className="max-w-[190px] text-[11px] leading-relaxed text-white/55">
                    Nebo si vůz postavte k sobě domů —
                    naskenujte kód mobilem a spustí se AR.
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* --------------------------------------------------------------- */}
      {/* QR                                                               */}
      {/* --------------------------------------------------------------- */}

      {showQR &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
          >
            <div
              className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#0b0d12] p-6 text-center shadow-2xl"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="mx-auto mb-4 w-fit rounded-xl bg-white p-3">
                <QRCodeSVG
                  value={shareUrl}
                  size={168}
                />
              </div>

              <p className="text-sm text-white/85">
                Naskenujte mobilem
              </p>
            </div>
          </div>,
          document.body,
        )}

      {/* --------------------------------------------------------------- */}
      {/* AFTER AR                                                        */}
      {/* --------------------------------------------------------------- */}

      {afterAR &&
        onWantLive &&
        createPortal(
          <div className="fixed inset-x-0 bottom-0 z-[65] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/12 bg-[#0b0d12]/95 p-3 shadow-2xl backdrop-blur-xl">
              <p className="flex-1 text-[12px] leading-snug text-white/80">
                Chcete{" "}
                {vehicleName || "tento vůz"} vidět
                i naživo v Pardubicích?
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
                onClick={() =>
                  setAfterAR(false)
                }
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
