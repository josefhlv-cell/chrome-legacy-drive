import type {} from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, Preload, useProgress } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import Showroom from "./scene/Showroom";
import CameraRig from "./scene/CameraRig";
import VehicleModel, { useRealModelAvailable } from "./model/VehicleModel";
import { CLOSED_STATE, type PartKey, type PartState } from "./model/parts";
import { HOTSPOTS, VIEWS, type HotspotAction, type TourHotspot, type ViewKey } from "./data/tourData";
import Hotspot3D from "./ui/Hotspot3D";
import DetailPanel from "./ui/DetailPanel";
import TourNav from "./ui/TourNav";
import LoadingOverlay from "./ui/LoadingOverlay";

const Loader = () => {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = window.setTimeout(() => setDone(true), 350);
      return () => window.clearTimeout(t);
    }
  }, [active, progress]);
  if (done) return null;
  return <LoadingOverlay progress={progress} />;
};

/**
 * Digitální showroom Chrysler Pacifica.
 *
 * Skutečná 3D scéna (WebGL / React Three Fiber) se skutečnými transformacemi
 * pohyblivých částí vozu, cinematic kamerou, interiérovými pohledy a
 * datově definovanými hotspoty.
 */
export const PacificaShowroom = () => {
  const navigate = useNavigate();
  const wrapper = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<ViewKey>("exterior");
  const [focusShot, setFocusShot] = useState<{ position: [number, number, number]; target: [number, number, number] } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<TourHotspot | null>(null);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [parts, setParts] = useState<PartState>({ ...CLOSED_STATE });
  const [lights, setLights] = useState(false);

  const usingRealModel = useRealModelAvailable() === true;

  const baseShot = useMemo(
    () => VIEWS.find((v) => v.key === view)?.shot ?? VIEWS[0].shot,
    [view],
  );

  const shot = useMemo(() => {
    if (!focusShot) return baseShot;
    return { ...baseShot, position: focusShot.position, target: focusShot.target };
  }, [baseShot, focusShot]);

  const visibleHotspots = useMemo(() => HOTSPOTS.filter((h) => h.view === view), [view]);

  const changeView = useCallback((v: ViewKey) => {
    setView(v);
    setFocusShot(null);
    setSelected(null);
    setNonce((n) => n + 1);
  }, []);

  const selectHotspot = useCallback((h: TourHotspot) => {
    setSelected(h);
    if (h.focus) {
      setFocusShot(h.focus);
      setNonce((n) => n + 1);
    }
  }, []);

  const runAction = useCallback((action: HotspotAction) => {
    if (action.type === "goToView") {
      changeView(action.view);
      return;
    }
    if (action.type === "lights") {
      setLights((l) => !l);
      return;
    }
    setParts((prev) => {
      const open = action.parts.every((p: PartKey) => prev[p] > 0.5);
      const next = { ...prev };
      action.parts.forEach((p: PartKey) => {
        next[p] = open ? 0 : 1;
      });
      return next;
    });
  }, [changeView]);

  const actionActive = useMemo(() => {
    const a = selected?.action;
    if (!a) return false;
    if (a.type === "lights") return lights;
    if (a.type === "goToView") return false;
    return a.parts.every((p: PartKey) => parts[p] > 0.5);
  }, [selected, parts, lights]);

  const reset = useCallback(() => {
    setFocusShot(null);
    setParts({ ...CLOSED_STATE });
    setLights(false);
    setNonce((n) => n + 1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapper.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div ref={wrapper} className="fixed inset-0 bg-[#05070b] overflow-hidden select-none touch-none">
      <Canvas
        shadows
        dpr={[1, Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1)]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: VIEWS[0].shot.position, fov: 42, near: 0.1, far: 120 }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#05070b"]} />
        <Showroom />
        <VehicleModel target={parts} lights={lights} />
        <CameraRig shot={shot} nonce={nonce} />

        {hotspotsVisible &&
          visibleHotspots.map((h) => (
            <Hotspot3D key={h.id} hotspot={h} active={selected?.id === h.id} onSelect={selectHotspot} />
          ))}

        <AdaptiveDpr pixelated />
        <Preload all />
      </Canvas>

      {/* Vinětace pro cinematic dojem — nesmí blokovat ovládání */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.68)_100%)]" />

      <TourNav
        view={view}
        onView={changeView}
        onReset={reset}
        hotspotsVisible={hotspotsVisible}
        onToggleHotspots={() => setHotspotsVisible((v) => !v)}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
        onClose={() => navigate("/")}
        usingRealModel={usingRealModel}
      />

      {selected?.detail && (
        <DetailPanel
          hotspot={selected}
          actionActive={actionActive}
          onAction={runAction}
          onClose={() => setSelected(null)}
        />
      )}

      <Loader />
    </div>
  );
};

export default PacificaShowroom;
