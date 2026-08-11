import type {} from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraShot } from "../data/tourData";

type Props = {
  shot: CameraShot;
  /** Inkrement, kterým vynutíme nový cinematic přejezd (např. reset kamery). */
  nonce: number;
};

/**
 * Cinematic kamera: přejezdy mezi pohledy jsou plynulé (žádné skoky).
 * Jakmile uživatel začne sám ovládat scénu, animace se okamžitě uvolní.
 */
export const CameraRig = ({ shot, nonce }: Props) => {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const animating = useRef(false);
  const desiredPos = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());

  useEffect(() => {
    desiredPos.current.set(...shot.position);
    desiredTarget.current.set(...shot.target);
    animating.current = true;
  }, [shot, nonce]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c || !animating.current) return;
    const k = 1 - Math.pow(0.012, delta);
    camera.position.lerp(desiredPos.current, k);
    c.target.lerp(desiredTarget.current, k);
    c.update();
    if (
      camera.position.distanceTo(desiredPos.current) < 0.02 &&
      c.target.distanceTo(desiredTarget.current) < 0.02
    ) {
      animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={shot.orbit}
      enableZoom
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      minDistance={shot.minDistance ?? 0.4}
      maxDistance={shot.maxDistance ?? 16}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI / 2.02}
      onStart={() => {
        animating.current = false;
      }}
      target={new THREE.Vector3(...shot.target)}
    />
  );
};

export default CameraRig;
