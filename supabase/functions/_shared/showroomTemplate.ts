// ============================================================================
// SHOWROOM STATIC TEMPLATE — mirror of /public/assets/showroom/*.json
// The edge runtime cannot read /public, so the locked values live here too.
// READ ONLY: never generate, never mutate at runtime.
// ============================================================================

export const CAMERA_VERSION = "camera-v3";
export const BACKGROUND_VERSION = "background-v7";
export const PLACEMENT_VERSION = "placement-v9";
export const LIGHTING_VERSION = "lighting-v3";
export const GROUND_VERSION = "ground-v7";

// Native pixels of the approved CHDP master plate (chdp-showroom-master.jpeg).
// Output = exactly these pixels. Never stretch or crop the plate. The physical
// wall (6.60 × 3.00 m) is NOT the canvas aspect and must never drive a resize.
export const CANVAS_W = 1920;
export const CANVAS_H = 1082;

/** Locked camera (camera.json). */
export const CAMERA = {
  focal_length_mm: 50,
  field_of_view_deg: 39.6,
  pitch_deg: -1.8,
  yaw_deg: 0,
  roll_deg: 0,
  horizon_y: 379,
  jpeg_quality: 94,
} as const;

/**
 * Ground plane measured on the 1920×1082 master plate:
 *  - wall/floor seam (baseboard) y ≈ 666
 *  - white floor circle: x 105–1790, y 705–995, centre ≈ (948, 850)
 * The nearest tyre (bottom of the 3/4 bbox) stands on the front arc of the
 * circle, like the approved RAM reference.
 */
export const GROUND = {
  wheelLineY: 985,
  anchorX: 948,
  usableMinX: 60,
  usableMaxX: 1860,
  wallFloorSeamY: 666,
  ceilingBottomY: 78,
  ambientReachRatio: 0.12,
  contactReachRatio: 0.03,
  ambientOpacity: 0.36,
  contactOpacity: 0.78,
  reflectionOpacity: 0.18,
} as const;

/** CHDP wall shield (whole artwork incl. wordmark). Checked per silhouette
 * column, so the low rear of a 3/4 view may pass beneath it, never over it. */
export const LOGO_SAFE_ZONE = {
  minX: 1452,
  maxX: 1760,
  minY: 136,
  maxY: 458,
  clearancePx: 10,
} as const;

export type VehicleClass =
  | "CITY" | "HATCHBACK" | "SEDAN" | "COUPE" | "CABRIO"
  | "WAGON" | "SUV" | "MPV" | "PICKUP" | "VAN";

export type ClassProfile = {
  scale: number;            // default share of canvas width
  minScale: number;         // allowed range for this body type
  maxScale: number;
  wheelbase_ratio: number;
  ground_clearance: number;
  shadow_size: number;
  offset_x: number;
  offset_y: number;
};

