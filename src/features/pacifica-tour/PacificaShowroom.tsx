import type {} from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, PerformanceMonitor, useProgress } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

import Showroom from "./scene/Showroom";
import CameraRig, { type CameraRigHandle } from "./scene/CameraRig";
import PacificaModel, { ModelErrorBoundary } from "./model/PacificaModel";

import {
  BODY_COLORS,
  DEFAULT_SHOT,
  HOTSPOTS,
  type CameraShot,
  type TourHotspot,
} from "./data/tourData";

import Hotspot3D from "./ui/Hotspot3D";
import DetailPanel from "./ui/DetailPanel";
import TourNav from "./ui/TourNav";
import TourProgress from "./ui/TourProgress";
import LoadingOverlay from "./ui/LoadingOverlay";
import HeroIntro from "./ui/HeroIntro";
import LeadCapture from "./ui/LeadCapture";
import InteriorTour from "./interior/InteriorTour";

import { trackTourEvent } from "./lib/tourAnalytics";
import {
  isTourMuted,
  primeAudio,
  setTourMuted,
  sfx,
  startAmbient,
  stopAmbient,
} from "./lib/tourSound";
import { readTourUrlState, writeTourUrlState } from "./lib/tourUrlState";

const KEY_ASSET = "/pacifica/virtual-tour/interior-key.png";

/** Jak dlouho se u automatické prohlídky zdrží kamera na jednom bodu. */
const GUIDED_STEP_MS = 9000;

/** Detekce WebGL — bez ní by uživatel skončil na černé obrazovce. */
const hasWebGL = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
};

/* -------------------------------------------------------------------------- */
/* Renderer                                                                    */
/* -------------------------------------------------------------------------- */

const RendererQuality = ({ mobile }: { mobile: boolean }) => {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = mobile ? 1.02 : 1.12;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    gl.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        mobile ? 1.2 : 2,
      ),
    );
  }, [gl, mobile]);

  return null;
};

/* -------------------------------------------------------------------------- */
/* Snapshot bridge — přístup k rendereru pro „Vyfotit vůz“                    */
/* -------------------------------------------------------------------------- */

type SnapshotApi = {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
};

const SnapshotBridge = ({
  onReady,
}: {
  onReady: (api: SnapshotApi) => void;
}) => {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    onReady({ gl, scene, camera });
  }, [gl, scene, camera, onReady]);

  return null;
};

/* -------------------------------------------------------------------------- */
/* Loader                                                                      */
/* -------------------------------------------------------------------------- */

const Loader = () => {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (active) return;

    const t = window.setTimeout(() => setDone(true), 450);

    return () => window.clearTimeout(t);
  }, [active, progress]);

  if (done) return null;

  return <LoadingOverlay progress={active ? progress : 100} />;
};

/* -------------------------------------------------------------------------- */
/* Exterior interior-key                                                      */
/* -------------------------------------------------------------------------- */

type ExteriorKeyProps = {
  onUnlock: () => void;
};

