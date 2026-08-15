import type {} from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import LoadingOverlay from "./ui/LoadingOverlay";
import HeroIntro from "./ui/HeroIntro";
import InteriorTour from "./interior/InteriorTour";

const RendererQuality = ({ mobile }: { mobile: boolean }) => {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = mobile ? 1.0 : 1.08;
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 2));
  }, [gl, mobile]);

  return null;
};

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

export const PacificaShowroom = () => {
  const navigate = useNavigate();
  const wrapper = useRef<HTMLDivElement>(null);
  const rig = useRef<CameraRigHandle>(null);

  const [started, setStarted] = useState(false);
  const [interior, setInterior] = useState(false);
  const [focus, setFocus] = useState<{
    position: [number, number, number];
    target: [number, number, number];
  } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<TourHotspot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [colorKey, setColorKey] = useState("original");
  const [isMobile, setIsMobile] = useState(false);
  const [dpr, setDpr] = useState(1.35);
  const [flash, setFlash] = useState(false);
  const [fit, setFit] = useState(1);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [realView, setRealView] = useState(false);

  const bodyColor = useMemo(
    () => BODY_COLORS.find((c) => c.key === colorKey)?.hex ?? null,
    [colorKey],
  );

  useEffect(() => {
    const check = () => {
      const mobile =
        window.matchMedia("(max-width: 768px)").matches ||
        navigator.maxTouchPoints > 0;

      setIsMobile(mobile);
      setDpr(mobile ? 1.15 : 1.65);
    };

    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);

    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  useEffect(() => {
    const compute = () => {
      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      setFit(
        aspect < 0.75 ? 1.72 :
        aspect < 1 ? 1.48 :
        aspect < 1.35 ? 1.14 :
        1,
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
      ? { ...DEFAULT_SHOT, position: focus.position, target: focus.target }
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

  const idleTimer = useRef<number>();

  const scheduleIdle = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    setAutoRotate(false);
    idleTimer.current = window.setTimeout(() => setAutoRotate(true), 3500);
  }, []);

  useEffect(() => {
    if (!started) return;
    scheduleIdle();
    return () => window.clearTimeout(idleTimer.current);
  }, [started, scheduleIdle]);

  const selectHotspot = useCallback((hotspot: TourHotspot) => {
    window.clearTimeout(idleTimer.current);
    setAutoRotate(false);
    setSelected(hotspot);
    setExpanded(false);
    setRealView(false);

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
    window.setTimeout(() => setFlash(false), 360);
  }, []);

  const backToCar = useCallback(() => {
    setSelected(null);
    setExpanded(false);
    setRealView(false);
    setFocus(null);
    setNonce((n) => n + 1);
    scheduleIdle();
  }, [scheduleIdle]);

  const reset = useCallback(() => {
    setSelected(null);
    setExpanded(false);
    setRealView(false);
    setFocus(null);
    setVisited(new Set());
    setNonce((n) => n + 1);
    scheduleIdle();
  }, [scheduleIdle]);

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
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (selected) {
        backToCar();
        return;
      }

      if (started && !document.fullscreenElement) {
        navigate("/");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, started, navigate, backToCar]);

  if (!started) {
    return (
      <HeroIntro
        onStart={() => setStarted(true)}
        onClose={() => navigate("/")}
      />
    );
  }

  if (interior) {
    return (
      <InteriorTour
        onExitToExterior={() => {
          setInterior(false);
          backToCar();
        }}
        onClose={() => navigate("/")}
      />
    );
  }

  return (
    <div
      ref={wrapper}
      className="fixed inset-0 overflow-hidden bg-[#05070b] select-none touch-none animate-in fade-in duration-500"
    >
      <Canvas
        shadows={!isMobile}
        dpr={[1, dpr]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
          depth: true,
        }}
        camera={{
          position: DEFAULT_SHOT.position,
          fov: 42,
          near: 0.1,
          far: 120,
        }}
        onPointerMissed={() => selected && backToCar()}
        style={{ touchAction: "none" }}
      >
        <RendererQuality mobile={isMobile} />

        <color attach="background" args={["#05070b"]} />

        <PerformanceMonitor
          bounds={() => (isMobile ? [38, 58] : [50, 60])}
          onDecline={() =>
            setDpr((value) => Math.max(isMobile ? 0.9 : 1.25, value - 0.15))
          }
          onIncline={() =>
            setDpr((value) => Math.min(isMobile ? 1.35 : 2, value + 0.1))
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
                  className="mt-3 h-10 w-full rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Zkusit znovu
                </button>
              </div>
            </Html>
          )}
        >
          <Suspense fallback={null}>
            <PacificaModel bodyColor={bodyColor} />
          </Suspense>
        </ModelErrorBoundary>

        <CameraRig
          ref={rig}
          shot={shot}
          nonce={nonce}
          autoRotate={autoRotate && !selected && !realView}
          onUserInteract={scheduleIdle}
        />

        {hotspotsVisible &&
          !realView &&
          HOTSPOTS.map((hotspot) => (
            <Hotspot3D
              key={hotspot.id}
              hotspot={hotspot}
              active={selected?.id === hotspot.id}
              visited={visited.has(hotspot.id)}
              onSelect={selectHotspot}
            />
          ))}
      </Canvas>

      {realView && selected?.detail.media && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070b]/96 p-4">
          {selected.detail.media.type === "video" ? (
            <video
              key={selected.detail.media.src}
              src={selected.detail.media.src}
              poster={selected.detail.media.poster}
              controls
              playsInline
              preload="metadata"
              className="max-h-[78vh] w-full max-w-5xl rounded-2xl bg-black object-contain shadow-2xl"
            />
          ) : (
            <img
              src={selected.detail.media.src}
              alt={selected.detail.title}
              className="max-h-[78vh] w-full max-w-5xl rounded-2xl object-contain shadow-2xl"
            />
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.5)_100%)]" />

      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${
          flash ? "opacity-[0.06]" : "opacity-0"
        }`}
      />

      <TourNav
        onReset={reset}
        hotspotsVisible={hotspotsVisible}
        onToggleHotspots={() => setHotspotsVisible((value) => !value)}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onClose={() => navigate("/")}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => {
          window.clearTimeout(idleTimer.current);
          setAutoRotate((value) => !value);
        }}
        colorKey={colorKey}
        onColor={setColorKey}
        sheetOpen={!!selected}
      />

      {selected && (
        <DetailPanel
          hotspot={selected}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((value) => !value)}
          onClose={backToCar}
          realView={realView}
          onToggleRealView={() => setRealView((value) => !value)}
          onCta={selected.detail.cta ? () => setInterior(true) : undefined}
        />
      )}

      <Loader />
    </div>
  );
};

export default PacificaShowroom;
