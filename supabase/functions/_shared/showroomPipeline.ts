// deno-lint-ignore-file no-explicit-any
// ============================================================================
// SHOWROOM PIPELINE — shared by `showroom-generate` (single, admin UI) and
// `showroom-batch` (bulk regeneration).
//
// THE ONE AND ONLY SHOWROOM BACKGROUND: a single fixed JPEG in storage.
// The AI NEVER generates a background — it only cuts the vehicle out.
// Placement/scale are computed mathematically, so every vehicle ends up on the
// identical background at the identical scale.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

export const BACKGROUND_URL =
  `${SUPABASE_URL}/storage/v1/object/public/vehicles/showroom/_assets/background-v1.jpg`;

const CANVAS_W = 1920;
const CANVAS_H = 1080;
// Fixed catalog geometry — identical for every single vehicle.
const CAR_WIDTH_RATIO = 0.72; // vehicle spans 72 % of the canvas width
const MAX_CAR_HEIGHT_RATIO = 0.60; // never taller than 60 % of the canvas
// The wall/floor seam of the fixed background sits at y ≈ 840 (of 1080). The
// tyres must land clearly BELOW it, on the polished floor — otherwise the car
// visually leans against the wall and looks pasted on.
const WHEEL_LINE_Y_RATIO = 0.945; // tyres touch the floor at y ≈ 1020


// The model cannot be trusted to emit a real alpha channel — it paints a fake
// "transparency checkerboard" instead. So we ask for a CHROMA KEY background
// (pure magenta, a colour that never occurs on a car) and remove it ourselves,
// deterministically, in code.
export const CHROMA = { r: 255, g: 0, b: 255 };

const CUTOUT_PROMPT = `CHROMA-KEY CUTOUT MODE — REPLACE THE BACKGROUND WITH SOLID MAGENTA.

TASK: Return ONE image of the supplied vehicle where every single background pixel is replaced by PERFECTLY UNIFORM, FULLY SATURATED PURE MAGENTA (hex #FF00FF, RGB 255,0,255). The magenta must be one flat, even colour — no texture, no gradient, no shading, no noise.

ABSOLUTE VEHICLE IDENTITY LOCK — the vehicle must stay 100% pixel-faithful to the source:
Do not change or re-draw the body, paint colour, panels, wheels, tyres, glass, headlights, taillights, badges, grille, mirrors, trim, licence plate, damage, reflections, perspective, camera angle, orientation, proportions or sharpness. No mirroring, no rotating, no tilting, no re-posing, no re-styling, no re-rendering, no beautifying. Keep the vehicle perfectly level exactly as in the source.

REPLACE WITH MAGENTA: every background pixel — floor, ground, asphalt, walls, buildings, sky, plants, people, other cars, signs, and every shadow cast on the ground.
KEEP: only the vehicle itself, including its own dark under-body area, its glass and everything visible through the glass.

STRICTLY FORBIDDEN: no transparency checkerboard pattern, no chequered squares, no grey/white tiles, no alpha preview pattern, no white or grey fill, no gradient, no drop shadow, no glow, no outline, no halo, no matte fringe, no text, no watermark, no border, no second copy of the car. Magenta must not appear anywhere on the vehicle itself.

OUTPUT: exactly ONE image, vehicle tightly framed and perfectly level, on a flat pure magenta (#FF00FF) background, same orientation as the source.`;


export type AdminClient = ReturnType<typeof createClient>;

export function createAdminClient(): AdminClient {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function setImageState(admin: AdminClient, imageId: string, patch: Record<string, unknown>) {
  await admin.from("vehicle_images").update(patch).eq("id", imageId);
}

async function appendHistory(admin: AdminClient, imageId: string, event: string, detail = "") {
  const { data } = await admin
    .from("vehicle_images")
    .select("showroom_history")
    .eq("id", imageId)
    .maybeSingle();
  const prev = Array.isArray((data as any)?.showroom_history) ? (data as any).showroom_history : [];
  const next = [...prev.slice(-19), { at: new Date().toISOString(), event, detail }];
  await admin.from("vehicle_images").update({ showroom_history: next }).eq("id", imageId);
}

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch ${url} → ${r.status}`);
  const contentType = r.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error(`Invalid image type: ${contentType}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < 5_000) throw new Error("Image too small or corrupted");
  return { bytes, contentType };
}

