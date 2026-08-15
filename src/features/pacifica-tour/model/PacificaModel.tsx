import type {} from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Chrysler Pacifica Limited AWD – současný GLB model.
 *
 * Tento soubor NEMĚNÍ model, geometrii ani GLB.
 * Zlepšuje pouze způsob jeho vykreslování:
 * - správný color space
 * - kvalitnější filtrování textur
 * - anisotropní filtrování
 * - kvalitnější PBR materiály
 * - zachování frustum cullingu
 * - mobilní stíny zůstávají vypnuté kvůli FPS
 */
export const MODEL_URL = "/models/pacifica.glb";

useGLTF.preload(MODEL_URL);

const REAL_LENGTH = 5.18;

const BODY_MATERIAL_HINTS = ["clearcoat", "granite", "bodypaint"];

const isBody = (name: string) => {
  const n = name.toLowerCase();
  return BODY_MATERIAL_HINTS.some((h) => n.includes(h));
};

type Prepared = {
  root: THREE.Group;
  bodyMaterials: THREE.MeshPhysicalMaterial[];
  originalColors: THREE.Color[];
};

const configureTexture = (
  texture: THREE.Texture,
  colorTexture: boolean,
) => {
  if (colorTexture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  } else {
    texture.colorSpace = THREE.NoColorSpace;
  }

  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  // Výrazně pomáhá detailu textur při šikmém pohledu.
  // Renderer hodnotu případně omezí podle GPU.
  texture.anisotropy = Math.min(8, texture.anisotropy || 8);

  texture.needsUpdate = true;
};

const configureMaterialTextures = (material: THREE.Material) => {
  const m = material as THREE.MeshStandardMaterial;

  if (m.map) configureTexture(m.map, true);
  if (m.emissiveMap) configureTexture(m.emissiveMap, true);

  if (m.normalMap) configureTexture(m.normalMap, false);
  if (m.roughnessMap) configureTexture(m.roughnessMap, false);
  if (m.metalnessMap) configureTexture(m.metalnessMap, false);
  if (m.aoMap) configureTexture(m.aoMap, false);
  if (m.alphaMap) configureTexture(m.alphaMap, false);
};

