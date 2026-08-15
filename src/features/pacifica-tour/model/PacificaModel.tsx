import type {} from "@react-three/fiber";
import { Component, type ReactNode, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export const MODEL_URL = "/models/pacifica.glb";

useGLTF.preload(MODEL_URL);

const REAL_LENGTH = 5.18;
const BODY_MATERIAL_HINTS = ["clearcoat", "granite", "bodypaint"];

const isBody = (name: string) => {
  const n = name.toLowerCase();
  return BODY_MATERIAL_HINTS.some((hint) => n.includes(hint));
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

    if (Array.isArray(mesh.material)) return;

    const src = mesh.material as THREE.MeshStandardMaterial;
    if (!src) return;

    const name = src.name || mesh.name || "";
    const materialKey = src.uuid;

    const cached = seen.get(materialKey);
    if (cached) {
      mesh.material = cached;
      return;
    }

    let next: THREE.Material;

    if (isBody(name)) {
      const paint = new THREE.MeshPhysicalMaterial();
      paint.copy(src as unknown as THREE.MeshPhysicalMaterial);

      paint.color.copy(src.color);
      paint.metalness = 0.58;
      paint.roughness = 0.24;
      paint.clearcoat = 1;
      paint.clearcoatRoughness = 0.055;
      paint.envMapIntensity = 1.15;
      paint.name = name;

      bodyMaterials.push(paint);
      originalColors.push(src.color.clone());
      next = paint;
    } else {
      const material = src.clone();

      const lower = name.toLowerCase();

      if (lower.includes("glass") || lower.includes("windows")) {
        material.metalness = 0;
        material.roughness = Math.min(material.roughness, 0.08);
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
        material.emissive = new THREE.Color("#dfe9ff");
        material.emissiveIntensity = 0.5;
      } else {
        material.roughness = Math.min(
          0.88,
          Math.max(0.04, material.roughness + 0.02),
        );
      }

      material.name = name;
      next = material;
    }

    const materialRecord = next as THREE.MeshStandardMaterial & {
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
  bodyColor: string | null;
};

export const PacificaModel = ({ bodyColor }: Props) => {
  const { scene } = useGLTF(MODEL_URL);
  const gl = useThree((state) => state.gl);

  const enableShadows = useMemo(() => {
    if (typeof window === "undefined") return true;

    return !(
      window.matchMedia("(max-width: 768px)").matches ||
      navigator.maxTouchPoints > 0
    );
  }, []);

  const maxAnisotropy = useMemo(
    () => Math.min(gl.capabilities.getMaxAnisotropy(), 4),
    [gl],
  );

  const prepared = useMemo(
    () => prepare(scene, enableShadows, maxAnisotropy),
    [scene, enableShadows, maxAnisotropy],
  );

  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    prepared.bodyMaterials.forEach((material, index) => {
      if (bodyColor) {
        material.color.set(bodyColor);
      } else {
        material.color.copy(prepared.originalColors[index]);
      }
      material.needsUpdate = true;
    });
  }, [bodyColor, prepared]);

  return (
    <group ref={group} name="pacifica">
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
    if (this.state.failed) return this.props.fallback(this.retry);
    return this.props.children;
  }
}

export default PacificaModel;