function toDataUrl(bytes: Uint8Array, contentType: string): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return `data:${contentType};base64,${btoa(bin)}`;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL from AI");
  const contentType = m[1].toLowerCase();
  const b = atob(m[2]);
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  return { bytes, contentType };
}

function extractImageDataUrl(aiData: any): string | undefined {
  return aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url
    ?? aiData?.choices?.[0]?.message?.images?.[0]?.url
    ?? aiData?.choices?.[0]?.message?.content?.find?.((part: any) => part?.type === "image_url")?.image_url?.url;
}

/**
 * Erases a painted transparency CHECKERBOARD anywhere in the image — including
 * the patches the model paints INSIDE the vehicle outline (windscreen, under the
 * bumper), which a border flood fill can never reach.
 *
 * Detection is pattern based, not colour based: a pixel is only erased when it
 * matches one of the two dominant neutral border tones AND a pixel exactly one
 * cell away matches the OTHER tone. A large flat white/silver car panel never
 * satisfies that, so light-coloured bodywork is preserved.
 */
/**
 * Removes the magenta chroma-key background and its edge spill.
 * A pixel is background when magenta clearly dominates green; the remaining
 * partly-magenta rim pixels get de-spilled so no purple fringe survives.
 * Returns the share of pixels that were keyed out.
 */
function chromaKey(img: Image): number {
  const w = img.width, h = img.height;
  const bmp = img.bitmap as unknown as Uint8Array;
  let removed = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const r = bmp[i], g = bmp[i + 1], b = bmp[i + 2];
    const magenta = Math.min(r, b) - g; // strong for #FF00FF, negative for greys
    // Any magenta-dominant pixel is background — including the DARK magenta the
    // model paints where the original ground shadow was. No car colour (red
    // taillights included) is magenta-dominant, so bodywork is never touched.
    if (magenta > 22) {
      bmp[i + 3] = 0;
      removed++;
      continue;
    }
    if (magenta > 6) {
      // de-spill: pull the faint purple rim back to a neutral edge colour
      const target = Math.round((r + b) / 2 - magenta);
      bmp[i] = Math.max(0, Math.min(255, target));
      bmp[i + 2] = Math.max(0, Math.min(255, target));
    }

  }
  return removed / (w * h);
}

/**
 * The model sometimes smears magenta INSIDE the car (over a taillight lens, a
 * window reflection). Keying those pixels leaves see-through holes in the body.
 * Any transparent area not connected to the image border is therefore an
 * interior hole: make it opaque again and neutralise the purple tint.
 */
function fillInteriorHoles(img: Image) {
  const w = img.width, h = img.height;
  const bmp = img.bitmap as unknown as Uint8Array;
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (outside[p] || bmp[p * 4 + 3] > 24) return;
    outside[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (bmp[i + 3] > 24 || outside[p]) continue;
    const r = bmp[i], g = bmp[i + 1], b = bmp[i + 2];
    const grey = Math.round(g * 0.5 + (r + b) / 4);
    bmp[i] = grey; bmp[i + 1] = grey; bmp[i + 2] = grey;
    bmp[i + 3] = 255;
  }
}