/** Per-class width share of the 1920 px canvas (approved ranges). */
export const CLASS_PROFILES: Record<VehicleClass, ClassProfile> = {
  CITY:      { scale: 0.60, minScale: 0.55, maxScale: 0.66, wheelbase_ratio: 0.58, ground_clearance: 0.030, shadow_size: 0.90, offset_x: 0, offset_y: 0 },
  HATCHBACK: { scale: 0.63, minScale: 0.58, maxScale: 0.69, wheelbase_ratio: 0.59, ground_clearance: 0.032, shadow_size: 0.92, offset_x: 0, offset_y: 0 },
  SEDAN:     { scale: 0.685, minScale: 0.65, maxScale: 0.72, wheelbase_ratio: 0.62, ground_clearance: 0.030, shadow_size: 1.00, offset_x: 0, offset_y: 0 },
  COUPE:     { scale: 0.67, minScale: 0.63, maxScale: 0.71, wheelbase_ratio: 0.61, ground_clearance: 0.028, shadow_size: 0.96, offset_x: 0, offset_y: 0 },
  CABRIO:    { scale: 0.67, minScale: 0.63, maxScale: 0.71, wheelbase_ratio: 0.61, ground_clearance: 0.028, shadow_size: 0.96, offset_x: 0, offset_y: 0 },
  WAGON:     { scale: 0.76, minScale: 0.68, maxScale: 0.76, wheelbase_ratio: 0.63, ground_clearance: 0.032, shadow_size: 1.02, offset_x: 0, offset_y: 0 },
  SUV:       { scale: 0.78, minScale: 0.70, maxScale: 0.78, wheelbase_ratio: 0.61, ground_clearance: 0.045, shadow_size: 1.05, offset_x: 0, offset_y: 0 },
  MPV:       { scale: 0.78, minScale: 0.72, maxScale: 0.78, wheelbase_ratio: 0.64, ground_clearance: 0.038, shadow_size: 1.06, offset_x: 0, offset_y: 0 },
  PICKUP:    { scale: 0.82, minScale: 0.74, maxScale: 0.82, wheelbase_ratio: 0.66, ground_clearance: 0.050, shadow_size: 1.10, offset_x: 0, offset_y: 0 },
  VAN:       { scale: 0.82, minScale: 0.74, maxScale: 0.82, wheelbase_ratio: 0.64, ground_clearance: 0.040, shadow_size: 1.08, offset_x: 0, offset_y: 0 },
};

export const PLACEMENT_LIMITS = {
  maxRotationDeg: 1,
  minFrameMarginPx: 24,
  minCarWidthRatio: 0.44,
  maxCarWidthRatio: 0.82,
  maxCarHeightRatio: 0.80,
} as const;

/** Exact pixel width range for a class: round(min·1920) … round(max·1920). */
export function classWidthRangePx(cls: VehicleClass) {
  const p = CLASS_PROFILES[cls];
  return { min: Math.round(CANVAS_W * p.minScale), max: Math.round(CANVAS_W * p.maxScale) };
}

/** Tallest car that still keeps the ceiling margin above it. */
export const MAX_CAR_HEIGHT_PX = Math.min(
  Math.round(CANVAS_H * PLACEMENT_LIMITS.maxCarHeightRatio),
  GROUND.wheelLineY - GROUND.ceilingBottomY - PLACEMENT_LIMITS.minFrameMarginPx,
);

/**
 * Proportional target size from the REAL alpha cutout. One common scale factor
 * for both axes. If the class width would make the car too tall, both sides
 * shrink together — the result can then fall below the class minimum, which
 * `checkPlacementGeometry` rejects (never silently accepted).
 */
export function computeTargetSize(carW: number, carH: number, scale: number) {
  const aspect = carW / carH;
  let w = Math.round(CANVAS_W * scale);
  let h = Math.round(w / aspect);
  if (h > MAX_CAR_HEIGHT_PX) {
    h = MAX_CAR_HEIGHT_PX;
    w = Math.round(h * aspect);
  }
  return { w, h };
}

/** Bottom-centre anchor on the tyre line; clamped inside the frame margins. */
export function computeCarPosition(targetW: number, targetH: number, place: Pick<Placement, "offsetX" | "offsetY">) {
  const m = PLACEMENT_LIMITS.minFrameMarginPx;
  const carX = Math.max(m, Math.min(CANVAS_W - m - targetW, Math.round(GROUND.anchorX - targetW / 2 + place.offsetX)));
  const carY = Math.round(GROUND.wheelLineY + place.offsetY) - targetH;
  return { carX, carY };
}

