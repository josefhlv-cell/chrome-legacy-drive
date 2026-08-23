import type {} from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export const MODEL_URL = "/models/pacifica.glb";

useGLTF.preload(MODEL_URL);

/*
 * Aktuální pacifica.glb už má správné reálné měřítko 1:1.
 * GLB má délku přibližně 5,189 m, takže zde NEDĚLÁME žádný
 * další přepočet velikosti podle bounding boxu.
 */

const BODY_MATERIAL_NAMES = [
  "pacifica_body_white",
  "pacifica_body",
  "bodypaint",
];

const BODY_MATERIAL_HINTS = [
  "pacifica_body",
  "bodypaint",
];

const isBodyMaterial = (name: string) => {
  const normalized = name.trim().toLowerCase();

  if (BODY_MATERIAL_NAMES.includes(normalized)) {
    return true;
  }

  return BODY_MATERIAL_HINTS.some((hint) =>
    normalized.includes(hint),
  );
};

type Prepared = {
  root: THREE.Group;
  bodyMaterials: THREE.MeshPhysicalMaterial[];
  originalColors: THREE.Color[];
};

const prepare = (
  scene: THREE.Object3D,
  enableShadows: boolean,
  maxAnisotropy: number,
): Prepared => {
  const root = new THREE.Group();
  const clone = scene.clone(true);
  root.add(clone);

  const bodyMaterials: THREE.MeshPhysicalMaterial[] = [];
  const originalColors: THREE.Color[] = [];
  const seen = new Map<string, THREE.Material>();

  const tuneTexture = (texture: THREE.Texture | null | undefined) => {
    if (!texture) return;

    texture.anisotropy = Math.min(maxAnisotropy, 4);
    texture.needsUpdate = true;
  };

  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (!mesh.isMesh) return;

    mesh.castShadow = enableShadows;
    mesh.receiveShadow = enableShadows;
    mesh.frustumCulled = true;

    // Materiály pole necháváme beze změny.
    // Nezasahujeme do sub-meshů importovaných z GLB.
    if (Array.isArray(mesh.material)) return;

    const src = mesh.material as THREE.MeshStandardMaterial | undefined;

    if (!src) return;

    const name = src.name || mesh.name || "";
    const materialKey = src.uuid;

    const cached = seen.get(materialKey);

    if (cached) {
      mesh.material = cached;
      return;
    }

    let next: THREE.Material;

    if (isBodyMaterial(name)) {
      /*
       * Pouze karoserie dostane speciální lak.
       * Ostatní materiály modelu zůstávají oddělené.
       */
      const paint = new THREE.MeshPhysicalMaterial({
        color:
          src.color?.clone() ??
          new THREE.Color("#ffffff"),
        metalness: 0.58,
        roughness: 0.24,
        clearcoat: 1,
        clearcoatRoughness: 0.055,
        envMapIntensity: 1.15,
      });

      // Zachovat všechny dostupné textury původního materiálu.
      paint.map = src.map ?? null;
      paint.normalMap = src.normalMap ?? null;
      paint.roughnessMap = src.roughnessMap ?? null;
      paint.metalnessMap = src.metalnessMap ?? null;
      paint.aoMap = src.aoMap ?? null;
      paint.emissiveMap = src.emissiveMap ?? null;

      paint.name = name;

      bodyMaterials.push(paint);
      originalColors.push(
        src.color?.clone() ??
          new THREE.Color("#ffffff"),
      );

      next = paint;
    } else {
      /*
       * Všechny ostatní materiály pouze klonujeme.
       * Jejich vzhled a barva se nemění při přepnutí palety.
       */
      const material = src.clone();
      const lower = name.toLowerCase();

      if (
        lower.includes("glass") ||
        lower.includes("windows")
      ) {
        material.metalness = 0;
        material.roughness = Math.min(
          material.roughness,
          0.08,
        );
        material.envMapIntensity = 1.25;
      } else if (
        lower.includes("chrome") ||
        lower.includes("rims1") ||
        lower.includes("mirrors") ||
        lower.includes("calipers")
      ) {
        material.metalness = 0.92;
        material.roughness = 0.2;
        material.envMapIntensity = 1.25;
      } else if (lower.includes("tires")) {
        material.metalness = 0;
        material.roughness = 0.92;
      } else if (
        lower.includes("drl") ||
        lower.includes("headlightsbase") ||
        lower.includes("reflectors")
      ) {
        material.emissive = new THREE.Color(
          "#dfe9ff",
        );
        material.emissiveIntensity = 0.5;
      } else {
        material.roughness = Math.min(
          0.88,
          Math.max(
            0.04,
            material.roughness + 0.02,
          ),
        );
      }

      material.name = name;
      next = material;
    }

    const materialRecord =
      next as THREE.MeshStandardMaterial & {
        map?: THREE.Texture | null;
        normalMap?: THREE.Texture | null;
        roughnessMap?: THREE.Texture | null;
        metalnessMap?: THREE.Texture | null;
        aoMap?: THREE.Texture | null;
        emissiveMap?: THREE.Texture | null;
      };

    tuneTexture(materialRecord.map);
    tuneTexture(materialRecord.normalMap);
    tuneTexture(materialRecord.roughnessMap);
    tuneTexture(materialRecord.metalnessMap);
    tuneTexture(materialRecord.aoMap);
    tuneTexture(materialRecord.emissiveMap);

    seen.set(materialKey, next);
    mesh.material = next;
  });

  /*
   * NOVÉ GLB JE UŽ 1:1.
   *
   * Proto zde NEDĚLÁME:
   *   REAL_LENGTH / largestDimension
   *   clone.scale.setScalar(...)
   *
   * Zachováme měřítko zabudované přímo v GLB.
   */

  const worldBox = new THREE.Box3().setFromObject(clone);

  if (
    !Number.isFinite(worldBox.min.x) ||
    !Number.isFinite(worldBox.min.y) ||
    !Number.isFinite(worldBox.min.z) ||
    !Number.isFinite(worldBox.max.x) ||
    !Number.isFinite(worldBox.max.y) ||
    !Number.isFinite(worldBox.max.z)
  ) {
    throw new Error(
      "pacifica.glb: model má neplatné rozměry.",
    );
  }

  const size = new THREE.Vector3();
  worldBox.getSize(size);

  if (
    !Number.isFinite(size.x) ||
    !Number.isFinite(size.y) ||
    !Number.isFinite(size.z) ||
    Math.max(size.x, size.y, size.z) <= 0
  ) {
    throw new Error(
      "pacifica.glb: model má neplatné nebo nulové rozměry.",
    );
  }

  /*
   * Pouze zarovnáme model:
   * - střed X/Z
   * - spodní bod na Y=0
   *
   * Neměníme jeho velikost.
   */
  const center = new THREE.Vector3();
  worldBox.getCenter(center);

  clone.position.x -= center.x;
  clone.position.z -= center.z;
  clone.position.y -= worldBox.min.y;

  return {
    root,
    bodyMaterials,
    originalColors,
  };
};