function removeCheckerboard(img: Image) {

  const w = img.width, h = img.height;
  const bmp = img.bitmap as unknown as Uint8Array;
  const at = (x: number, y: number) => (y * w + x) * 4;
  const neutral = (i: number) =>
    bmp[i + 3] > 250 && Math.max(bmp[i], bmp[i + 1], bmp[i + 2]) - Math.min(bmp[i], bmp[i + 1], bmp[i + 2]) <= 14;

  // Two dominant neutral tones on the border.
  const buckets = new Map<number, number>();
  const sample = (i: number) => {
    if (!neutral(i)) return;
    const key = Math.round(bmp[i] / 8) * 8;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < w; x++) { sample(at(x, 0)); sample(at(x, h - 1)); }
  for (let y = 0; y < h; y++) { sample(at(0, y)); sample(at(w - 1, y)); }
  const tones = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([v]) => v);
  if (tones.length < 2 || Math.abs(tones[0] - tones[1]) < 16) return;

  const TOL = 14;
  const tone = (i: number) => {
    if (!neutral(i)) return -1;
    if (Math.abs(bmp[i] - tones[0]) <= TOL) return 0;
    if (Math.abs(bmp[i] - tones[1]) <= TOL) return 1;
    return -1;
  };

  // Estimate the checker cell size from the alternation on the top border row.
  const runs: number[] = [];
  let prev = tone(at(0, 0)), len = 1;
  for (let x = 1; x < w; x++) {
    const t = tone(at(x, 0));
    if (t === prev && t >= 0) len++;
    else { if (prev >= 0 && len > 1) runs.push(len); prev = t; len = 1; }
  }
  runs.sort((a, b) => a - b);
  const cell = Math.min(64, Math.max(4, runs.length ? runs[Math.floor(runs.length / 2)] : 16));

  const kill = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      const t = tone(i);
      if (t < 0) continue;
      const other = 1 - t;
      const probes = [
        x - cell >= 0 ? at(x - cell, y) : -1,
        x + cell < w ? at(x + cell, y) : -1,
        y - cell >= 0 ? at(x, y - cell) : -1,
        y + cell < h ? at(x, y + cell) : -1,
      ];
      if (probes.some((p) => p >= 0 && tone(p) === other)) kill[y * w + x] = 1;
    }
  }
  for (let p = 0; p < w * h; p++) if (kill[p]) bmp[p * 4 + 3] = 0;
}

/**
 * Some models return an OPAQUE png where the "transparent" area is painted —
 * either a flat colour or a grey/white checkerboard (the classic Photoshop
 * transparency pattern). Both must be keyed out, otherwise the checkerboard
 * would be baked into the final catalog photo and the vehicle bounding box
 * would be wrong (car ends up tiny).
 *
 * Strategy: sample the whole border, cluster it into up to 3 near-neutral
 * reference colours (a checkerboard has exactly 2), then flood-fill inwards
 * from the border. Flood filling means a white/silver car body is never eaten,
 * because the fill stops at the vehicle silhouette.
 */
function keyOutFlatBackground(img: Image) {
  const w = img.width, h = img.height;
  const bmp = img.bitmap as unknown as Uint8Array;
  const at = (x: number, y: number) => (y * w + x) * 4;

  let opaque = 0;
  for (let i = 3; i < bmp.length; i += 4) if (bmp[i] > 250) opaque++;
  if (opaque < (bmp.length / 4) * 0.98) return; // already has real transparency

  // --- collect border colours -------------------------------------------
  const borderIdx: number[] = [];
  for (let x = 0; x < w; x++) { borderIdx.push(at(x, 0), at(x, h - 1)); }
  for (let y = 0; y < h; y++) { borderIdx.push(at(0, y), at(w - 1, y)); }

  const TOL = 26;
  type Cluster = { r: number; g: number; b: number; n: number };
  const clusters: Cluster[] = [];
  for (const i of borderIdx) {
    const r = bmp[i], g = bmp[i + 1], b = bmp[i + 2];
    // only near-neutral colours may be treated as background
    if (Math.max(r, g, b) - Math.min(r, g, b) > 22) continue;
    const c = clusters.find((c) =>
      Math.abs(c.r / c.n - r) < TOL && Math.abs(c.g / c.n - g) < TOL && Math.abs(c.b / c.n - b) < TOL
    );
    if (c) { c.r += r; c.g += g; c.b += b; c.n++; }
    else clusters.push({ r, g, b, n: 1 });
  }
  const minShare = borderIdx.length * 0.06;
  const refs = clusters
    .filter((c) => c.n >= minShare)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }));
  if (refs.length === 0) return;

  const matches = (i: number) =>
    refs.some((ref) =>
      Math.abs(bmp[i] - ref.r) < TOL &&
      Math.abs(bmp[i + 1] - ref.g) < TOL &&
      Math.abs(bmp[i + 2] - ref.b) < TOL
    );

  // Flood fill from the border so a white car body is never eaten.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (matches(p * 4)) stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const p = stack.pop()!;
    bmp[p * 4 + 3] = 0;
    const x = p % w, y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
}