const prepare = (
  scene: THREE.Object3D,
  enableShadows: boolean,
): Prepared => {
  const root = new THREE.Group();
  const clone = scene.clone(true);
  root.add(clone);

  const bodyMaterials: THREE.MeshPhysicalMaterial[] = [];
  const originalColors: THREE.Color[] = [];

  /*
   * Materiály sdílíme podle původního jména.
   * To omezuje počet shader/material instancí a pomáhá výkonu.
   */
  const seen = new Map<string, THREE.Material>();

  clone.traverse((o) => {
    const mesh = o as THREE.Mesh;

    if (!mesh.isMesh) return;

    mesh.castShadow = enableShadows;
    mesh.receiveShadow = enableShadows;
    mesh.frustumCulled = true;

    const sourceMaterial = mesh.material;

    if (!sourceMaterial || Array.isArray(sourceMaterial)) {
      return;
    }

    const src = sourceMaterial as THREE.MeshStandardMaterial;
    const name = src.name ?? "";
    const n = name.toLowerCase();

    /*
     * DŮLEŽITÉ:
     * Neignorujeme textury původního GLB.
     * Pokud má model vlastní mapy, zachováme je.
     */
    configureMaterialTextures(src);

    const cached = seen.get(name);

    if (cached) {
      mesh.material = cached;
      return;
    }

    let next: THREE.Material;

    if (isBody(name)) {
      const paint = new THREE.MeshPhysicalMaterial({
        color: src.color.clone(),

        /*
         * Původní PBR charakter laku zachováváme.
         * Hodnoty jsou mírně upravené pro čistší odlesky.
         */
        metalness: 0.62,
        roughness: 0.24,
        clearcoat: 1.0,
        clearcoatRoughness: 0.055,
        envMapIntensity: 1.2,

        map: src.map ?? null,
        normalMap: src.normalMap ?? null,
        roughnessMap: src.roughnessMap ?? null,
        metalnessMap: src.metalnessMap ?? null,
        aoMap: src.aoMap ?? null,
      });

      paint.name = name;

      bodyMaterials.push(paint);
      originalColors.push(src.color.clone());

      next = paint;
    } else if (n.includes("glass") || n.includes("windows")) {
      next = new THREE.MeshPhysicalMaterial({
        color: src.color.clone(),
        metalness: 0,
        roughness: 0.045,
        transparent: true,
        opacity: Math.max(0.35, src.opacity ?? 0.5),
        transmission: 0,
        envMapIntensity: 1.35,

        map: src.map ?? null,
        normalMap: src.normalMap ?? null,
      });
    } else if (
      n.includes("chrome") ||
      n.includes("rims1") ||
      n.includes("mirrors") ||
      n.includes("calipers")
    ) {
      next = new THREE.MeshStandardMaterial({
        color: src.color.clone(),
        metalness: 0.92,
        roughness: 0.2,
        envMapIntensity: 1.3,

        map: src.map ?? null,
        normalMap: src.normalMap ?? null,
        roughnessMap: src.roughnessMap ?? null,
        metalnessMap: src.metalnessMap ?? null,
      });
    } else if (n.includes("tires")) {
      const m = src.clone();

      m.roughness = 0.92;
      m.metalness = 0;

      next = m;
    } else if (
      n.includes("drl") ||
      n.includes("headlightsbase") ||
      n.includes("reflectors")
    ) {
      const m = src.clone() as THREE.MeshStandardMaterial;

      m.emissive = new THREE.Color("#dfe9ff");
      m.emissiveIntensity = 0.5;

      next = m;
    } else {
      const m = src.clone() as THREE.MeshStandardMaterial;

      m.roughness = Math.min(
        0.85,
        Math.max(0.05, (m.roughness ?? 0.6) + 0.02),
      );

      next = m;
    }

    configureMaterialTextures(next);

    next.name = name;
    seen.set(name, next);
    mesh.material = next;
  });

  /*
   * Normalizace rozměrů.
   * Model se nijak nezmenšuje polygonově.
   */
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();

  box.getSize(size);

  const scale =
    REAL_LENGTH / Math.max(size.x, size.y, size.z);

  clone.scale.setScalar(scale);

  const scaled = new THREE.Box3().setFromObject(clone);
  const center = new THREE.Vector3();

  scaled.getCenter(center);

  clone.position.x -= center.x;
  clone.position.z -= center.z;
  clone.position.y -= scaled.min.y;

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

  /*
   * Mobilní zařízení:
   * žádné realtime stíny = podstatně více výkonu pro samotný model.
   */
  const enableShadows = useMemo(() => {
    if (typeof window === "undefined") return true;

    return !(
      window.matchMedia("(max-width: 768px)").matches ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    );
  }, []);

  const prepared = useMemo(
    () => prepare(scene, enableShadows),
    [scene, enableShadows],
  );

  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    prepared.bodyMaterials.forEach((material, index) => {
      if (bodyColor) {
        material.color.set(bodyColor);
      } else {
        material.color.copy(
          prepared.originalColors[index],
        );
      }

      material.needsUpdate = true;
    });
  }, [bodyColor, prepared]);

  return (
    <group
      ref={group}
      name="pacifica"
      dispose={null}
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
  state = {
    failed: false,
  };

  static getDerivedStateFromError() {
    return {
      failed: true,
    };
  }

  retry = () => {
    useGLTF.clear(MODEL_URL);
    this.setState({
      failed: false,
    });
  };

  render() {
    if (this.state.failed) {
      return this.props.fallback(this.retry);
    }

    return this.props.children;
  }
}

export default PacificaModel;