/** Lowest silhouette row hitting the logo columns must stay below the shield. */
export function silhouetteClearsLogo(columnTops: ReadonlyArray<number | null>, carX: number, carY: number) {
  const required = LOGO_SAFE_ZONE.maxY + LOGO_SAFE_ZONE.clearancePx;
  let highest = Infinity;
  const x0 = Math.max(0, LOGO_SAFE_ZONE.minX - carX);
  const x1 = Math.min(columnTops.length - 1, LOGO_SAFE_ZONE.maxX - carX);
  for (let x = x0; x <= x1; x++) {
    const t = columnTops[x];
    if (t != null) highest = Math.min(highest, carY + t);
  }
  return { ok: highest >= required, highest, required };
}

export type GeometryCheck = { check: string; ok: boolean; detail: string };

/**
 * Deterministic geometry gate (pure, unit-tested). Every check here is
 * mandatory in the pipeline: canvas size, aspect preservation, frame, tyre
 * line and the exact per-class pixel width range.
 */
export function checkPlacementGeometry(a: {
  canvasW: number; canvasH: number;
  sourceW: number; sourceH: number;
  targetW: number; targetH: number;
  carX: number; carY: number;
  vehicleClass: VehicleClass;
}): GeometryCheck[] {
  const m = PLACEMENT_LIMITS.minFrameMarginPx;
  const range = classWidthRangePx(a.vehicleClass);
  const srcAspect = a.sourceW / a.sourceH, dstAspect = a.targetW / a.targetH;
  // 1 px rounding on the shorter side is the only tolerated difference.
  const aspectTol = 1 / Math.min(a.targetW, a.targetH) * dstAspect + 1e-9;
  return [
    { check: "canvas_exact", ok: a.canvasW === CANVAS_W && a.canvasH === CANVAS_H, detail: `${a.canvasW}x${a.canvasH}` },
    { check: "aspect_preserved", ok: Math.abs(srcAspect - dstAspect) <= aspectTol, detail: `src=${srcAspect.toFixed(4)} dst=${dstAspect.toFixed(4)}` },
    { check: "inside_frame", ok: a.carX >= m && a.carY >= m && a.carX + a.targetW <= CANVAS_W - m && a.carY + a.targetH <= CANVAS_H - m, detail: `x=${a.carX} y=${a.carY} w=${a.targetW} h=${a.targetH}` },
    { check: "wheels_on_asphalt", ok: a.carY + a.targetH === GROUND.wheelLineY, detail: `wheelY=${a.carY + a.targetH}` },
    { check: "class_scale", ok: a.targetW >= range.min && a.targetW <= range.max, detail: `${a.vehicleClass} w=${a.targetW}px range=${range.min}-${range.max}` },
  ];
}

/**
 * Contact-shadow rows for one silhouette column. Starts 1 px BELOW the lowest
 * tyre pixel, so the shadow never darkens the tyre image itself.
 */
export function contactShadowRows(floorY: number, reach: number): number[] {
  const rows: number[] = [];
  for (let d = 1; d <= reach; d++) rows.push(floorY + d);
  return rows;
}

