import type {} from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

/**
 * Procedurální placeholder vozu — SKUTEČNÝ 3D objekt (ne obrázek).
 *
 * Uzly jsou pojmenované přesně tak, jak je hledá `bindParts`, takže
 * po dodání reálného GLB modelu se stejná animační logika použije
 * bez jakéhokoli přepisování aplikace.
 */

const useMaterials = (bodyColor: string) =>
  useMemo(() => {
    const body = new THREE.MeshPhysicalMaterial({
      color: bodyColor,
      metalness: 0.9,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#0b1420",
      metalness: 0,
      roughness: 0.06,
      transmission: 0.85,
      transparent: true,
      opacity: 0.55,
      ior: 1.45,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: "#dfe6ee",
      metalness: 1,
      roughness: 0.12,
    });
    const rubber = new THREE.MeshStandardMaterial({ color: "#0d0f12", roughness: 0.95 });
    const trim = new THREE.MeshStandardMaterial({ color: "#15181d", roughness: 0.7 });
    const leather = new THREE.MeshStandardMaterial({ color: "#1d1b19", roughness: 0.85 });
    return { body, glass, chrome, rubber, trim, leather };
  }, [bodyColor]);

const Wheel = ({ position }: { position: [number, number, number] }) => {
  const rubber = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0c0e11", roughness: 0.92 }),
    [],
  );
  const rim = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#c9d2dc", metalness: 1, roughness: 0.18 }),
    [],
  );
  return (
    <group name="wheel" position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh material={rubber} castShadow>
        <cylinderGeometry args={[0.37, 0.37, 0.24, 40]} />
      </mesh>
      <mesh material={rim} position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.26, 24]} />
      </mesh>
    </group>
  );
};

type Props = { lights: boolean; bodyColor?: string };

