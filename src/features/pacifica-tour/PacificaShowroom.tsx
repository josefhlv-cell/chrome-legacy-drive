import type {} from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, Html, PerformanceMonitor, useProgress } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
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

const Loader = () => {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (active) return;
    const t = window.setTimeout(() => setDone(true), 500);
    return () => window.clearTimeout(t);
  }, [active, progress]);
  if (done) return null;
  return <LoadingOverlay progress={active ? progress : 100} />;
};

/**
 * Digitální 3D showroom Chrysler Pacifica Limited AWD.
 *
 * Exteriér je vždy skutečný GLB model (react-three-fiber). Reálné fotografie
 * a videa se zobrazují pouze uvnitř informačních karet hotspotů.
 */
export const PacificaShowroom = () => {
  const navigate = useNavigate();
  const wrapper = useRef<HTMLDivElement>(null);
  const rig = useRef<CameraRigHandle>(null);

  const [started, setStarted] = useState(false);
  const [focus, setFocus] = useState<{ position: [number, number, number]; target: [number, number, number] } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<TourHotspot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [colorKey, setColorKey] = useState("original");
  const [dpr, setDpr] = useState(1.5);
  const [flash, setFlash] = useState(false);
  const [fit, setFit] = useState(1);

  const bodyColor = useMemo(
    () => BODY_COLORS.find((c) => c.key === colorKey)?.hex ?? null,
    [colorKey],
  );

  // Na úzkých displejích je vodorovný záběr menší — kamera musí odjet dál.
  useEffect(() => {
    const compute = () => {
      const a = window.innerWidth / Math.max(1, window.innerHeight);
      setFit(a < 0.75 ? 1.72 : a < 1 ? 1.48 : a < 1.35 ? 1.14 : 1);
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
    const raw: CameraShot = focus
      ? { ...DEFAULT_SHOT, position: focus.position, target: focus.target }
      : DEFAULT_SHOT;
    if (fit === 1) return raw;
    const [tx, ty, tz] = raw.target;
    const [px, py, pz] = raw.position;
    return {
      ...raw,
      position: [tx + (px - tx) * fit, ty + (py - ty) * fit, tz + (pz - tz) * fit],
      maxDistance: (raw.maxDistance ?? 13) * fit,
    };
  }, [focus, fit]);

  // Auto-rotace se sama nastartuje po ~3 s klidu (a vypne při interakci).
  const idleTimer = useRef<number>();
  const scheduleIdle = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    setAutoRotate(false);
    idleTimer.current = window.setTimeout(() => setAutoRotate(true), 3000);
  }, []);

  useEffect(() => {
    if (!started) return;
    scheduleIdle();
    return () => window.clearTimeout(idleTimer.current);
  }, [started, scheduleIdle]);

  const selectHotspot = useCallback(
    (h: TourHotspot) => {
      window.clearTimeout(idleTimer.current);
      setAutoRotate(false);
      setSelected(h);
      setExpanded(false);
      setFocus({ position: h.focus.position, target: h.focus.lookAt });
      setNonce((n) => n + 1);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 420);
    },
    [],
  );

  const backToCar = useCallback(() => {
    setSelected(null);
    setExpanded(false);
    setFocus(null);
    setNonce((n) => n + 1);
    scheduleIdle();
  }, [scheduleIdle]);

  const reset = useCallback(() => {
    setSelected(null);
    setExpanded(false);
    setFocus(null);
    setColorKey((k) => k);
    setNonce((n) => n + 1);
    scheduleIdle();
  }, [scheduleIdle]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapper.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.fullscreenElement) return;
      if (selected) backToCar();
      else if (started) navigate("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, started, navigate, backToCar]);

  if (!started) {
    return <HeroIntro onStart={() => setStarted(true)} onClose={() => navigate("/")} />;
  }

  return (
    <div
      ref={wrapper}
      className="fixed inset-0 overflow-hidden bg-[#05070b] select-none touch-none animate-in fade-in duration-500"
    >
      <Canvas
        shadows
        dpr={[1, dpr]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: DEFAULT_SHOT.position, fov: 42, near: 0.1, far: 120 }}
        onPointerMissed={() => selected && backToCar()}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#05070b"]} />
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1.5))}
        />
        <Showroom />

        <ModelErrorBoundary
          fallback={(retry) => (
            <Html center>
              <div className="w-64 rounded-2xl border border-white/12 bg-black/70 p-4 text-center backdrop-blur-md">
                <p className="text-xs text-white/80">3D model se nepodařilo načíst.</p>
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
          autoRotate={autoRotate && !selected}
          onUserInteract={scheduleIdle}
        />

        {hotspotsVisible &&
          HOTSPOTS.map((h) => (
            <Hotspot3D key={h.id} hotspot={h} active={selected?.id === h.id} onSelect={selectHotspot} />
          ))}

        <AdaptiveDpr pixelated />
      </Canvas>

      {/* Cinematic vinětace */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.66)_100%)]" />

      {/* Jemný bílý přechod při přejezdu kamery */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${
          flash ? "opacity-[0.07]" : "opacity-0"
        }`}
      />

      <TourNav
        onReset={reset}
        hotspotsVisible={hotspotsVisible}
        onToggleHotspots={() => setHotspotsVisible((v) => !v)}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onClose={() => navigate("/")}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => {
          window.clearTimeout(idleTimer.current);
          setAutoRotate((v) => !v);
        }}
        colorKey={colorKey}
        onColor={setColorKey}
        sheetOpen={!!selected}
      />

      {selected && (
        <DetailPanel
          hotspot={selected}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((e) => !e)}
          onClose={backToCar}
        />
      )}

      <Loader />
    </div>
  );
};

export default PacificaShowroom;
