import type {} from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";

/**
 * Prémiové showroom prostředí — tmavý studiový prostor s HDRI-like
 * osvětlením přes Lightformery, leštěnou podlahou a soft shadows.
 *
 * Optimalizace:
 * - nákladné realtime shadow mapy jsou omezené,
 * - ContactShadows má nižší rozlišení,
 * - hlavní vzhled showroomu a odlesky laku zůstávají zachované.
 *
 * Canvas v PacificaShowroom.tsx řídí, zda se realtime shadow systém
 * používá na mobilu. ContactShadows zde zůstává jako měkký lokální stín.
 */

export const Showroom = () => {
  const floor = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#0b0e13",
        metalness: 0.55,
        roughness: 0.32,
        clearcoat: 0.6,
      }),
    [],
  );

  return (
    <group>
      <hemisphereLight args={["#8fb4ff", "#0a0c10", 0.5]} />

      {/* Hlavní studiové světlo.
          Shadow map je záměrně menší — 1024² je pro mobil zbytečně drahé. */}
      <directionalLight
        position={[6, 9, 6]}
        intensity={2.1}
        color="#ffffff"
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0004}
      />

      <directionalLight
        position={[-7, 5, -4]}
        intensity={0.8}
        color="#7fa6ff"
      />

      {/* Studiové odlesky laku.
          Resolution 192 je kompromis mezi kvalitou odlesků a GPU zátěží. */}
      <Environment resolution={192}>
        <Lightformer
          intensity={4}
          position={[0, 6, 4]}
          scale={[12, 2.5, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={2.4}
          position={[-6, 4, 0]}
          rotation-y={Math.PI / 2}
          scale={[10, 3, 1]}
          color="#cfe0ff"
        />
        <Lightformer
          intensity={2.4}
          position={[6, 4, 0]}
          rotation-y={-Math.PI / 2}
          scale={[10, 3, 1]}
          color="#cfe0ff"
        />
        <Lightformer
          intensity={1.6}
          position={[0, 3, -8]}
          scale={[12, 3, 1]}
          color="#9dbcff"
        />
      </Environment>

      {/* Podlaha */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        material={floor}
        receiveShadow
      >
        <circleGeometry args={[26, 48]} />
      </mesh>

      {/* Měkký lokální stín pod vozem.
          512 -> 256 výrazně snižuje GPU práci, ale vizuálně zůstává stín měkký. */}
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.72}
        scale={18}
        blur={2.6}
        far={4.2}
        resolution={256}
        color="#000000"
      />

      {/* Světelný kruh pod vozem */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
      >
        <ringGeometry args={[4.2, 4.35, 64]} />
        <meshBasicMaterial
          color="#2f6bd8"
          transparent
          opacity={0.35}
        />
      </mesh>

      <fog attach="fog" args={["#05070b", 14, 42]} />
    </group>
  );
};

export default Showroom;