/**
 * Keeps only the largest connected visible blob (the vehicle) and erases the
 * leftover specks — checkerboard remnants, matte fringes, stray artefacts —
 * that would otherwise inflate the bounding box and shrink the car.
 */
function keepVehicleComponent(img: Image) {
  const w = img.width, h = img.height;
  const bmp = img.bitmap as unknown as Uint8Array;
  const label = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0;
  const sizes: number[] = [];

  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || bmp[start * 4 + 3] <= 24) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w, y = (p - x) / w;
      const nb = [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ];
      for (const q of nb) {
        if (q < 0 || label[q] !== -1 || bmp[q * 4 + 3] <= 24) continue;
        label[q] = id;
        stack.push(q);
      }
    }
    sizes.push(size);
    if (size > bestSize) { bestSize = size; best = id; }
  }

  if (best < 0) return;
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== -1 && label[p] !== best) bmp[p * 4 + 3] = 0;
  }
}


/**
 * The cut-out vehicle sometimes comes back slightly tilted (the model re-draws
 * the framing), which makes a wheel hang in mid-air above the showroom floor.
 * We measure the slope of the wheel-contact silhouette and rotate it back to
 * level. Clamped and threshold-gated, so a natural 3/4 perspective is untouched.
 */
function levelToGround(img: Image): Image {
  const w = img.width, h = img.height;
  const bmp = img.bitmap as unknown as Uint8Array;
  const lowest: Array<number | null> = new Array(w).fill(null);
  let maxY = -1, minY = h;
  for (let x = 0; x < w; x++) {
    for (let y = h - 1; y >= 0; y--) {
      if (bmp[(y * w + x) * 4 + 3] > 24) { lowest[x] = y; if (y > maxY) maxY = y; if (y < minY) minY = y; break; }
    }
  }
  if (maxY < 0) return img;

  // Only the bottom band counts — that is where the tyres meet the ground.
  const band = maxY - (maxY - minY) * 0.12;
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let x = 0; x < w; x++) {
    const y = lowest[x];
    if (y === null || y < band) continue;
    n++; sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  if (n < 40) return img;
  const denom = n * sxx - sx * sx;
  if (denom === 0) return img;
  const slope = (n * sxy - sx * sy) / denom;
  let deg = Math.atan(slope) * 180 / Math.PI;
  if (Math.abs(deg) < 2.5) return img;      // natural perspective — leave alone
  deg = Math.max(-8, Math.min(8, deg));
  try {
    return img.rotate(-deg, false);
  } catch {
    return img;
  }
}