const ExteriorKey = ({ onUnlock }: ExteriorKeyProps) => {
  return (
    <div
      className="
        pointer-events-auto
        absolute
        z-30
        flex
        flex-col
        items-center
      "
      style={{
        // Responsivní pozice: co nejblíž pravému okraji, ale nikdy oříznuté
        // a vždy nad safe-area i nad spodním ovládáním.
        right: "max(0.25rem, env(safe-area-inset-right))",
        bottom:
          "calc(env(safe-area-inset-bottom) + clamp(96px, 13vh, 120px))",
      }}
    >
      {/* Label above key */}
      <div
        className="
          pointer-events-none
          mb-2
          whitespace-nowrap
          rounded-full
          border
          border-white/10
          bg-black/70
          px-2.5
          py-1
          text-[8px]
          font-medium
          uppercase
          tracking-[0.14em]
          text-white/85
          shadow-lg
          backdrop-blur-md
        "
      >
        Odemkni prohlídku interiéru
      </div>

      {/* Key */}
      <div
        className="relative"
        style={{
          // ~18 % menší než původní 122 × 190 / 142 × 220 px.
          width: "clamp(88px, 24vw, 116px)",
          aspectRatio: "122 / 190",
        }}
      >
        <img
          src={KEY_ASSET}
          alt="Klíč od vozu"
          draggable={false}
          className="
            h-full
            w-full
            object-contain
            drop-shadow-[0_18px_35px_rgba(0,0,0,0.65)]
          "
        />

        {/* UNLOCK hotspot — levé horní tlačítko (otevřený zámek).
            Střed odpovídá skutečné pozici tlačítka v interior-key.png
            (415/1030 ≈ 40 % šířky, 320/1540 ≈ 21 % výšky). */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onUnlock();
          }}
          aria-label="Odemknout prohlídku interiéru"
          className="
            absolute
            left-[40%]
            top-[21%]
            -translate-x-1/2
            -translate-y-1/2
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-full
            touch-manipulation
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-primary
          "
          style={{
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {/* pulzující kruh */}
          <span
            className="
              absolute
              h-12
              w-12
              animate-ping
              rounded-full
              bg-primary/25
            "
          />

          {/* světelný prstenec */}
          <span
            className="
              absolute
              h-9
              w-9
              animate-pulse
              rounded-full
              border-2
              border-primary
              bg-primary/15
              shadow-[0_0_28px_hsl(var(--primary))]
            "
          />

          {/* střed */}
          <span
            className="
              relative
              flex
              h-6
              w-6
              items-center
              justify-center
              rounded-full
              bg-primary
              text-primary-foreground
              shadow-[0_0_20px_hsl(var(--primary))]
            "
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="11"
                width="18"
                height="10"
                rx="2"
              />
              <path d="M7 11V7a5 5 0 0 1 10 0v1" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Main showroom                                                               */
/* -------------------------------------------------------------------------- */

export const PacificaShowroom = () => {
  const navigate = useNavigate();

  const initial = useRef(readTourUrlState());

  const wrapper = useRef<HTMLDivElement>(null);
  const rig = useRef<CameraRigHandle>(null);
  const snapshot = useRef<SnapshotApi | null>(null);

  const [webgl] = useState(() => hasWebGL());

  const [started, setStarted] = useState(initial.current.started);
  const [interior, setInterior] = useState(initial.current.interior);

  const [focus, setFocus] = useState<{
    position: [number, number, number];
    target: [number, number, number];
  } | null>(null);

  const [nonce, setNonce] = useState(0);

  const [selected, setSelected] =
    useState<TourHotspot | null>(
      () =>
        HOTSPOTS.find((h) => h.id === initial.current.hotspot) ?? null,
    );

  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [colorKey, setColorKey] = useState(initial.current.color);
  const [isMobile, setIsMobile] = useState(false);
  const [dpr, setDpr] = useState(1.35);
  const [flash, setFlash] = useState(false);
  const [fit, setFit] = useState(1);

  const [soundOn, setSoundOn] = useState(() => !isTourMuted());
  const [guided, setGuided] = useState(false);
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadSource, setLeadSource] = useState("tour");

  const [visited, setVisited] = useState<Set<string>>(
    () => new Set(),
  );

  const bodyColor = useMemo(
    () =>
      BODY_COLORS.find((c) => c.key === colorKey)?.hex ?? null,
    [colorKey],
  );

  /* ---------------------------------------------------------------------- */
  /* Analytika — otevření stránky                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    trackTourEvent("tour_open", {
      color: initial.current.color,
      meta: { webgl, deep_link: initial.current.started },
    });
  }, [webgl]);

  /* ---------------------------------------------------------------------- */
  /* Deep-link: stav → URL                                                   */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    writeTourUrlState({
      started,
      hotspot: interior ? null : selected?.id ?? null,
      interior,
      color: colorKey,
      ar: false,
    });
  }, [started, selected, interior, colorKey]);

  /* Tlačítko „zpět“ v prohlížeči se má chovat uvnitř prohlídky. */
  useEffect(() => {
    const onPop = () => {
      const state = readTourUrlState();

      setStarted(state.started);
      setInterior(state.interior);
      setColorKey(state.color);
      setSelected(HOTSPOTS.find((h) => h.id === state.hotspot) ?? null);
      setFocus(null);
      setNonce((n) => n + 1);
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Zvuk                                                                    */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!started || !soundOn) return;

    startAmbient();
    return () => stopAmbient();
  }, [started, soundOn]);

  const toggleSound = useCallback(() => {
    setSoundOn((value) => {
      const next = !value;
      setTourMuted(!next);

      if (next) {
        primeAudio();
        sfx.tap();
      }

      return next;
    });
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Mobile                                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const check = () => {
      const mobile =
        window.matchMedia("(max-width: 768px)").matches ||
        navigator.maxTouchPoints > 0;

      setIsMobile(mobile);
      // Desktop jde na plné rozlišení displeje (retina), mobil zůstává střídmý.
      setDpr(
        mobile
          ? 1.2
          : Math.min(window.devicePixelRatio || 1, 2),
      );
    };

    check();

    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);

    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Camera fit                                                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const compute = () => {
      const aspect =
        window.innerWidth /
        Math.max(1, window.innerHeight);

      setFit(
        aspect < 0.75
          ? 1.72
          : aspect < 1
            ? 1.48
            : aspect < 1.35
              ? 1.14
              : 1,
      );
    };

    compute();

    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);

    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  const shot = useMemo<CameraShot>(() => {
    const raw = focus
      ? {
          ...DEFAULT_SHOT,
          position: focus.position,
          target: focus.target,
        }
      : DEFAULT_SHOT;

    if (fit === 1) return raw;

    const [tx, ty, tz] = raw.target;
    const [px, py, pz] = raw.position;

    return {
      ...raw,
      position: [
        tx + (px - tx) * fit,
        ty + (py - ty) * fit,
        tz + (pz - tz) * fit,
      ],
      maxDistance: (raw.maxDistance ?? 13) * fit,
    };
  }, [focus, fit]);

  /* ---------------------------------------------------------------------- */
  /* Idle rotation                                                           */
  /* ---------------------------------------------------------------------- */

  const idleTimer = useRef<number>();

  const scheduleIdle = useCallback(() => {
    window.clearTimeout(idleTimer.current);

    setAutoRotate(false);

    idleTimer.current = window.setTimeout(
      () => setAutoRotate(true),
      3500,
    );
  }, []);

  useEffect(() => {
    if (!started) return;

    scheduleIdle();

    return () =>
      window.clearTimeout(idleTimer.current);
  }, [started, scheduleIdle]);

  /* ---------------------------------------------------------------------- */
  /* Hotspots                                                                */
  /* ---------------------------------------------------------------------- */

  const selectHotspot = useCallback(
    (hotspot: TourHotspot) => {
      window.clearTimeout(idleTimer.current);

      setAutoRotate(false);
      setSelected(hotspot);

      sfx.tap();
      sfx.swoosh();

      trackTourEvent("hotspot_view", { step: hotspot.id });

      setVisited((previous) => {
        const next = new Set(previous);
        next.add(hotspot.id);
        return next;
      });

      setFocus({
        position: hotspot.focus.position,
        target: hotspot.focus.lookAt,
      });

      setNonce((n) => n + 1);

      setFlash(true);

      window.setTimeout(
        () => setFlash(false),
        360,
      );
    },
    [],
  );

  /* ---------------------------------------------------------------------- */
  /* Automatická (guided) prohlídka                                          */
  /* ---------------------------------------------------------------------- */

  const stopGuided = useCallback(() => {
    setGuided(false);
  }, []);

  const toggleGuided = useCallback(() => {
    setGuided((value) => {
      if (value) return false;

      primeAudio();
      setGuidedIndex(0);
      trackTourEvent("guided_start");
      return true;
    });
  }, []);

  useEffect(() => {
    if (!guided) return;

    const hotspot = HOTSPOTS[guidedIndex];

    if (!hotspot) {
      setGuided(false);
      sfx.chime();
      trackTourEvent("guided_complete");
      setLeadSource("konec automatické prohlídky");
      setLeadOpen(true);
      return;
    }

    selectHotspot(hotspot);

    const timer = window.setTimeout(
      () => setGuidedIndex((index) => index + 1),
      GUIDED_STEP_MS,
    );

    return () => window.clearTimeout(timer);
  }, [guided, guidedIndex, selectHotspot]);

  /* ---------------------------------------------------------------------- */
  /* Back to car                                                             */
  /* ---------------------------------------------------------------------- */

  const backToCar = useCallback(() => {
    setSelected(null);
    setFocus(null);

    setNonce((n) => n + 1);

    scheduleIdle();
  }, [scheduleIdle]);

  /* ---------------------------------------------------------------------- */
  /* Reset                                                                   */
  /* ---------------------------------------------------------------------- */

  const reset = useCallback(() => {
    setSelected(null);
    setFocus(null);
    setVisited(new Set());
    setGuided(false);

    setNonce((n) => n + 1);

    scheduleIdle();
  }, [scheduleIdle]);

  /* ---------------------------------------------------------------------- */
  /* Unlock interior                                                         */
  /* ---------------------------------------------------------------------- */

  const unlockInterior = useCallback(() => {
    window.clearTimeout(idleTimer.current);

    setAutoRotate(false);
    setSelected(null);
    setFocus(null);
    setGuided(false);

    sfx.unlock();
    trackTourEvent("interior_unlock");

    setInterior(true);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Barva laku                                                              */
  /* ---------------------------------------------------------------------- */

  const changeColor = useCallback((key: string) => {
    setColorKey(key);
    sfx.paint();
    trackTourEvent("color_change", { color: key });
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Snapshot — „Vyfotit vůz“                                                */
  /* ---------------------------------------------------------------------- */

  const takeSnapshot = useCallback(() => {
    const api = snapshot.current;
    if (!api) return;

    sfx.shutter();

    api.gl.render(api.scene, api.camera);

    const source = api.gl.domElement;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(source, 0, 0);

    // Vodoznak — sdílení na sociálních sítích má vždy nést značku prodejce.
    const pad = Math.round(canvas.width * 0.03);
    const size = Math.max(14, Math.round(canvas.width * 0.018));

    ctx.font = `600 ${size}px Montserrat, sans-serif`;
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText("CHRYSLER PARDUBICE · chdp.chryslerpardubice.site", pad + 2, canvas.height - pad + 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("CHRYSLER PARDUBICE · chdp.chryslerpardubice.site", pad, canvas.height - pad);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chrysler-pacifica-${colorKey}.png`;
      link.rel = "noopener";
      // Safari/iOS i některé Chromium buildy stahují jen z připojeného odkazu.
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 4000);

    }, "image/png");

    setFlash(true);
    window.setTimeout(() => setFlash(false), 260);

    trackTourEvent("snapshot", { color: colorKey });
  }, [colorKey]);

  /* ---------------------------------------------------------------------- */
  /* Fullscreen                                                              */
  /* ---------------------------------------------------------------------- */

  const toggleFullscreen = useCallback(() => {
    const element = wrapper.current;

    if (!element) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () =>
      setFullscreen(!!document.fullscreenElement);

    document.addEventListener(
      "fullscreenchange",
      onChange,
    );

    return () =>
      document.removeEventListener(
        "fullscreenchange",
        onChange,
      );
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Keyboard                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        target &&
        /input|textarea|select/i.test(target.tagName)
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (leadOpen) return;

        if (selected) {
          backToCar();
          return;
        }

        if (started && !document.fullscreenElement) {
          trackTourEvent("tour_exit");
          navigate("/");
        }

        return;
      }

      if (!started || interior) return;

      // Klávesnicová navigace mezi body zájmu.
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        stopGuided();

        const current = selected
          ? HOTSPOTS.findIndex((h) => h.id === selected.id)
          : -1;

        const delta = event.key === "ArrowRight" ? 1 : -1;
        const next =
          (current + delta + HOTSPOTS.length) % HOTSPOTS.length;

        selectHotspot(HOTSPOTS[next]);
        return;
      }

      if (event.key.toLowerCase() === "h") {
        setHotspotsVisible((value) => !value);
        return;
      }

      if (event.key.toLowerCase() === "p") {
        toggleGuided();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", onKey);

    return () =>
      window.removeEventListener(
        "keydown",
        onKey,
      );
  }, [
    selected,
    started,
    interior,
    leadOpen,
    navigate,
    backToCar,
    selectHotspot,
    stopGuided,
    toggleGuided,
    toggleFullscreen,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Hero                                                                    */
  /* ---------------------------------------------------------------------- */

  if (!started) {
    return (
      <HeroIntro
        onStart={() => {
          primeAudio();
          sfx.unlock();
          trackTourEvent("tour_start");
          setStarted(true);
        }}
        onClose={() => navigate("/")}
      />
    );
  }

  /* ---------------------------------------------------------------------- */
  /* WebGL fallback — bez 3D kontextu nabídneme aspoň fotoprohlídku          */
  /* ---------------------------------------------------------------------- */

  if (!webgl) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#05070b] px-6 py-10 text-center">
        <img
          src="/pacifica-hero.webp"
          alt="Chrysler Pacifica — Chrysler Pardubice"
          className="mx-auto max-h-[46vh] w-full max-w-xl rounded-2xl object-cover"
        />

        <h1 className="mt-6 font-serif text-2xl text-white">
          3D prohlídka není na tomto zařízení dostupná
        </h1>

        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-white/60">
          Váš prohlížeč nepodporuje WebGL, takže 3D exteriér nelze zobrazit.
          Fotoprohlídkou interiéru ale projít můžete.
        </p>

        <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setInterior(true)}
            className="h-12 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground"
          >
            Prohlídka interiéru (fotografie)
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-12 rounded-full border border-white/15 bg-white/8 text-[13px] font-semibold text-white"
          >
            Zpět na web
          </button>
        </div>

        {interior && (
          <InteriorTour
            onExitToExterior={() => setInterior(false)}
            onClose={() => navigate("/")}
          />
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Exterior + interior (Canvas zůstává namontovaný)                        */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      ref={wrapper}
      className="
        fixed
        inset-0
        select-none
        touch-none
        overflow-hidden
        bg-[#05070b]
        animate-in
        fade-in
        duration-500
      "
    >
      {/* 3D scéna. Při vstupu do interiéru se NEODMOUNTUJE — jen se skryje
          a zastaví renderovací smyčka, takže návrat zpět je okamžitý
          a model se nestahuje znovu. */}
      <div
        className={`absolute inset-0 ${
          interior ? "invisible pointer-events-none" : "visible"
        }`}
        aria-hidden={interior}
      >
        <Canvas
          shadows={!isMobile}
          frameloop={interior ? "never" : "always"}
          dpr={[1, dpr]}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            depth: true,
            preserveDrawingBuffer: true,
          }}
          camera={{
            position: DEFAULT_SHOT.position,
            fov: 42,
            near: 0.1,
            far: 120,
          }}
          onPointerMissed={() =>
            selected && backToCar()
          }
          style={{
            touchAction: "none",
          }}
        >
          <RendererQuality mobile={isMobile} />

          <SnapshotBridge
            onReady={(api) => {
              snapshot.current = api;
            }}
          />

          <color
            attach="background"
            args={["#05070b"]}
          />

          <PerformanceMonitor
            bounds={() =>
              isMobile
                ? [38, 58]
                : [50, 60]
            }
            onDecline={() =>
              setDpr((value) =>
                Math.max(
                  isMobile ? 0.9 : 1.25,
                  value - 0.15,
                ),
              )
            }
            onIncline={() =>
              setDpr((value) =>
                Math.min(
                  isMobile
                    ? 1.2
                    : Math.min(
                        window.devicePixelRatio || 1,
                        2,
                      ),
                  value + 0.1,
                ),
              )
            }
          />

          <Showroom mobile={isMobile} />

          <ModelErrorBoundary
            fallback={(retry) => (
              <Html center>
                <div className="w-64 rounded-2xl border border-white/12 bg-black/70 p-4 text-center backdrop-blur-md">
                  <p className="text-xs text-white/80">
                    3D model se nepodařilo načíst.
                  </p>

                  <button
                    type="button"
                    onClick={retry}
                    className="
                      mt-3
                      h-10
                      w-full
                      rounded-full
                      bg-primary
                      text-xs
                      font-semibold
                      text-primary-foreground
                    "
                  >
                    Zkusit znovu
                  </button>
                </div>
              </Html>
            )}
          >
            <Suspense fallback={null}>
              <PacificaModel
                bodyColor={bodyColor}
              />
            </Suspense>
          </ModelErrorBoundary>

          <CameraRig
            ref={rig}
            shot={shot}
            nonce={nonce}
            autoRotate={
              autoRotate && !selected
            }
            onUserInteract={() => {
              stopGuided();
              scheduleIdle();
            }}
          />

          {hotspotsVisible &&
            HOTSPOTS.map((hotspot) => (
              <Hotspot3D
                key={hotspot.id}
                hotspot={hotspot}
                active={
                  selected?.id === hotspot.id
                }
                visited={visited.has(
                  hotspot.id,
                )}
                onSelect={selectHotspot}
              />
            ))}
        </Canvas>
      </div>

      {!interior && (
        <>
          {/* Vignette */}
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.5)_100%)]
            "
          />

          {/* Flash */}
          <div
            className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${
              flash
                ? "opacity-[0.06]"
                : "opacity-0"
            }`}
          />

          {/* Klávesnicová a čtečková navigace mezi body zájmu.
              3D hotspoty samy o sobě nejsou pro čtečku popsatelné. */}
          <nav aria-label="Body zájmu prohlídky" className="sr-only">
            <ul>
              {HOTSPOTS.map((hotspot) => (
                <li key={hotspot.id}>
                  <button type="button" onClick={() => selectHotspot(hotspot)}>
                    {hotspot.label}
                    {visited.has(hotspot.id) ? " — prohlédnuto" : ""}
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={unlockInterior}>
                  Přejít do prohlídky interiéru
                </button>
              </li>
            </ul>
          </nav>

          <p aria-live="polite" className="sr-only">
            Prohlédnuto {visited.size} z {HOTSPOTS.length} bodů zájmu.
          </p>

          <TourProgress
            visited={visited.size}
            total={HOTSPOTS.length}
            guided={guided}
            onToggleGuided={toggleGuided}
            dimmed={!!selected}
          />

          <ExteriorKey
            onUnlock={unlockInterior}
          />

          {/* Navigation */}
          <TourNav
            onReset={reset}
            hotspotsVisible={hotspotsVisible}
            onToggleHotspots={() =>
              setHotspotsVisible(
                (value) => !value,
              )
            }
            fullscreen={fullscreen}
            onToggleFullscreen={
              toggleFullscreen
            }
            onClose={() => {
              trackTourEvent("tour_exit");
              navigate("/");
            }}
            autoRotate={autoRotate}
            onToggleAutoRotate={() => {
              window.clearTimeout(
                idleTimer.current,
              );

              setAutoRotate(
                (value) => !value,
              );
            }}
            colorKey={colorKey}
            onColor={changeColor}
            sheetOpen={!!selected}
            soundOn={soundOn}
            onToggleSound={toggleSound}
            onSnapshot={takeSnapshot}
            onLead={() => {
              setLeadSource("prohlídka — exteriér");
              setLeadOpen(true);
            }}
            colorHex={bodyColor}
            arAutoStart={initial.current.ar}
          />

          {/* Detail panel */}
          {selected && (
            <DetailPanel
              hotspot={selected}
              onClose={backToCar}
              onCta={
                selected.detail.cta
                  ? unlockInterior
                  : undefined
              }
            />
          )}

          <Loader />
        </>
      )}

      {interior && (
        <InteriorTour
          onExitToExterior={() => {
            sfx.lock();
            setInterior(false);
            backToCar();
          }}
          onClose={() => {
            trackTourEvent("tour_exit");
            navigate("/");
          }}
          onFinished={() => {
            setLeadSource("konec prohlídky interiéru");
            setLeadOpen(true);
          }}
        />
      )}

      <LeadCapture
        open={leadOpen}
        onClose={() => setLeadOpen(false)}
        colorKey={colorKey}
        source={leadSource}
      />
    </div>
  );
};

export default PacificaShowroom;
