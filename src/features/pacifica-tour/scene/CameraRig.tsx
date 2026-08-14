import type {} from "@react-three/fiber";
import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraShot } from "../data/tourData";

type Props = {
  shot: CameraShot;
  /** Inkrement, kterým vynutíme nový cinematic přejezd. */
  nonce: number;
  /** Jemná auto-rotace, když uživatel neinteraguje. */
  autoRotate: boolean;
  onUserInteract?: () => void;
};

export type CameraRigHandle = { stopAnimation: () => void };

/**
 * Cinematic kamera + OrbitControls.
 * Přejezdy jsou plynulé (easing ~1 s), uživatelský vstup je okamžitě přeruší.
 */
export const CameraRig = forwardRef<CameraRigHandle, Props>(
  ({ shot, nonce, autoRotate, onUserInteract }, ref) => {
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

    useImperativeHandle(ref, () => ({
      stopAnimation: () => {
        animating.current = false;
      },
    }));

    useFrame((_, delta) => {
      const c = controls.current;
      if (!c || !animating.current) return;
      const k = 1 - Math.pow(0.008, Math.min(delta, 0.05));
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
        enablePan={false}
        enableZoom
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
        autoRotate={autoRotate && !animating.current}
        autoRotateSpeed={0.5}
        minDistance={shot.minDistance ?? 3.6}
        maxDistance={shot.maxDistance ?? 13}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.05}
        onStart={() => {
          animating.current = false;
          onUserInteract?.();
        }}
        target={new THREE.Vector3(...shot.target)}
      />
    );
  },
);

CameraRig.displayName = "CameraRig";

export default CameraRig;