export const ProceduralPacifica = ({ lights, bodyColor = "#1b2b45" }: Props) => {
  const m = useMaterials(bodyColor);

  const lamp = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#eaf2ff",
        emissive: new THREE.Color("#cfe3ff"),
        emissiveIntensity: 0,
      }),
    [],
  );
  lamp.emissiveIntensity = lights ? 3.4 : 0.05;

  const tail = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8c1420",
        emissive: new THREE.Color("#ff2a3a"),
        emissiveIntensity: 0,
      }),
    [],
  );
  tail.emissiveIntensity = lights ? 2.4 : 0.1;

  return (
    <group name="pacifica_placeholder">
      {/* Karoserie */}
      <mesh name="body_lower" material={m.body} position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.98, 0.86, 5.1]} />
      </mesh>
      <mesh name="body_upper" material={m.body} position={[0, 1.42, -0.25]} castShadow>
        <boxGeometry args={[1.86, 0.6, 3.5]} />
      </mesh>
      <mesh name="roof" material={m.body} position={[0, 1.73, -0.35]} castShadow>
        <boxGeometry args={[1.7, 0.06, 3.2]} />
      </mesh>

      {/* Prosklení */}
      <mesh name="windshield" material={m.glass} position={[0, 1.45, 1.42]} rotation={[-0.62, 0, 0]}>
        <boxGeometry args={[1.72, 1.1, 0.05]} />
      </mesh>
      <mesh name="glass_left" material={m.glass} position={[-0.94, 1.44, -0.4]}>
        <boxGeometry args={[0.04, 0.56, 3.2]} />
      </mesh>
      <mesh name="glass_right" material={m.glass} position={[0.94, 1.44, -0.4]}>
        <boxGeometry args={[0.04, 0.56, 3.2]} />
      </mesh>

      {/* Maska + světlomety */}
      <mesh name="grille" material={m.chrome} position={[0, 0.82, 2.56]}>
        <boxGeometry args={[1.5, 0.36, 0.06]} />
      </mesh>
      <mesh name="headlight_left" material={lamp} position={[-0.72, 0.96, 2.55]}>
        <boxGeometry args={[0.42, 0.18, 0.08]} />
      </mesh>
      <mesh name="headlight_right" material={lamp} position={[0.72, 0.96, 2.55]}>
        <boxGeometry args={[0.42, 0.18, 0.08]} />
      </mesh>
      <mesh name="taillight" material={tail} position={[0, 1.28, -2.55]}>
        <boxGeometry args={[1.7, 0.16, 0.06]} />
      </mesh>

      {/* Zrcátka */}
      <mesh name="mirror_left" material={m.trim} position={[-1.06, 1.32, 1.15]}>
        <boxGeometry args={[0.22, 0.12, 0.1]} />
      </mesh>
      <mesh name="mirror_right" material={m.trim} position={[1.06, 1.32, 1.15]}>
        <boxGeometry args={[0.22, 0.12, 0.1]} />
      </mesh>

      {/* Posuvné dveře — skutečné pohyblivé uzly */}
      <group name="door_left" position={[-1.0, 1.05, -0.2]}>
        <mesh material={m.body} castShadow>
          <boxGeometry args={[0.06, 1.3, 1.35]} />
        </mesh>
        <mesh material={m.glass} position={[-0.04, 0.38, 0]}>
          <boxGeometry args={[0.03, 0.5, 1.15]} />
        </mesh>
      </group>
      <group name="door_right" position={[1.0, 1.05, -0.2]}>
        <mesh material={m.body} castShadow>
          <boxGeometry args={[0.06, 1.3, 1.35]} />
        </mesh>
        <mesh material={m.glass} position={[0.04, 0.38, 0]}>
          <boxGeometry args={[0.03, 0.5, 1.15]} />
        </mesh>
      </group>

      {/* Liftgate — rotace kolem horního závěsu */}
      <group name="liftgate" position={[0, 1.72, -2.5]}>
        <mesh material={m.body} position={[0, -0.5, -0.05]} castShadow>
          <boxGeometry args={[1.8, 1.0, 0.08]} />
        </mesh>
        <mesh material={m.glass} position={[0, -0.16, -0.09]}>
          <boxGeometry args={[1.6, 0.5, 0.03]} />
        </mesh>
      </group>

      {/* Kapota */}
      <group name="hood" position={[0, 1.14, 1.7]}>
        <mesh material={m.body} position={[0, 0, 0.44]} castShadow>
          <boxGeometry args={[1.9, 0.08, 0.9]} />
        </mesh>
      </group>
      <mesh name="engine_block" material={m.trim} position={[0, 0.98, 2.05]}>
        <boxGeometry args={[1.5, 0.34, 0.85]} />
      </mesh>

      {/* Interiér */}
      <mesh name="dashboard" material={m.trim} position={[0, 1.12, 0.95]}>
        <boxGeometry args={[1.7, 0.24, 0.3]} />
      </mesh>
      <mesh name="uconnect" material={m.chrome} position={[0, 1.2, 0.79]}>
        <boxGeometry args={[0.42, 0.24, 0.02]} />
      </mesh>
      <group name="steering_wheel" position={[-0.42, 1.16, 0.68]} rotation={[1.15, 0, 0]}>
        <mesh material={m.trim}>
          <torusGeometry args={[0.17, 0.028, 12, 32]} />
        </mesh>
      </group>

      {/* Sedadla */}
      <mesh name="seat_front_left" material={m.leather} position={[-0.45, 1.0, 0.15]}>
        <boxGeometry args={[0.5, 0.9, 0.5]} />
      </mesh>
      <mesh name="seat_front_right" material={m.leather} position={[0.45, 1.0, 0.15]}>
        <boxGeometry args={[0.5, 0.9, 0.5]} />
      </mesh>
      <group name="seat_row2" position={[0, 0.85, -0.7]}>
        <mesh material={m.leather} position={[-0.45, 0.2, 0]}>
          <boxGeometry args={[0.5, 0.82, 0.46]} />
        </mesh>
        <mesh material={m.leather} position={[0.45, 0.2, 0]}>
          <boxGeometry args={[0.5, 0.82, 0.46]} />
        </mesh>
      </group>
      <group name="seat_row3" position={[0, 0.85, -1.75]}>
        <mesh material={m.leather} position={[0, 0.18, 0]}>
          <boxGeometry args={[1.5, 0.78, 0.44]} />
        </mesh>
      </group>

      {/* Kola */}
      <Wheel position={[-0.99, 0.37, 1.63]} />
      <Wheel position={[0.99, 0.37, 1.63]} />
      <Wheel position={[-0.99, 0.37, -1.55]} />
      <Wheel position={[0.99, 0.37, -1.55]} />

      {/* Světelné kužely při zapnutých světlech */}
      {lights && (
        <>
          <spotLight
            position={[-0.72, 0.96, 2.6]}
            target-position={[-0.9, 0, 9]}
            angle={0.5}
            penumbra={0.8}
            intensity={26}
            distance={16}
            color="#dceaff"
          />
          <spotLight
            position={[0.72, 0.96, 2.6]}
            target-position={[0.9, 0, 9]}
            angle={0.5}
            penumbra={0.8}
            intensity={26}
            distance={16}
            color="#dceaff"
          />
        </>
      )}
    </group>
  );
};

export default ProceduralPacifica;
