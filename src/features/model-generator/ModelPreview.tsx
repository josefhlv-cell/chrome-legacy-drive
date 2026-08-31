/**
 * ModelPreview — živý 3D náhled vozu složeného z base modelu + profilu.
 * Admin tady vidí přesně to, co skončí v GLB a následně v AR.
 */
import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, ContactShadows } from "@react-three/drei";
import { Loader2 } from "lucide-react";
import * as THREE from "three";
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

      <Canvas
        dpr={[1, 2]}
        // Celé auto v záběru: 5,2 m dlouhá Pacifica se do fov 30° vejde až
        // z ~11 m. Dřív kamera startovala na 9 m a minDistance 4, takže se
        // admin díval na detail dveří a hladké spáry vypadaly jako škrábance.
        camera={{ position: [8.6, 2.9, 9.4], fov: 30 }}
        shadows="soft"
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          // Filmové mapování tónů + korektní gamma = lak vypadá jako lak, ne jako plast.
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          // 1.05 přepalovalo světlé laky do bílé — barva pak nesouhlasila s vozem.
          gl.toneMappingExposure = 0.92;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 8, 4]} intensity={1.25} castShadow shadow-mapSize={[2048, 2048]} />
          {/* Dvě protisvětla vykreslí boční linie karoserie — klíč k „prémiovému“ dojmu. */}
          <spotLight position={[-7, 6, -5]} intensity={0.7} angle={0.7} penumbra={1} color="#cfe0ff" />
          <spotLight position={[0, 7, -8]} intensity={0.5} angle={0.8} penumbra={1} color="#ffffff" />
          <Environment preset="studio" environmentIntensity={0.85} />
          {scene && <primitive object={scene} />}
          <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={16} blur={2.2} far={4} resolution={1024} />
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={7}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2.05}
            autoRotate
            autoRotateSpeed={0.5}
          />
        </Suspense>

      </Canvas>

    </div>
  );
};

export default ModelPreview;