export const VALIDATION = {
  minScore: 0.72,
  maxAttempts: 3,
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
    // Saved/learned overrides can never leave the body-type range.
    scale: clamp(merged.scale, p.minScale, p.maxScale),
    offsetX: clamp(merged.offsetX, -384, 384),
    offsetY: clamp(merged.offsetY, -200, 60),
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

/** TipCars karoserie codes (case-sensitive). "G" (VAN) in the passenger group is a minivan. */
const TIPCARS_BODY_CODES: Record<string, VehicleClass> = {
  a: "HATCHBACK", w: "HATCHBACK", b: "SEDAN", A: "SEDAN", C: "CABRIO", D: "COUPE",
  B: "WAGON", G: "MPV", c: "MPV", d: "SUV", A1: "SUV", "[": "SUV", "}": "PICKUP", A2: "VAN",
};

const CLASS_KEYWORDS: Array<[RegExp, VehicleClass]> = [
  [/pick[\s-]?up|ram\s*(1500|2500|3500)|dakota/i, "PICKUP"],
  [/\bmpv\b|minivan|voyager|pacifica|caravan|town\s*(&|and)?\s*country/i, "MPV"],
  [/dod[aá]vk|minibus|promaster|transit|sprinter|\bvan\b/i, "VAN"],
  [/\bsuv\b|\bcuv\b|ter[eé]nn|durango|journey|nitro|aspen|hornet/i, "SUV"],
  [/kombi|wagon|estate|touring|magnum/i, "WAGON"],
  [/cabrio|kabriolet|convertible|roadster|spyder|spider/i, "CABRIO"],
  [/coupe|kupé|kupe|challenger|barracuda|crossfire/i, "COUPE"],
  [/sedan|limuzína|limuzina|300c|300 c|\b300\b|charger|neon|stratus|sebring|avenger|flavia|dart/i, "SEDAN"],
  [/hatchback|hatch|liftback|caliber|delta|ypsilon/i, "HATCHBACK"],
  [/city|mikro|smart|panda|500\b/i, "CITY"],
];

const matchKeywords = (text: string): VehicleClass | null => {
  for (const [re, cls] of CLASS_KEYWORDS) if (re.test(text)) return cls;
  return null;
};

/**
 * Known model families override generic marketplace body codes. This prevents
 * a bad/incomplete TipCars classification (e.g. Town & Country tagged as sedan)
 * from forcing the wrong scale. Generic vehicles still use TipCars code →
 * TipCars description → name → SEDAN.
 */
const KNOWN_MODEL_CLASSES: Array<[RegExp, VehicleClass]> = [
  [/\b(?:chrysler\s+)?town\s*(?:&|and)?\s*country\b|\bvoyager\b|\bpacifica\b|\b(?:grand\s+)?caravan\b/i, "MPV"],
  [/\b(?:dodge\s+)?ram\s*(?:1500|2500|3500)\b|\bdakota\b/i, "PICKUP"],
  [/\bpromaster\b/i, "VAN"],
  [/\bmagnum\b|\b300\s?c?\b.*\b(?:touring|kombi|wagon)\b/i, "WAGON"],
  [/\bdurango\b|\bjourney\b|\bnitro\b|\baspen\b|\bhornet\b/i, "SUV"],
  [/\bchallenger\b|\bbarracuda\b|\bcrossfire\b/i, "COUPE"],
  [/\b300c\b|\bcharger\b|\bneon\b|\bstratus\b|\bsebring\b|\bavenger\b/i, "SEDAN"],
];

const VEHICLE_CLASSES = new Set<VehicleClass>(Object.keys(CLASS_PROFILES) as VehicleClass[]);

/**
 * Precedence: 1) explicit reliable class (`vehicle_class`, only when it is a
 * valid class — the vehicles table currently has no such column, marketplace
 * codes are NOT treated as reliable) → 2) known model family → 3) TipCars code
 * → 4) TipCars description → 5) name keywords → SEDAN.
 */
export function detectVehicleClass(vehicle: Record<string, unknown> | null | undefined): VehicleClass {
  const explicit = vehicle?.["vehicle_class"];
  if (typeof explicit === "string" && VEHICLE_CLASSES.has(explicit.trim().toUpperCase() as VehicleClass)) {
    return explicit.trim().toUpperCase() as VehicleClass;
  }
  const name = typeof vehicle?.["name"] === "string" ? vehicle["name"] as string : "";
  for (const [pattern, cls] of KNOWN_MODEL_CLASSES) if (pattern.test(name)) return cls;

  const code = vehicle?.["tipcars_karoserie_kod"];
  if (typeof code === "string" && TIPCARS_BODY_CODES[code.trim()]) return TIPCARS_BODY_CODES[code.trim()];
  const desc = vehicle?.["tipcars_karoserie_popis"];
  if (typeof desc === "string" && desc.trim()) {
    const fromDesc = matchKeywords(desc);
    if (fromDesc) return fromDesc;
  }
  return matchKeywords(name) || "SEDAN";
}
