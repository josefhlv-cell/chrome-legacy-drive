import type {} from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";

type Props = {
  mobile?: boolean;
};

export const Showroom = ({ mobile = false }: Props) => {
  const floor = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0b0e13",
        metalness: 0.42,
        roughness: 0.3,
        envMapIntensity: 0.8,
      }),
    [],
  );

  return (
    <group>
      <hemisphereLight
        args={["#9ab8ee", "#080b10", mobile ? 0.42 : 0.5]}
      />

      <directionalLight
        position={[6, 9, 6]}
        intensity={mobile ? 1.75 : 2.2}
        color="#ffffff"
        castShadow={!mobile}
        shadow-mapSize={[mobile ? 256 : 1024, mobile ? 256 : 1024]}
        shadow-bias={-0.0004}
      />

      <directionalLight
        position={[-7, 5, -4]}
        intensity={mobile ? 0.65 : 0.85}
        color="#7fa6ff"
      />

      <directionalLight
        position={[0, 4, -8]}
        intensity={mobile ? 0.35 : 0.55}
        color="#9dbcff"
      />

      <Environment resolution={mobile ? 128 : 256}>
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
          intensity={1.8}
          position={[0, 3, -8]}
          scale={[12, 3, 1]}
          color="#9dbcff"
        />
      </Environment>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        material={floor}
        receiveShadow={!mobile}
      >
        <circleGeometry args={[26, 48]} />
      </mesh>

      {/* Na mobilu jsou dynamické stíny vypnuté kvůli výkonu. Bez jakéhokoli
          stínu ale auto opticky „plave“ nad podlahou — proto je pod vozem
          statická kontaktní stínová textura (jeden draw call, nulový náklad). */}
      {mobile ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <planeGeometry args={[8.4, 4.2]} />
          <meshBasicMaterial
            transparent
            depthWrite={false}
            opacity={0.72}
            color="#000000"
            map={staticShadow}
          />
        </mesh>
      ) : (
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.72}
          scale={18}
          blur={2.8}
          far={4.2}
          resolution={384}
          frames={1}
          color="#000000"
        />
      )}


      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[4.2, 4.35, 64]} />
        <meshBasicMaterial color="#2f6bd8" transparent opacity={0.28} />
      </mesh>

      <fog attach="fog" args={["#05070b", 16, 46]} />
    </group>
  );
};

export default Showroom;
