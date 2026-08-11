import type { Object3D } from "three";

/**
 * Definice skutečných pohyblivých částí vozu.
 *
 * Každá část má seznam možných názvů uzlů (node names) — první odpovídá
 * proceduálnímu placeholder modelu, další jsou obvyklé názvy v dodaných
 * GLB/GLTF modelech. Transformace jsou SKUTEČNÉ (pozice/rotace uzlů),
 * nikoli CSS animace.
 */
export type PartKey =
  | "doorLeft"
  | "doorRight"
  | "liftgate"
  | "hood"
  | "row2"
  | "row3";

export type PartDef = {
  /** Kandidátní názvy uzlů v modelu (case-insensitive, substring match). */
  nodes: string[];
  /** Volitelný název GLTF animace, pokud ji model obsahuje. */
  clips?: string[];
  /** Offset pozice při plném otevření (metry). */
  position?: [number, number, number];
  /** Offset rotace při plném otevření (radiány). */
  rotation?: [number, number, number];
};

export const PARTS: Record<PartKey, PartDef> = {
  doorLeft: {
    nodes: ["door_left", "slidingdoorl", "door_sliding_left", "doorleft"],
    clips: ["door_left_open", "SlidingDoorLeft"],
    position: [0, 0, -0.95],
  },
  doorRight: {
    nodes: ["door_right", "slidingdoorr", "door_sliding_right", "doorright"],
    clips: ["door_right_open", "SlidingDoorRight"],
    position: [0, 0, -0.95],
  },
  liftgate: {
    nodes: ["liftgate", "tailgate", "trunk", "hatch"],
    clips: ["liftgate_open", "Liftgate"],
    rotation: [-1.1, 0, 0],
  },
  hood: {
    nodes: ["hood", "bonnet"],
    clips: ["hood_open", "Hood"],
    rotation: [-0.62, 0, 0],
  },
  row2: {
    nodes: ["seat_row2", "row2", "seat2"],
    clips: ["row2_fold"],
    rotation: [-1.45, 0, 0],
    position: [0, -0.28, 0.16],
  },
  row3: {
    nodes: ["seat_row3", "row3", "seat3"],
    clips: ["row3_fold"],
    rotation: [-1.5, 0, 0],
    position: [0, -0.32, 0.18],
  },
};

export type PartState = Record<PartKey, number>;

export const CLOSED_STATE: PartState = {
  doorLeft: 0,
  doorRight: 0,
  liftgate: 0,
  hood: 0,
  row2: 0,
  row3: 0,
};

const matches = (name: string, candidates: string[]) => {
  const n = name.toLowerCase();
  return candidates.some((c) => n.includes(c));
};

export type PartBinding = {
  key: PartKey;
  object: Object3D;
  base: { position: [number, number, number]; rotation: [number, number, number] };
};

/** Najde v modelu skutečné uzly odpovídající pohyblivým částem. */
export const bindParts = (root: Object3D): PartBinding[] => {
  const found: PartBinding[] = [];
  const used = new Set<Object3D>();

  (Object.keys(PARTS) as PartKey[]).forEach((key) => {
    const def = PARTS[key];
    root.traverse((child) => {
      if (used.has(child)) return;
      if (found.some((f) => f.key === key)) return;
      if (!child.name || !matches(child.name, def.nodes)) return;
      used.add(child);
      found.push({
        key,
        object: child,
        base: {
          position: [child.position.x, child.position.y, child.position.z],
          rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
        },
      });
    });
  });

  return found;
};

/** Aplikuje skutečné transformace uzlů podle aktuálního (interpolovaného) stavu. */
export const applyPartState = (bindings: PartBinding[], state: PartState) => {
  bindings.forEach(({ key, object, base }) => {
    const t = state[key] ?? 0;
    const def = PARTS[key];
    const p = def.position ?? [0, 0, 0];
    const r = def.rotation ?? [0, 0, 0];
    object.position.set(base.position[0] + p[0] * t, base.position[1] + p[1] * t, base.position[2] + p[2] * t);
    object.rotation.set(base.rotation[0] + r[0] * t, base.rotation[1] + r[1] * t, base.rotation[2] + r[2] * t);
  });
};