/** Tight bounding box of visible pixels. */
function alphaBounds(img: Image) {
  const w = img.width, h = img.height;
  const bmp = img.bitmap as unknown as Uint8Array;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bmp[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Lowest visible pixel per column, horizontally smoothed. */
function silhouetteFloor(car: Image): Array<number | null> {
  const cw = car.width, ch = car.height;
  const cbmp = car.bitmap as unknown as Uint8Array;
  const floor: Array<number | null> = new Array(cw).fill(null);
  for (let x = 0; x < cw; x++) {
    for (let y = ch - 1; y >= 0; y--) {
      if (cbmp[(y * cw + x) * 4 + 3] > 24) { floor[x] = y; break; }
    }
  }
  const smooth = new Array<number | null>(cw).fill(null);
  const win = Math.max(3, Math.round(cw * 0.015));
  for (let x = 0; x < cw; x++) {
    let sum = 0, n = 0;
    for (let k = -win; k <= win; k++) {
      const v = floor[x + k];
      if (v != null) { sum += v; n++; }
    }
    if (n > 0) smooth[x] = sum / n;
  }
  return smooth;
}

/**
 * Physical grounding: two shadow layers instead of one.
 *
 *  1. AMBIENT OCCLUSION — a wide, very soft dark pool under the whole body. This
 *     is what stops the car reading as a sticker floating on a bright floor.
 *  2. CONTACT SHADOW — a tight, much darker band immediately under the tyres,
 *     following the silhouette so the near wheels of a 3/4 view sit lower than
 *     the far ones. Real tyre-to-floor contact is almost black at the point of
 *     contact and fades within a few centimetres.
 */
function paintContactShadow(canvas: Image, car: Image, carX: number, carY: number) {
  const cw = car.width, ch = car.height;
  const smooth = silhouetteFloor(car);
  const bmp = canvas.bitmap as unknown as Uint8Array;
  const W = canvas.width, H = canvas.height;

  const darken = (px: number, py: number, strength: number) => {
    if (strength <= 0.002 || px < 0 || px >= W || py < 0 || py >= H) return;
    const i = (py * W + px) * 4;
    const k = 1 - Math.min(0.9, strength);
    bmp[i] = Math.round(bmp[i] * k);
    bmp[i + 1] = Math.round(bmp[i + 1] * k);
    bmp[i + 2] = Math.round(bmp[i + 2] * k);
  };

  const ambientReach = Math.max(24, Math.round(ch * 0.22));
  const contactReach = Math.max(6, Math.round(ch * 0.035));
  const spread = Math.max(6, Math.round(cw * 0.02)); // ambient bleeds sideways

  for (let x = 0; x < cw; x++) {
    const fy = smooth[x];
    if (fy == null) continue;
    // fade out towards the very front/rear ends of the car
    const endFade = Math.min(1, Math.max(0, Math.min(x, cw - 1 - x) / (cw * 0.06)));

    // 1) ambient occlusion pool (soft, wide, weak)
    for (let d = -Math.round(ambientReach * 0.15); d <= ambientReach; d++) {
      const t = Math.abs(d) / ambientReach;
      const s = 0.30 * Math.pow(1 - Math.min(1, t), 2.2) * endFade;
      for (let sx = -spread; sx <= spread; sx++) {
        const lateral = 1 - Math.abs(sx) / (spread + 1);
        darken(carX + x + sx, Math.round(carY + fy + d), s * lateral * 0.7);
      }
    }

    // 2) hard contact band right under the tyres/rockers
    for (let d = -2; d <= contactReach; d++) {
      const t = Math.max(0, d) / contactReach;
      const s = 0.62 * Math.pow(1 - Math.min(1, t), 1.4) * endFade;
      darken(carX + x, Math.round(carY + fy + d), s);
    }
  }
}

/**
 * Subtle mirrored reflection on the polished floor. Very low opacity and it
 * dies out fast — just enough that the floor reads as a real hard surface the
 * car is standing on, never a glossy CGI mirror.
 */
function paintFloorReflection(canvas: Image, car: Image, carX: number, carY: number) {
  const cw = car.width, ch = car.height;
  const cbmp = car.bitmap as unknown as Uint8Array;
  const smooth = silhouetteFloor(car);
  const bmp = canvas.bitmap as unknown as Uint8Array;
  const W = canvas.width, H = canvas.height;
  const depth = Math.max(20, Math.round(ch * 0.16));

  for (let x = 0; x < cw; x++) {
    const fy = smooth[x];
    if (fy == null) continue;
    const px = carX + x;
    if (px < 0 || px >= W) continue;
    for (let d = 1; d <= depth; d++) {
      const srcY = Math.round(fy - d * 1.6); // squashed reflection
      if (srcY < 0) break;
      const si = ((srcY * cw) + x) * 4;
      if (cbmp[si + 3] < 40) continue;
      const py = Math.round(carY + fy + d);
      if (py < 0 || py >= H) continue;
      const a = 0.14 * Math.pow(1 - d / depth, 1.8);
      if (a <= 0.004) continue;
      const i = (py * W + px) * 4;
      bmp[i] = Math.round(bmp[i] * (1 - a) + cbmp[si] * a);
      bmp[i + 1] = Math.round(bmp[i + 1] * (1 - a) + cbmp[si + 1] * a);
      bmp[i + 2] = Math.round(bmp[i + 2] * (1 - a) + cbmp[si + 2] * a);
    }
  }
}

/**
 * 1 px alpha feather along the cutout border. A razor-sharp alpha edge is the
 * single most obvious "this was AI-pasted" tell; a slight feather makes the
 * vehicle sit in the scene.
 */
function featherEdges(car: Image) {
  const w = car.width, h = car.height;
  const bmp = car.bitmap as unknown as Uint8Array;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = bmp[i * 4 + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (alpha[idx] < 200) continue;
      let transparentNeighbours = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (alpha[(y + dy) * w + (x + dx)] < 40) transparentNeighbours++;
        }
      }
      if (transparentNeighbours > 0) {
        bmp[idx * 4 + 3] = Math.round(alpha[idx] * (transparentNeighbours >= 4 ? 0.45 : 0.75));
      }
    }
  }
}



