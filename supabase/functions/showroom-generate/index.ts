// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ============================================================================
// THE ONE AND ONLY SHOWROOM BACKGROUND.
// A single fixed JPEG in storage. The AI NEVER generates a background — it only
// cuts the vehicle out. Placement/scale are computed mathematically, so every
// vehicle ends up on the identical background at the identical scale.
// ============================================================================
const BACKGROUND_URL =
  `${SUPABASE_URL}/storage/v1/object/public/vehicles/showroom/_assets/background-v1.jpg`;

const CANVAS_W = 1920;
const CANVAS_H = 1080;
// Fixed catalog geometry — identical for every single vehicle.
const CAR_WIDTH_RATIO = 0.76;       // vehicle spans 76 % of the canvas width
const MAX_CAR_HEIGHT_RATIO = 0.62;  // never taller than 62 % of the canvas
const WHEEL_LINE_Y_RATIO = 0.90;    // tyres always touch the floor at this line

const CUTOUT_PROMPT = `CUTOUT MODE — REMOVE THE BACKGROUND ONLY.

TASK: Return the supplied vehicle as a PNG with a FULLY TRANSPARENT background (real alpha channel). Nothing but the vehicle may remain.

ABSOLUTE VEHICLE IDENTITY LOCK — the vehicle must stay 100% pixel-faithful to the source:
Do not change or re-draw the body, paint colour, panels, wheels, tyres, glass, headlights, taillights, badges, grille, mirrors, trim, licence plate, damage, reflections, perspective, camera angle, orientation, proportions or sharpness. No mirroring, no rotating, no re-posing, no re-styling, no re-rendering, no beautifying, no upscaling artefacts.

REMOVE: every background pixel — floor, ground, asphalt, walls, buildings, sky, plants, people, other cars, signs, shadows cast on the ground.
KEEP: only the vehicle itself, including its own dark under-body area.

FORBIDDEN: no new background, no white/grey/coloured fill, no checkerboard, no gradient, no drop shadow, no glow, no outline, no halo, no matte fringe, no text, no watermark, no border, no second copy of the car.

OUTPUT: exactly ONE PNG image, transparent background, vehicle tightly framed, same orientation as the source.`;

type AdminClient = ReturnType<typeof createClient>;

async function assertAdmin(req: Request): Promise<AdminClient | Response> {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Forbidden" }, 403);
  return admin;
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

// --------------------------------------------------------------------------
// Cutout post-processing
// --------------------------------------------------------------------------

/** Some models return an opaque PNG with a flat background. Key it out from the borders. */
function keyOutFlatBackground(img: Image) {
  const w = img.width, h = img.height;
  const bmp = img.bitmap as unknown as Uint8Array;
  const at = (x: number, y: number) => (y * w + x) * 4;

  let opaque = 0;
  for (let i = 3; i < bmp.length; i += 4) if (bmp[i] > 250) opaque++;
  if (opaque < (bmp.length / 4) * 0.98) return; // already has real transparency

  // Reference colour = average of the four corners.
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  let r = 0, g = 0, b = 0;
  for (const c of corners) { r += bmp[c]; g += bmp[c + 1]; b += bmp[c + 2]; }
  r /= 4; g /= 4; b /= 4;

  const TOL = 26;
  const matches = (i: number) =>
    Math.abs(bmp[i] - r) < TOL && Math.abs(bmp[i + 1] - g) < TOL && Math.abs(bmp[i + 2] - b) < TOL;

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

/** Soft elliptical contact shadow painted directly into the background. */
function paintShadow(canvas: Image, cx: number, cy: number, rx: number, ry: number) {
  const bmp = canvas.bitmap as unknown as Uint8Array;
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(canvas.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(canvas.height - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d >= 1) continue;
      const strength = 0.42 * Math.pow(1 - d, 1.6); // soft blurred falloff
      const i = (y * canvas.width + x) * 4;
      bmp[i] = Math.round(bmp[i] * (1 - strength));
      bmp[i + 1] = Math.round(bmp[i + 1] * (1 - strength));
      bmp[i + 2] = Math.round(bmp[i + 2] * (1 - strength));
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let imageId = "";
  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY is not configured" }, 500);

    const adminOrResponse = await assertAdmin(req);
    if (adminOrResponse instanceof Response) return adminOrResponse;
    const admin = adminOrResponse;

    const body = await req.json().catch(() => ({}));
    imageId = typeof body?.imageId === "string" ? body.imageId : "";
    const force = body?.force === true;
    if (!imageId) return json({ error: "imageId required" }, 400);

    const { data: img, error: imgErr } = await admin
      .from("vehicle_images")
      .select("id, vehicle_id, image_url, showroom_url, original_backup_url, showroom_status")
      .eq("id", imageId)
      .maybeSingle();
    if (imgErr || !img) return json({ error: "Image not found" }, 404);

    if (!force && (img as any).showroom_url && (img as any).showroom_status === "done") {
      return json({ ok: true, cached: true, showroom_url: (img as any).showroom_url });
    }

    const fail = async (msg: string, status = 502) => {
      await setImageState(admin, imageId, {
        showroom_status: "failed",
        showroom_progress: 0,
        showroom_error: msg,
      });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, status);
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
        model: "google/gemini-3.1-flash-image",
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
      keyOutFlatBackground(cutout);

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

      const canvas = (await Image.decode(bgBytes)).resize(CANVAS_W, CANVAS_H);
      const wheelLineY = Math.round(CANVAS_H * WHEEL_LINE_Y_RATIO);
      const carX = Math.round((CANVAS_W - targetW) / 2);
      const carY = wheelLineY - targetH;

      paintShadow(
        canvas,
        CANVAS_W / 2,
        wheelLineY - Math.max(4, Math.round(targetH * 0.015)),
        targetW * 0.44,
        Math.max(12, targetH * 0.075),
      );
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

    return json({ ok: true, showroom_url: showroomUrl, showroom_thumb_url: thumbUrl });
  } catch (e: any) {
    console.error("showroom-generate fatal:", e);
    return json({ error: e?.message ?? "Internal error", imageId }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
