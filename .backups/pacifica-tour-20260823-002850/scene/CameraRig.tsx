import type {} from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraShot } from "../data/tourData";

type Props = {
  shot: CameraShot;
  nonce: number;
  autoRotate: boolean;
  onUserInteract?: () => void;
};

export type CameraRigHandle = {
  stopAnimation: () => void;
};

export const CameraRig = forwardRef<CameraRigHandle, Props>(
  ({ shot, nonce, autoRotate, onUserInteract }, ref) => {
    const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
    const camera = useThree((state) => state.camera);
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
      const controlsApi = controls.current;
      if (!controlsApi) return;

      if (animating.current) {
        const k = 1 - Math.exp(-Math.min(delta, 0.05) * 6.5);

        camera.position.lerp(desiredPos.current, k);
        controlsApi.target.lerp(desiredTarget.current, k);
        controlsApi.update();

        if (
          camera.position.distanceToSquared(desiredPos.current) < 0.0009 &&
          controlsApi.target.distanceToSquared(desiredTarget.current) < 0.0009
        ) {
          camera.position.copy(desiredPos.current);
          controlsApi.target.copy(desiredTarget.current);
          controlsApi.update();
          animating.current = false;
        }
      } else {
        controlsApi.update();
      }
    });

    useEffect(() => {
      const controlsApi = controls.current;
      if (controlsApi) {
        controlsApi.autoRotate = autoRotate && !animating.current;
      }
    }, [autoRotate]);

    return (
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping
        dampingFactor={0.055}
        rotateSpeed={0.65}
        zoomSpeed={0.8}
        autoRotate={autoRotate}
        autoRotateSpeed={0.32}
        minDistance={shot.minDistance ?? 3.6}
        maxDistance={shot.maxDistance ?? 13}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2.04}
        enableRotate
        onStart={() => {
          animating.current = false;
          onUserInteract?.();
        }}
        target={desiredTarget.current}
      />
    );
  },
);

CameraRig.displayName = "CameraRig";

export default CameraRig;
