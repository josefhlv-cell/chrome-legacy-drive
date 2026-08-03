// ============================================================================
// SHOWROOM STATIC TEMPLATE — mirror of /public/assets/showroom/*.json
// The edge runtime cannot read /public, so the locked values live here too.
// READ ONLY: never generate, never mutate at runtime.
// ============================================================================

export const CAMERA_VERSION = "camera-v1";
export const BACKGROUND_VERSION = "background-v3";
export const PLACEMENT_VERSION = "placement-v1";
export const LIGHTING_VERSION = "lighting-v1";
export const GROUND_VERSION = "ground-v3";

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

/** Locked camera (camera.json). */
export const CAMERA = {
  focal_length_mm: 50,
  field_of_view_deg: 39.6,
  pitch_deg: -1.8,
  yaw_deg: 0,
  roll_deg: 0,
  horizon_y: 640,
  jpeg_quality: 94,
} as const;

/** Ground plane (ground_plane.json). */
export const GROUND = {
  wheelLineY: 1015,
  anchorX: 960,
  usableMinX: 210,
  usableMaxX: 1710,
  wallFloorSeamY: 640,
  ambientReachRatio: 0.11,
  contactReachRatio: 0.022,
  ambientOpacity: 0.30,
  contactOpacity: 0.58,
  reflectionOpacity: 0.14,
} as const;

/** Reserved wall artwork. A vehicle is never allowed to enter this zone. */
export const LOGO_SAFE_ZONE = {
  minX: 610,
  maxX: 1450,
  minY: 235,
  maxY: 565,
  clearancePx: 18,
} as const;

export type VehicleClass =
  | "CITY" | "HATCHBACK" | "SEDAN" | "COUPE" | "CABRIO"
  | "WAGON" | "SUV" | "PICKUP" | "VAN";

export type ClassProfile = {
  scale: number;            // share of canvas width
  wheelbase_ratio: number;
  ground_clearance: number;
  shadow_size: number;
  offset_x: number;
  offset_y: number;
};

/** Per-class default profiles (placement_rules.json). */
export const CLASS_PROFILES: Record<VehicleClass, ClassProfile> = {
  CITY:      { scale: 0.40, wheelbase_ratio: 0.58, ground_clearance: 0.030, shadow_size: 0.90, offset_x: 0, offset_y: 0 },
  HATCHBACK: { scale: 0.43, wheelbase_ratio: 0.59, ground_clearance: 0.032, shadow_size: 0.92, offset_x: 0, offset_y: 0 },
  SEDAN:     { scale: 0.47, wheelbase_ratio: 0.62, ground_clearance: 0.030, shadow_size: 1.00, offset_x: 0, offset_y: 0 },
  COUPE:     { scale: 0.46, wheelbase_ratio: 0.61, ground_clearance: 0.028, shadow_size: 0.96, offset_x: 0, offset_y: 0 },
  CABRIO:    { scale: 0.46, wheelbase_ratio: 0.61, ground_clearance: 0.028, shadow_size: 0.96, offset_x: 0, offset_y: 0 },
  WAGON:     { scale: 0.48, wheelbase_ratio: 0.63, ground_clearance: 0.032, shadow_size: 1.02, offset_x: 0, offset_y: 0 },
  SUV:       { scale: 0.49, wheelbase_ratio: 0.61, ground_clearance: 0.045, shadow_size: 1.05, offset_x: 0, offset_y: 0 },
  PICKUP:    { scale: 0.52, wheelbase_ratio: 0.66, ground_clearance: 0.050, shadow_size: 1.10, offset_x: 0, offset_y: 0 },
  VAN:       { scale: 0.49, wheelbase_ratio: 0.64, ground_clearance: 0.040, shadow_size: 1.08, offset_x: 0, offset_y: 0 },
};

export const PLACEMENT_LIMITS = {
  maxRotationDeg: 1,
  minFrameMarginPx: 24,
  maxCarWidthRatio: 0.54,
  maxCarHeightRatio: 0.40,
} as const;

export const VALIDATION = {
  minScore: 0.72,
  maxAttempts: 2,
} as const;

/** Placement actually used for one composite. */
export type Placement = {
  scale: number;      // share of canvas width
  offsetX: number;    // px, + right
  offsetY: number;    // px, + down
  rotationDeg: number;
  shadowOpacity: number;  // multiplier on template opacities
  shadowBlur: number;     // multiplier on shadow reach
  shadowOffsetY: number;  // px
};

export const placementFromProfile = (cls: VehicleClass, over?: Partial<Placement> | null): Placement => {
  const p = CLASS_PROFILES[cls];
  const base: Placement = {
    scale: p.scale,
    offsetX: p.offset_x,
    offsetY: p.offset_y,
    rotationDeg: 0,
    shadowOpacity: 1,
    shadowBlur: p.shadow_size,
    shadowOffsetY: 0,
  };
  const merged = { ...base, ...(over ?? {}) };
  return {
    scale: clamp(merged.scale, 0.34, PLACEMENT_LIMITS.maxCarWidthRatio),
    offsetX: clamp(merged.offsetX, -300, 300),
    offsetY: clamp(merged.offsetY, -160, 160),
    rotationDeg: clamp(merged.rotationDeg, -PLACEMENT_LIMITS.maxRotationDeg, PLACEMENT_LIMITS.maxRotationDeg),
    shadowOpacity: clamp(merged.shadowOpacity, 0, 2),
    shadowBlur: clamp(merged.shadowBlur, 0.4, 2),
    shadowOffsetY: clamp(merged.shadowOffsetY, -40, 40),
  };
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}

/** Stable key for the learned-placement model database. */
export const modelKey = (name: string) =>
  (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join("-") || "unknown";

const CLASS_KEYWORDS: Array<[RegExp, VehicleClass]> = [
  [/pickup|pick-up|ram 1500|ram 2500|ram 3500|dakota|gladiator/i, "PICKUP"],
  [/van\b|voyager|pacifica|grand caravan|caravan|town & country|town and country|promaster|transit/i, "VAN"],
  [/suv|durango|journey|nitro|compass|patriot|cherokee|renegade|wrangler|aspen|hornet/i, "SUV"],
  [/kombi|wagon|estate|touring|magnum/i, "WAGON"],
  [/cabrio|kabriolet|convertible|roadster|spyder|spider/i, "CABRIO"],
  [/coupe|kupé|kupe|challenger|barracuda|crossfire/i, "COUPE"],
  [/sedan|limuzína|limuzina|300c|300 c|\b300\b|charger|neon|stratus|sebring|avenger|flavia|dart/i, "SEDAN"],
  [/hatchback|hatch|liftback|caliber|delta|ypsilon/i, "HATCHBACK"],
  [/city|mikro|smart|panda|500\b/i, "CITY"],
];

/**
 * Deterministic class detection from the vehicle record — no AI involved.
 * TipCars body code / description wins, the vehicle name is the fallback.
 */
export function detectVehicleClass(vehicle: Record<string, unknown> | null | undefined): VehicleClass {
  const haystack = [
    vehicle?.["tipcars_karoserie_popis"],
    vehicle?.["tipcars_karoserie_kod"],
    vehicle?.["name"],
  ]
    .filter((v) => typeof v === "string")
    .join(" ");
  for (const [re, cls] of CLASS_KEYWORDS) if (re.test(haystack)) return cls;
  return "SEDAN";
}
