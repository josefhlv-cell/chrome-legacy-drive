import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Box, Loader2, RotateCcw, X } from "lucide-react";
import { trackTourEvent } from "../lib/tourAnalytics";
import { buildShareUrl } from "../lib/tourUrlState";

const MODEL_GLB = "/models/pacifica.glb";
/**
 * USDZ pro AR Quick Look.
 *
 * POZOR: NEPOUŽÍVAT asset CDN (/__l5e/assets-v1/...). CDN soubor servíruje jako
 * `application/zip` + `X-Content-Type-Options: nosniff`, takže Safari AR
 * Quick Look model odmítne a overlay zůstane prázdný ("AR se spustí, ale
 * model není vidět"). Tato URL je edge funkce `ar-model`, která stejný soubor
 * doručí jako `model/vnd.usdz+zip` a cesta končí na `.usdz`, jak Quick Look
 * vyžaduje.
 */
const MODEL_USDZ =
  "https://thqyzghifwmwohgfvshf.supabase.co/functions/v1/ar-model/pacifica-v3.usdz";
/** AR Quick Look poster — viz poznámka u <a rel="ar"> níže. */
const AR_POSTER = "/pacifica/front.webp";


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
  /** Vzhled spouštěče: kruhová ikona (prohlídka) nebo pill s textem (detail vozu). */
  variant?: "icon" | "pill";
  /** Text pro pill variantu. */
  label?: string;
  /** ID konkrétního vozu — jen pro měření (tour_events.meta). */
  vehicleId?: string;
  /** Název konkrétního vozu — titulek 3D náhledu a měření. */
  vehicleName?: string;
  /**
   * Zobrazí upozornění, že na iPhonu je barva vozu jen ilustrační.
   * iOS AR Quick Look barvu statického USDZ měnit neumí.
   */
  showColorDisclaimer?: boolean;
  /**
   * GLB konkrétního vozu vygenerovaný v /admin/3d-generator.
   * Když chybí, použije se základní model Pacifiky.
   */
  modelUrl?: string | null;
  /**
   * USDZ konkrétního vozu pro iOS AR Quick Look. iPhone neumí GLB, takže
   * bez tohoto souboru by se na iOS zobrazil generický bílý model.
   */
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
  variant = "icon",
  label = "Zobrazit v AR",
  vehicleId,
  vehicleName,
  showColorDisclaimer = false,
  modelUrl = null,
  usdzUrl = null,
}: Props) => {
  /** Vlastní model vozu má přednost před generickou Pacificou. */
  const glbSrc = modelUrl || MODEL_GLB;
  /** USDZ konkrétního vozu (iOS Quick Look) — jinak generická Pacifica. */
  const usdzSrc = usdzUrl || MODEL_USDZ;


  /**
   * Společná měřicí data. U konkrétního vozu chceme v adminu vidět,
   * které auto si lidi v AR staví k sobě — proto vehicle_id i barva.
   */
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
        trackTourEvent("ar_unsupported", { meta: { platform: "android", ...analyticsMeta } });
        return;
      }

      setStatus("ready");
      applyColor(element, colorHex);

      trackTourEvent("ar_launch", {
        color: colorKey,
        meta: { platform: "android", ...analyticsMeta },
      });

      await element.activateAR?.();

      setShowSheet(false);
      setStatus("idle");
      setAfterAR(true);
      trackTourEvent("ar_exit", { color: colorKey, meta: { platform: "android", ...analyticsMeta } });
      onExitAR?.();
    } catch (error: unknown) {
      console.error("AR aktivace selhala:", error);
      setStatus("error");
      setErrorReason("generic");
    }
  }, [analyticsMeta, clearLoadTimeout, colorHex, colorKey, onExitAR]);

  /* --------------------------------------------------------------------- */
  /* iOS — AR Quick Look musí startovat SYNCHRONNĚ z uživatelského gesta.  */
  /*                                                                       */
  /* Dřív jsme USDZ stahovali fetchem, dělali z něj blob: URL a na ni      */
  /* klikali. To na iPhonu nikdy nemohlo fungovat:                        */
  /*  1) Quick Look potřebuje reálnou URL končící na .usdz — blob: URL     */
  /*     bez přípony Safari ignoruje (klik prostě „nic neudělá“).          */
  /*  2) Klik po `await` už není v user-gesture okně, takže ho Safari      */
  /*     zablokuje jako programový.                                        */
  /* Teď klikáme okamžitě na anchor s přímou .usdz URL a v sheetu držíme   */
  /* i ruční odkaz jako záložní cestu.                                     */
  /* --------------------------------------------------------------------- */

  const launchIosAR = useCallback(() => {
    if (!supportsQuickLook()) {
      setStatus("unsupported");
      setShowSheet(true);
      trackTourEvent("ar_unsupported", { meta: { platform: "ios", ...analyticsMeta } });
      return;
    }

    setErrorReason(null);
    setStatus("ready");
    setShowSheet(true);

    try {
      const link = document.createElement("a");
      link.rel = "ar";
      link.href = usdzSrc;

      // Safari spustí Quick Look jen tehdy, když je prvním potomkem <img>
      // s nenulovými rozměry.
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
      link.style.pointerEvents = "none";
      document.body.appendChild(link);

      trackTourEvent("ar_launch", { color: colorKey, meta: { platform: "ios", ...analyticsMeta } });

      link.click();
      link.remove();

      setAfterAR(true);
      trackTourEvent("ar_exit", { color: colorKey, meta: { platform: "ios", ...analyticsMeta } });
      onExitAR?.();
    } catch (error) {
      console.error("AR Quick Look selhal:", error);
      setStatus("error");
      setErrorReason("generic");
    }
  }, [analyticsMeta, colorKey, onExitAR, usdzSrc]);


  /* --------------------------------------------------------------------- */

  const handleActivate = useCallback(() => {
    const currentPlatform = detectPlatform();

    trackTourEvent("ar_open", {
      color: colorKey,
      meta: { platform: currentPlatform, ...analyticsMeta },
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
  }, [analyticsMeta, colorKey, launchAndroidAR, launchIosAR, startLoadTimeout]);

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

  /**
   * `icon` = kruhové tlačítko v tmavé 3D prohlídce.
   * `pill` = tlačítko s textem na detailu vozidla (světlý web, design systém
   * projektu — proto semantické tokeny, ne white/8 z prohlídky).
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
   * QR pro desktop. U konkrétního vozu musí odkaz vést na jeho detail
   * s `?ar=1` (deep-link), ne na parametry virtuální prohlídky.
   */
  const shareUrl = useMemo(() => {
    if (!vehicleId) return buildShareUrl({ ar: true, color: colorKey });
    if (typeof window === "undefined") return "";

    const params = new URLSearchParams({
      ar: "1",
      utm_source: "qr",
      utm_medium: "vehicle-detail",
      utm_campaign: "vehicle-ar",
    });

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [vehicleId, colorKey]);

  const ariaLabel =
    platform === "other"
      ? `Otevřít 3D náhled vozu${vehicleName ? ` ${vehicleName}` : ""}`
      : `Zobrazit vůz${vehicleName ? ` ${vehicleName}` : ""} v rozšířené realitě (AR)`;

  return (
    <>
      <button
        type="button"
        onClick={handleActivate}
        aria-label={ariaLabel}
        className={buttonClass}
        title={platform === "other" ? "3D náhled vozu" : "Zobrazit v AR"}
      >
        <Box className="h-4 w-4" />
        {variant === "pill" && <span>{label}</span>}
      </button>


      {viewerNeeded && platform === "android" && (
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
          exposure="1"


          shadow-intensity="1"
          shadow-softness="0.55"
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
                  {platform === "ios" ? (
                    <>
                      <p className="text-sm text-white/85">AR náhled je připraven</p>
                      <p className="mt-1 text-xs text-white/40">
                        Pokud se AR nespustilo automaticky, klepněte na tlačítko níže.
                      </p>

                      {/* iOS AR Quick Look pracuje se statickým USDZ, takže
                          barvu konkrétního vozu tam přebarvit nelze. Radši to
                          řekneme dopředu, než aby zákazník čekal svoji barvu. */}
                      {showColorDisclaimer && (
                        <p className="mt-2 text-[11px] leading-relaxed text-amber-300/80">
                          Na iPhonu se zobrazí model v základní barvě — rozměry
                          i tvar odpovídají skutečnému vozu.
                        </p>
                      )}


                      {/* Skutečný odkaz — nejspolehlivější cesta k AR Quick Look:
                          klepnutí je přímé uživatelské gesto na rel="ar" anchor. */}
                      <a
                        rel="ar"
                        href={usdzSrc}
                        className="relative mt-3 flex h-11 w-full items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                      >
                        {/* Safari vyžaduje <img> jako PRVNÍHO potomka <a rel="ar">.
                            Musí mít nenulové rozměry, aby ho Safari akceptovalo. */}
                        <img
                          src={AR_POSTER}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 h-full w-full object-cover opacity-0"
                        />
                        <span className="relative">Spustit AR</span>
                      </a>
                    </>
                  ) : (
                    <>
                      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-white/85">Spouštíme AR…</p>
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
                    {vehicleName ?? (
                      <>
                        Chrysler <span className="italic">Pacifica</span>
                      </>
                    )}
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
                src={glbSrc}
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
                camera-orbit="35deg 76deg 82%"
                min-camera-orbit="auto 25deg auto"
                max-camera-orbit="auto 90deg 140%"
                field-of-view="26deg"
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
                    <QRCodeSVG value={shareUrl} size={64} />
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
                <QRCodeSVG value={shareUrl} size={168} />
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