type Props = {
  bodyColor: string | null;
};

export const PacificaModel = ({ bodyColor }: Props) => {
  const { scene } = useGLTF(MODEL_URL);
  const gl = useThree((state) => state.gl);

  const enableShadows = useMemo(() => {
    if (typeof window === "undefined") return true;

    return !(
      window.matchMedia(
        "(max-width: 768px)",
      ).matches ||
      navigator.maxTouchPoints > 0
    );
  }, []);

  const maxAnisotropy = useMemo(
    () =>
      Math.min(
        gl.capabilities.getMaxAnisotropy(),
        4,
      ),
    [gl],
  );

  const prepared = useMemo(
    () =>
      prepare(
        scene,
        enableShadows,
        maxAnisotropy,
      ),
    [scene, enableShadows, maxAnisotropy],
  );

  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    prepared.bodyMaterials.forEach(
      (material, index) => {
        if (bodyColor) {
          material.color.set(bodyColor);
        } else {
          material.color.copy(
            prepared.originalColors[index],
          );
        }

        material.needsUpdate = true;
      },
    );
  }, [bodyColor, prepared]);

  return (
    <group
      ref={group}
      name="pacifica"
    >
      <primitive object={prepared.root} />
    </group>
  );
};

type BoundaryProps = {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
};

export class ModelErrorBoundary extends Component<
  BoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => {
    useGLTF.clear(MODEL_URL);
    this.setState({ failed: false });
  };

  render() {
    if (this.state.failed) {
      return this.props.fallback(this.retry);
    }

    return this.props.children;
  }
}

export default PacificaModel;