export type ShowroomResult =
  | { ok: true; cached?: boolean; showroom_url: string; showroom_thumb_url?: string }
  | { ok: false; error: string; status: number };

/**
 * Generates the showroom composite for ONE image.
 * Never touches `showroom_applied_at` — publishing stays an explicit admin action.
 */
export async function runShowroom(
  admin: AdminClient,
  imageId: string,
  force = false,
): Promise<ShowroomResult> {
  if (!LOVABLE_API_KEY) return { ok: false, error: "LOVABLE_API_KEY is not configured", status: 500 };

  const { data: img, error: imgErr } = await admin
    .from("vehicle_images")
    .select("id, vehicle_id, image_url, showroom_url, original_backup_url, showroom_status")
    .eq("id", imageId)
    .maybeSingle();
  if (imgErr || !img) return { ok: false, error: "Image not found", status: 404 };

  if (!force && (img as any).showroom_url && (img as any).showroom_status === "done") {
    return { ok: true, cached: true, showroom_url: (img as any).showroom_url };
  }

  const fail = async (msg: string, status = 502): Promise<ShowroomResult> => {
    await setImageState(admin, imageId, {
      showroom_status: "failed",
      showroom_progress: 0,
      showroom_error: msg,
    });
    await appendHistory(admin, imageId, "failed", msg);
    return { ok: false, error: msg, status };
  };

  await setImageState(admin, imageId, {
    showroom_status: "queued",
    showroom_progress: 5,
    showroom_error: "",
  });
  await appendHistory(admin, imageId, "queued", "Showroom compositing queued");

  const sourceUrl = (img as any).original_backup_url || (img as any).image_url;
  if (!sourceUrl) return await fail("No source image", 400);

  await setImageState(admin, imageId, { showroom_status: "processing", showroom_progress: 15 });

  // 1) Fetch the fixed background + the source photo.
  let bgBytes: Uint8Array;
  let carDataUrl: string;
  try {
    const [bg, car] = await Promise.all([fetchBytes(BACKGROUND_URL), fetchBytes(sourceUrl)]);
    bgBytes = bg.bytes;
    carDataUrl = toDataUrl(car.bytes, car.contentType);
  } catch (e: any) {
    return await fail(`Fetch failed: ${e?.message ?? e}`);
  }

  await setImageState(admin, imageId, { showroom_progress: 30 });

  // 2) AI does ONE job only: cut the vehicle out on a transparent background.
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "native-fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Pro image model: the flash model re-draws the framing (tilted car,
      // magenta bleeding through the glass); pro stays far closer to the source.
      model: "google/gemini-3-pro-image",

      modalities: ["image", "text"],
      messages: [{
        role: "user",
        content: [
          { type: "text", text: CUTOUT_PROMPT },
          { type: "text", text: "SOURCE VEHICLE PHOTO (identity-lock the vehicle, remove only the background):" },
          { type: "image_url", image_url: { url: carDataUrl } },
        ],
      }],
    }),
  });

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    return await fail(
      aiResp.status === 429
        ? "AI rate limit — zkuste znovu za chvíli"
        : aiResp.status === 402
        ? "AI kredity vyčerpány — doplňte kredity ve Workspace Usage"
        : `AI error ${aiResp.status}: ${errText.slice(0, 300)}`,
    );
  }

  const aiData = await aiResp.json();
  const outDataUrl = extractImageDataUrl(aiData);
  if (!outDataUrl) return await fail("AI returned no cutout image");

  await setImageState(admin, imageId, { showroom_progress: 60 });

  // 3) Deterministic compositing — identical background, identical scale.
  let jpeg: Uint8Array;
  try {
    const cutoutBytes = dataUrlToBytes(outDataUrl).bytes;
    const cutout = await Image.decode(cutoutBytes);
    // Primary path: magenta chroma key. Fallbacks handle a model that ignored
    // the instruction and painted a checkerboard or a flat grey instead.
    const keyed = chromaKey(cutout);
    if (keyed < 0.02) {
      removeCheckerboard(cutout);
      keyOutFlatBackground(cutout);
    }
    fillInteriorHoles(cutout);
    keepVehicleComponent(cutout);


    const box = alphaBounds(cutout);
    if (!box || box.w < 40 || box.h < 20) throw new Error("Cutout is empty");
    const car = cutout.clone().crop(box.x, box.y, box.w, box.h);

    let targetW = Math.round(CANVAS_W * CAR_WIDTH_RATIO);
    let targetH = Math.round((car.height / car.width) * targetW);
    const maxH = Math.round(CANVAS_H * MAX_CAR_HEIGHT_RATIO);
    if (targetH > maxH) {
      targetH = maxH;
      targetW = Math.round((car.width / car.height) * targetH);
    }
    car.resize(targetW, targetH);
    featherEdges(car);

    const canvas = (await Image.decode(bgBytes)).resize(CANVAS_W, CANVAS_H);
    const wheelLineY = Math.round(CANVAS_H * WHEEL_LINE_Y_RATIO);
    const carX = Math.round((CANVAS_W - targetW) / 2);
    const carY = wheelLineY - targetH;

    paintFloorReflection(canvas, car, carX, carY);
    paintContactShadow(canvas, car, carX, carY);
    canvas.composite(car, carX, carY);



    jpeg = await canvas.encodeJPEG(94);
  } catch (e: any) {
    return await fail(`Compositing failed: ${e?.message ?? e}`);
  }

  if (jpeg.byteLength < 50_000) return await fail("Composite output too small; refusing to save");

  await setImageState(admin, imageId, { showroom_progress: 88 });

  const stamp = Date.now();
  const filename = `showroom/Web_Showroom/${(img as any).vehicle_id}/${imageId}_${stamp}.jpg`;
  const thumbFilename = `showroom/Inzerce/${(img as any).vehicle_id}/${imageId}_${stamp}.jpg`;
  const uploadOptions = { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" };

  const { error: upErr } = await admin.storage.from("vehicles").upload(filename, jpeg, uploadOptions);
  if (upErr) return await fail(`Upload: ${upErr.message}`, 500);
  await admin.storage.from("vehicles").upload(thumbFilename, jpeg, uploadOptions).catch(() => null);

  const showroomUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicles/${filename}`;
  const thumbUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicles/${thumbFilename}`;
  await setImageState(admin, imageId, {
    showroom_url: showroomUrl,
    showroom_thumb_url: thumbUrl,
    showroom_status: "done",
    showroom_progress: 100,
    showroom_error: "",
    showroom_generated_at: new Date().toISOString(),
  });
  await appendHistory(admin, imageId, "generated", "Composited on fixed background at fixed scale");

  return { ok: true, showroom_url: showroomUrl, showroom_thumb_url: thumbUrl };
}
