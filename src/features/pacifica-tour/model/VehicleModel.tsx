import type {} from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import type { AnimationAction, Group, Object3D } from "three";
import * as THREE from "three";
import ProceduralPacifica from "./ProceduralPacifica";
import { applyPartState, bindParts, CLOSED_STATE, PARTS, type PartKey, type PartState } from "./parts";

/**
 * Cesta k reálnému modelu vozu. Jakmile se sem nahraje GLB/GLTF
 * (ideálně Draco/Meshopt komprimovaný), showroom ho automaticky použije
 * místo procedurálního placeholderu — bez jakékoli změny kódu.
 */
export const PACIFICA_MODEL_URL = "/models/pacifica.glb";

/** Zjistí, zda je reálný GLB model k dispozici. */
export const useRealModelAvailable = () => {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(PACIFICA_MODEL_URL, { method: "HEAD" })
      .then((r) => {
        const type = r.headers.get("content-type") ?? "";
        // Vite dev server vrací na neexistující cestu index.html → to není model.
        if (alive) setAvailable(r.ok && !type.includes("text/html"));
      })
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, []);
  return available;
};

type AnimatedProps = {
  /** Cílový stav pohyblivých částí (0 = zavřeno, 1 = otevřeno/sklopeno). */
  target: PartState;
  lights: boolean;
};

/**
 * Interpolace stavu částí a aplikace SKUTEČNÝCH transformací na uzly modelu.
 * Pokud model obsahuje GLTF animace, řídí se místo transformací AnimationMixer.
 */
const usePartAnimation = (
  root: React.RefObject<Group>,
  target: PartState,
  actions?: Record<string, AnimationAction | null>,
) => {
  const current = useRef<PartState>({ ...CLOSED_STATE });
  const bindings = useRef<ReturnType<typeof bindParts>>([]);
  const clipMap = useRef<Partial<Record<PartKey, AnimationAction>>>({});

  useEffect(() => {
    if (!root.current) return;
    bindings.current = bindParts(root.current);
    clipMap.current = {};
    if (actions) {
      (Object.keys(PARTS) as PartKey[]).forEach((key) => {
        const names = PARTS[key].clips ?? [];
        const found = Object.keys(actions).find((n) =>
          names.some((c) => n.toLowerCase() === c.toLowerCase()),
        );
        const action = found ? actions[found] : null;
        if (action) {
          action.play();
          action.paused = true;
          action.clampWhenFinished = true;
          clipMap.current[key] = action;
        }
      });
    }
  }, [root, actions]);

  useFrame((_, delta) => {
    const k = 1 - Math.pow(0.001, delta); // plynulý, frame-rate nezávislý dojezd
    let changed = false;
    (Object.keys(CLOSED_STATE) as PartKey[]).forEach((key) => {
      const to = target[key] ?? 0;
      const from = current.current[key];
      if (Math.abs(to - from) > 0.0005) {
        current.current[key] = from + (to - from) * k;
        changed = true;
      } else if (from !== to) {
        current.current[key] = to;
        changed = true;
      }
    });
    if (!changed) return;

    // Části s vlastní GLTF animací řídíme mixerem, ostatní přímými transformacemi.
    const transformBindings = bindings.current.filter((b) => !clipMap.current[b.key]);
    applyPartState(transformBindings, current.current);

    (Object.keys(clipMap.current) as PartKey[]).forEach((key) => {
      const action = clipMap.current[key];
      if (!action) return;
      action.time = action.getClip().duration * (current.current[key] ?? 0);
    });
  });
};

const RealPacifica = ({ target, lights }: AnimatedProps) => {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(PACIFICA_MODEL_URL);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions } = useAnimations(animations, group);
  usePartAnimation(group, target, actions);

  useEffect(() => {
    cloned.traverse((o: Object3D) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      const name = o.name.toLowerCase();
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat && "emissiveIntensity" in mat) {
        if (name.includes("headlight") || name.includes("lamp") || name.includes("drl")) {
          mat.emissiveIntensity = lights ? 3.2 : 0.05;
        }
        if (name.includes("taillight") || name.includes("rearlight")) {
          mat.emissiveIntensity = lights ? 2.2 : 0.1;
        }
      }
    });
  }, [cloned, lights]);

  return (
    <group ref={group} name="pacifica_real">
      <primitive object={cloned} />
    </group>
  );
};

const PlaceholderPacifica = ({ target, lights }: AnimatedProps) => {
  const group = useRef<Group>(null);
  usePartAnimation(group, target);
  return (
    <group ref={group}>
      <ProceduralPacifica lights={lights} />
    </group>
  );
};

export const VehicleModel = ({ target, lights }: AnimatedProps) => {
  const hasReal = useRealModelAvailable();
  if (hasReal === null) return null;
  return (
    <Suspense fallback={<PlaceholderPacifica target={target} lights={lights} />}>
      {hasReal ? (
        <RealPacifica target={target} lights={lights} />
      ) : (
        <PlaceholderPacifica target={target} lights={lights} />
      )}
    </Suspense>
  );
};

export default VehicleModel;
