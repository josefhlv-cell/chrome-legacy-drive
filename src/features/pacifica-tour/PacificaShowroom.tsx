import type {} from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor, Preload, useProgress } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import Showroom from "./scene/Showroom";
import CameraRig from "./scene/CameraRig";
import VehicleModel, { useRealModelAvailable } from "./model/VehicleModel";
import { CLOSED_STATE, type PartKey, type PartState } from "./model/parts";
import {
  ACTION_SHOTS,
  HOTSPOTS,
  VIEWS,
  type HotspotAction,
  type TourHotspot,
  type ViewKey,
} from "./data/tourData";
import Hotspot3D from "./ui/Hotspot3D";
import DetailPanel from "./ui/DetailPanel";
import TourNav from "./ui/TourNav";
import ActionDock, { type ActionChip } from "./ui/ActionDock";
import LoadingOverlay from "./ui/LoadingOverlay";
import HeroIntro from "./ui/HeroIntro";

const Loader = () => {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);
  // Procedurální model nemusí načítat žádné externí soubory → `progress` může
  // zůstat na 0. Overlay proto uvolníme vždy, když už nic není ve frontě.
  useEffect(() => {
    if (active) return;
    const t = window.setTimeout(() => setDone(true), 600);
    return () => window.clearTimeout(t);
  }, [active, progress]);
  if (done) return null;
  return <LoadingOverlay progress={active ? progress : 100} />;
};

/** Popisky pro plovoucí vrácení animací. */
const REVERT_LABELS: Partial<Record<PartKey, string>> = {
  doorLeft: "Zavřít posuvné dveře",
  liftgate: "Zavřít páté dveře",
  hood: "Zavřít kapotu",
  row2: "Vrátit 2. řadu",
  row3: "Vrátit 3. řadu",
};

/**
 * Digitální showroom Chrysler Pacifica.
 *
 * Vstup přes prémiovou hero obrazovku s fotografií konkrétního vozu,
 * následuje skutečná 3D scéna (WebGL / React Three Fiber) s reálnými
 * transformacemi pohyblivých částí, cinematic kamerou a interiérovými pohledy.
 */
export const PacificaShowroom = () => {
  const navigate = useNavigate();
  const wrapper = useRef<HTMLDivElement>(null);

  const [started, setStarted] = useState(false);
  const [view, setView] = useState<ViewKey>("exterior");
  const [focusShot, setFocusShot] = useState<{ position: [number, number, number]; target: [number, number, number] } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<TourHotspot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [variant, setVariant] = useState(0);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [parts, setParts] = useState<PartState>({ ...CLOSED_STATE });
  const [lights, setLights] = useState(false);
  const [dpr, setDpr] = useState(1.5);

  const usingRealModel = useRealModelAvailable() === true;
  const [fit, setFit] = useState(1);

  // Na úzkých displejích je vodorovný záběr menší — kamera musí odjet dál,
  // jinak by byl vůz na mobilu uříznutý.
  useEffect(() => {
    const compute = () => {
      const a = window.innerWidth / Math.max(1, window.innerHeight);
      setFit(a < 0.75 ? 1.62 : a < 1 ? 1.42 : a < 1.35 ? 1.16 : 1);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  const baseShot = useMemo(
    () => VIEWS.find((v) => v.key === view)?.shot ?? VIEWS[0].shot,
    [view],
  );

  const shot = useMemo(() => {
    const raw = focusShot
      ? { ...baseShot, position: focusShot.position, target: focusShot.target }
      : baseShot;
    if (fit === 1) return raw;
    // Odsadíme kameru po ose pohledu od cíle — kompozice zůstane stejná.
    const [tx, ty, tz] = raw.target;
    const [px, py, pz] = raw.position;
    const position: [number, number, number] = [
      tx + (px - tx) * fit,
      ty + (py - ty) * fit,
      tz + (pz - tz) * fit,
    ];
    return {
      ...raw,
      position,
      maxDistance: (raw.maxDistance ?? 16) * fit,
    };
  }, [baseShot, focusShot, fit]);

  const visibleHotspots = useMemo(() => HOTSPOTS.filter((h) => h.view === view), [view]);

  const changeView = useCallback((v: ViewKey) => {
    setView(v);
    setFocusShot(null);
    setSelected(null);
    setExpanded(false);
    setNonce((n) => n + 1);
  }, []);

  const selectHotspot = useCallback((h: TourHotspot) => {
    setSelected(h);
    setVariant(0);
    setExpanded(false);
    if (h.focus) {
      setFocusShot(h.focus);
      setNonce((n) => n + 1);
    }
  }, []);

  const toggleParts = useCallback((keys: PartKey[]) => {
    setParts((prev) => {
      const open = keys.every((p) => prev[p] > 0.5);
      const next = { ...prev };
      keys.forEach((p) => {
        next[p] = open ? 0 : 1;
      });
      return next;
    });
  }, []);

  const runAction = useCallback(
    (action: HotspotAction) => {
      if (action.type === "goToView") {
        changeView(action.view);
        return;
      }
      // Detail se sbalí, aby byla animace vozu skutečně vidět.
      setExpanded(false);
      if (selected && ACTION_SHOTS[selected.id]) {
        const s = ACTION_SHOTS[selected.id];
        setFocusShot({ position: s.position, target: s.target });
        setNonce((n) => n + 1);
      }
      if (action.type === "lights") {
        setLights((l) => !l);
        return;
      }
      toggleParts(action.parts);
    },
    [changeView, selected, toggleParts],
  );

  const actionActive = useMemo(() => {
    const a = selected?.action;
    if (!a) return false;
    if (a.type === "lights") return lights;
    if (a.type === "goToView") return false;
    return a.parts.every((p: PartKey) => parts[p] > 0.5);
  }, [selected, parts, lights]);

  const dockItems = useMemo<ActionChip[]>(() => {
    const items: ActionChip[] = [];
    if (parts.doorLeft > 0.5 || parts.doorRight > 0.5) {
      items.push({
        key: "doors",
        label: REVERT_LABELS.doorLeft!,
        onRevert: () => setParts((p) => ({ ...p, doorLeft: 0, doorRight: 0 })),
      });
    }
    (["liftgate", "hood", "row2", "row3"] as PartKey[]).forEach((k) => {
      if (parts[k] > 0.5) {
        items.push({
          key: k,
          label: REVERT_LABELS[k]!,
          onRevert: () => setParts((p) => ({ ...p, [k]: 0 })),
        });
      }
    });
    if (lights) {
      items.push({ key: "lights", label: "Zhasnout světla", onRevert: () => setLights(false) });
    }
    return items;
  }, [parts, lights]);

  const reset = useCallback(() => {
    setFocusShot(null);
    setParts({ ...CLOSED_STATE });
    setLights(false);
    setSelected(null);
    setExpanded(false);
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

  // ESC zavře nejprve detail, teprve potom celou prohlídku.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.fullscreenElement) return;
      if (selected) setSelected(null);
      else if (started) navigate("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, started, navigate]);

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
        camera={{ position: VIEWS[0].shot.position, fov: 42, near: 0.1, far: 120 }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#05070b"]} />
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1.5))}
        />
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
        sheetOpen={!!selected?.detail}
      />

      <ActionDock items={dockItems} offset={!!selected?.detail} />

      {selected?.detail && (
        <DetailPanel
          hotspot={selected}
          actionActive={actionActive}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((e) => !e)}
          variant={variant}
          onVariant={setVariant}
          onAction={runAction}
          onClose={() => {
            setSelected(null);
            setExpanded(false);
          }}
        />
      )}

      <Loader />
    </div>
  );
};

export default PacificaShowroom;
