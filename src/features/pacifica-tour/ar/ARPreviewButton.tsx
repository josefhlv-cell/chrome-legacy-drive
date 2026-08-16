import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Box, Loader2, X } from "lucide-react";
// model-viewer.d.ts je ambient deklarace v adresáři src/, TS ji zahrne
// automaticky (viz tsconfig include) — není potřeba ji explicitně importovat.

/**
 * AR náhled Chrysler Pacifica.
 *
 * - Android: model-viewer deleguje na Google Scene Viewer (vyžaduje .glb + ARCore).
 * - iPhone: model-viewer deleguje na Apple AR Quick Look (vyžaduje .usdz + ARKit).
 * - Desktop / nepodporovaná zařízení: zobrazí QR kód na tuto stránku,
 *   aby uživatel prohlídku otevřel na mobilu.
 *
 * Soubory modelu:
 *   /public/models/pacifica.glb   (už v projektu — sdílí ho i 3D showroom)
 *   /public/models/pacifica.usdz  (TŘEBA DOPLNIT — konverze z .glb, viz poznámka níže)
 *
 * Pozn. k barvě laku: <model-viewer> nesdílí materiálovou logiku z
 * PacificaModel.tsx (živá změna barvy přes Three.js material). AR náhled proto
 * vždy zobrazí model v ORIGINÁLNÍ barvě z .glb/.usdz souboru, bez ohledu na to,
 * jakou barvu si uživatel zvolil v 3D showroomu. Pokud by bylo žádoucí nabídnout
 * AR i v jiných barvách, je potřeba vyexportovat samostatný .glb/.usdz pro
 * každou barvu a přepínat `src`/`ios-src` podle zvolené barvy.
 */

const MODEL_GLB = "/models/pacifica.glb";
const MODEL_USDZ = "/models/pacifica.usdz";

type Platform = "android" | "ios" | "other";

const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent || "";

  if (/android/i.test(ua)) return "android";

  // iPadOS 13+ hlásí desktop Safari UA, proto i test na maxTouchPoints.
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

  modelViewerLoading = import("@google/model-viewer").then(() => {
    modelViewerLoaded = true;
  });

  return modelViewerLoading;
};

type Status = "idle" | "loading" | "ready" | "unsupported" | "error";

type Props = {
  /** Volitelný handler zavolaný při návratu z AR (pro obnovení stavu prohlídky). */
  onExitAR?: () => void;
};

export const ARPreviewButton = ({ onExitAR }: Props) => {
  const [platform, setPlatform] = useState<Platform>("other");
  const [status, setStatus] = useState<Status>("idle");
  const [showSheet, setShowSheet] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Typováno volněji (any), protože <model-viewer> je custom element
  // a přesné strukturální sjednocení s React.Ref<ModelViewerElement>
  // z model-viewer.d.ts by zde jen zbytečně komplikovalo typy.
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const supportsInlineAR = platform === "android" || platform === "ios";

  const handleActivate = useCallback(async () => {
    // Desktop / neznámé zařízení → nabídnout QR kód na naskenování mobilem.
    if (!supportsInlineAR) {
      setShowQR(true);
      return;
    }

    setStatus("loading");
    setShowSheet(true);

    try {
      await loadModelViewer();

      // model-viewer element vytváříme až po načtení knihovny a jen jednou.
      if (!viewerRef.current) {
        setStatus("error");
        return;
      }

      // Počkat, než si komponenta ověří dostupnost AR na zařízení.
      const el = viewerRef.current;

      const ready = () =>
        new Promise<void>((resolve) => {
          if (el.canActivateAR !== undefined) {
            resolve();
            return;
          }
          el.addEventListener("load", () => resolve(), { once: true });
        });

      await ready();

      if (!el.canActivateAR) {
        setStatus("unsupported");
        return;
      }

      setStatus("ready");
      await el.activateAR();

      // AR Quick Look / Scene Viewer běží mimo stránku (systémový overlay),
      // takže po návratu jen zavřeme naši loading vrstvu.
      setShowSheet(false);
      onExitAR?.();
    } catch (err) {
      console.error("AR aktivace selhala:", err);
      setStatus("error");
    }
  }, [supportsInlineAR, onExitAR]);

  const closeSheet = useCallback(() => {
    setShowSheet(false);
    setStatus("idle");
  }, []);

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

      {/* Skrytý model-viewer element — vytvoří se až po prvním kliknutí,
          aby se knihovna nenačítala zbytečně při vstupu do prohlídky. */}
      {status !== "idle" && supportsInlineAR && (
        // Typováno v model-viewer.d.ts (JSX.IntrinsicElements).
        <model-viewer
          ref={viewerRef}
          src={MODEL_GLB}
          ios-src={MODEL_USDZ}
          ar
          ar-modes="scene-viewer quick-look"
          ar-scale="fixed"
          ar-placement="floor"
          alt="Chrysler Pacifica — 3D model pro AR náhled"
          style={{
            position: "fixed",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Loading / chybový overlay během přípravy AR */}
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
                    Za chvíli se otevře{" "}
                    {platform === "ios" ? "AR Quick Look" : "AR náhled"}.
                  </p>
                </>
              )}

              {status === "unsupported" && (
                <>
                  <p className="text-sm text-white/85">
                    AR náhled na tomto zařízení není dostupný.
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Zkuste novější telefon s Androidem (ARCore) nebo iPhone
                    (ARKit, iOS 12+).
                  </p>
                </>
              )}

              {status === "error" && (
                <>
                  <p className="text-sm text-white/85">
                    AR náhled se nepodařilo spustit.
                  </p>
                  <button
                    type="button"
                    onClick={handleActivate}
                    className="mt-3 h-9 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground"
                  >
                    Zkusit znovu
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* QR kód pro desktop / nepodporovaná zařízení */}
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
                  value={typeof window !== "undefined" ? window.location.href : ""}
                  size={168}
                />
              </div>

              <p className="text-sm text-white/85">
                Naskenujte mobilem
              </p>
              <p className="mt-1 text-xs text-white/40">
                AR náhled funguje na telefonu s Androidem nebo iPhonem.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default ARPreviewButton;
