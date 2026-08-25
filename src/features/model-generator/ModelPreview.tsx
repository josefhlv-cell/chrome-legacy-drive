/**
 * ModelPreview — živý 3D náhled vozu složeného z base modelu + profilu.
 * Admin tady vidí přesně to, co skončí v GLB a následně v AR.
 */
import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, ContactShadows } from "@react-three/drei";
import { Loader2 } from "lucide-react";
import type * as THREE from "three";
import { buildVehicleScene } from "./glbBuilder";
import type { AppearanceProfile } from "./appearance";

type Props = {
  profile: AppearanceProfile;
  /** Předá hotovou scénu nadřazené stránce (kvůli exportu GLB). */
  onSceneReady?: (scene: THREE.Group) => void;
};

export const ModelPreview = ({ profile, onSceneReady }: Props) => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    buildVehicleScene(profile)
      .then((next) => {
        if (cancelled) return;
        setScene(next);
        setError(null);
        onSceneReady?.(next);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Náhled modelu selhal:", e);
        setError(e instanceof Error ? e.message : "Model se nepodařilo načíst.");
      });

    return () => {
      cancelled = true;
    };
    // Přestavíme scénu při každé změně vzhledu.
  }, [profile, onSceneReady]);

  if (error) {
    return (
      <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-border/60 bg-secondary/30">
      {!scene && (
        <div className="absolute inset-0 z-10 grid place-items-center text-muted-foreground">
          <span className="inline-flex items-center gap-2 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Skládám model…
          </span>
        </div>
      )}

      <Canvas dpr={[1, 2]} camera={{ position: [6.2, 2.1, 6.6], fov: 32 }} shadows>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 8, 4]} intensity={1.4} castShadow />
          <Environment preset="studio" />
          {scene && <primitive object={scene} />}
          <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={16} blur={2.4} far={4} />
          <OrbitControls enablePan={false} minDistance={4} maxDistance={14} maxPolarAngle={Math.PI / 2.05} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ModelPreview;
