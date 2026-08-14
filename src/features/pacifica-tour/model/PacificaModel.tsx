import type {} from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import modelAsset from "./pacifica.glb.asset.json";

/** Skutečný 3D model Chrysler Pacifica Limited AWD (optimalizovaný GLB, Draco). */
export const MODEL_URL = modelAsset.url;

useGLTF.preload(MODEL_URL);

/** Skutečná délka vozu v metrech — model normalizujeme na reálné rozměry. */
const REAL_LENGTH = 5.18;

/** Materiály, které tvoří lakovanou karoserii (jen ty se přebarvují). */
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

/**
 * Připraví scénu: normalizuje rozměry (délka 5,18 m, kola na y = 0, střed v ose),
 * vylepší materiály do studiové kvality a vyklonuje materiály karoserie,
 * aby se dala bezpečně měnit barva laku bez dopadu na sklo, chrom a interiér.
 */
const prepare = (scene: THREE.Object3D): Prepared => {
  const root = new THREE.Group();
  const clone = scene.clone(true);
  root.add(clone);

  const bodyMaterials: THREE.MeshPhysicalMaterial[] = [];
  const originalColors: THREE.Color[] = [];
  const seen = new Map<string, THREE.Material>();

  clone.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const src = mesh.material as THREE.MeshStandardMaterial;
    if (!src || Array.isArray(mesh.material)) return;
    const name = src.name ?? "";

    const cached = seen.get(name);
    if (cached) {
      mesh.material = cached;
      return;
    }

    let next: THREE.Material;
    const n = name.toLowerCase();

    if (isBody(name)) {
      const paint = new THREE.MeshPhysicalMaterial({
        color: src.color.clone(),
        metalness: 0.62,
        roughness: 0.26,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.15,
      });
      paint.name = name;
      bodyMaterials.push(paint);
      originalColors.push(src.color.clone());
      next = paint;
    } else if (n.includes("glass") || n.includes("windows")) {
      next = new THREE.MeshPhysicalMaterial({
        color: src.color.clone(),
        metalness: 0,
        roughness: 0.05,
        transparent: true,
        opacity: Math.max(0.35, src.opacity ?? 0.5),
        transmission: 0,
        envMapIntensity: 1.4,
      });
    } else if (n.includes("chrome") || n.includes("rims1") || n.includes("mirrors") || n.includes("calipers")) {
      next = new THREE.MeshStandardMaterial({
        color: src.color.clone(),
        metalness: 0.92,
        roughness: 0.22,
        envMapIntensity: 1.3,
      });
    } else if (n.includes("tires")) {
      const m = src.clone();
      m.roughness = 0.95;
      m.metalness = 0;
      next = m;
    } else if (n.includes("drl") || n.includes("headlightsbase") || n.includes("reflectors")) {
      const m = src.clone() as THREE.MeshStandardMaterial;
      m.emissive = new THREE.Color("#dfe9ff");
      m.emissiveIntensity = 0.55;
      next = m;
    } else {
      const m = src.clone() as THREE.MeshStandardMaterial;
      m.roughness = Math.min(0.85, (m.roughness ?? 0.6) + 0.05);
      next = m;
    }

    next.name = name;
    seen.set(name, next);
    mesh.material = next;
  });

  // Normalizace rozměrů a usazení na podlahu
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = REAL_LENGTH / Math.max(size.x, size.y, size.z);
  clone.scale.setScalar(scale);

  const scaled = new THREE.Box3().setFromObject(clone);
  const center = new THREE.Vector3();
  scaled.getCenter(center);
  clone.position.x -= center.x;
  clone.position.z -= center.z;
  clone.position.y -= scaled.min.y;

  return { root, bodyMaterials, originalColors };
};

type Props = {
  /** Hex barvy laku, nebo null pro originální odstín. */
  bodyColor: string | null;
};

export const PacificaModel = ({ bodyColor }: Props) => {
  const { scene } = useGLTF(MODEL_URL);
  const prepared = useMemo(() => prepare(scene), [scene]);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    prepared.bodyMaterials.forEach((m, i) => {
      if (bodyColor) m.color.set(bodyColor);
      else m.color.copy(prepared.originalColors[i]);
      m.needsUpdate = true;
    });
  }, [bodyColor, prepared]);

  return (
    <group ref={group} name="pacifica">
      <primitive object={prepared.root} />
    </group>
  );
};

type BoundaryProps = { children: ReactNode; fallback: (retry: () => void) => ReactNode };

/** Zachytí chybu načtení modelu a umožní opakovaný pokus. */
export class ModelErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => {
    useGLTF.clear(MODEL_URL);
    this.setState({ failed: false });
  };

  render() {
    if (this.state.failed) return this.props.fallback(this.retry);
    return this.props.children;
  }
}

export default PacificaModel;
