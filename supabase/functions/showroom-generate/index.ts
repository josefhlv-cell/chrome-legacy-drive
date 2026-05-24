// deno-lint-ignore-file no-explicit-any
// Showroom pipeline v6 — Gemini cuts out the car (transparent PNG),
// then the Deno server mathematically composites it onto the fixed
// Pardubice background. Gemini NEVER decides position or scale.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Image, decode } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const BG_FALLBACKS = [
  "https://chdp.chryslerpardubice.site/bg-new.jpg",
  "https://chtysler-cz.lovable.app/bg-new.jpg",
];

// Canvas + placement constants — math, not AI
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const CAR_HEIGHT_RATIO = 0.75;   // car height = 75% of canvas height
const BOTTOM_MARGIN = 30;        // wheels 30px above bottom edge

// Gemini does ONE job: clean cutout with transparent background.
const CUTOUT_PROMPT = [
  "Take the car in this image.",
  "Remove the entire background completely (sky, road, ground, trees, other cars, people, buildings — everything that is not the vehicle).",
  "Output a PNG with a fully TRANSPARENT background and ONLY the car remaining.",
  "DO NOT mirror, flip, rotate or change the orientation of the car. Keep the exact left/right side as in the source.",
  "DO NOT repaint, redesign, change wheels, lights, trim, color or perspective.",
  "DO NOT add any new background, floor, shadow, reflection or scenery.",
  "Crop tightly to the car bounding box. Preserve the car at maximum resolution. Output PNG with alpha.",
].join(" ");

type AdminClient = ReturnType<typeof createClient>;

async function assertAdmin(req: Request): Promise<AdminClient | Response> {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data } = await userClient.auth.getUser();
  if (!data?.user?.id) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roleRow } = await admin
    .from("user_roles").select("role")
    .eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "Forbidden" }, 403);
  return admin;
}

async function setState(admin: AdminClient, id: string, patch: Record<string, unknown>) {
  await admin.from("vehicle_images").update(patch).eq("id", id);
}

async function appendHistory(admin: AdminClient, id: string, event: string, detail = "") {
  const { data } = await admin.from("vehicle_images").select("showroom_history").eq("id", id).maybeSingle();
  const prev = Array.isArray((data as any)?.showroom_history) ? (data as any).showroom_history : [];
  const next = [...prev.slice(-19), { at: new Date().toISOString(), event, detail }];
  await admin.from("vehicle_images").update({ showroom_history: next }).eq("id", id);
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch ${url} failed: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function bytesToDataUrl(bytes: Uint8Array, ct = "image/jpeg"): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${ct};base64,${btoa(bin)}`;
}

async function fetchBgBytes(): Promise<Uint8Array> {
  let lastErr: unknown;
  for (const u of BG_FALLBACKS) {
    try { return await fetchBytes(u); } catch (e) { lastErr = e; }
  }
  throw new Error(`Background unreachable: ${(lastErr as any)?.message ?? lastErr}`);
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL from model");
  const contentType = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, contentType };
}

// Ask Gemini for a transparent-background cutout PNG of the car.
async function geminiCutout(carBytes: Uint8Array, carCt: string): Promise<Uint8Array> {
  const carDataUrl = bytesToDataUrl(carBytes, carCt);
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: CUTOUT_PROMPT },
          { type: "image_url", image_url: { url: carDataUrl } },
        ],
      }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    if (resp.status === 429) throw new Error("Rate limit exceeded on Lovable AI. Try again shortly.");
    if (resp.status === 402) throw new Error("Lovable AI credits depleted. Add credits in Settings → Workspace → Usage.");
    throw new Error(`Gemini ${resp.status}: ${t.slice(0, 400)}`);
  }
  const data = await resp.json();
  const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) throw new Error("Gemini returned no cutout image");
  const { bytes } = dataUrlToBytes(url);
  return bytes;
}

// Crop transparent margins so the car bbox fills the PNG.
function trimAlpha(img: Image): Image {
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const px = img.getPixelAt(x + 1, y + 1); // ImageScript is 1-indexed
      const alpha = px & 0xff;
      if (alpha > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return img;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return img.crop(minX, minY, w, h);
}

// Mathematically compose: car centered horizontally, wheels 30px above bottom,
// car height = 75% of canvas. Adds a soft elliptical shadow under the wheels.
async function compose(bgBytes: Uint8Array, carPngBytes: Uint8Array): Promise<Uint8Array> {
  const bgDecoded = await decode(bgBytes);
  const bg = bgDecoded instanceof Image ? bgDecoded : (bgDecoded as any).frames?.[0] ?? bgDecoded;
  const canvas = (bg as Image).resize(CANVAS_W, CANVAS_H);

  const carDecoded = await decode(carPngBytes);
  let car = carDecoded instanceof Image ? carDecoded : (carDecoded as any).frames?.[0] ?? carDecoded;
  car = trimAlpha(car as Image);

  const targetH = Math.round(CANVAS_H * CAR_HEIGHT_RATIO);
  const scale = targetH / (car as Image).height;
  const targetW = Math.max(1, Math.round((car as Image).width * scale));
  car = (car as Image).resize(targetW, targetH);

  const carX = Math.round((CANVAS_W - targetW) / 2);
  const carY = CANVAS_H - targetH - BOTTOM_MARGIN;

  // Soft elliptical shadow directly under the wheels
  const shadowW = Math.round(targetW * 0.92);
  const shadowH = Math.max(18, Math.round(targetH * 0.06));
  const shadow = new Image(shadowW, shadowH);
  const cx = shadowW / 2;
  const cy = shadowH / 2;
  for (let y = 0; y < shadowH; y++) {
    for (let x = 0; x < shadowW; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const d = dx * dx + dy * dy;
      if (d <= 1) {
        const a = Math.round(140 * (1 - d) * (1 - d)); // soft falloff
        shadow.setPixelAt(x + 1, y + 1, (0 << 24) | (0 << 16) | (0 << 8) | a);
      }
    }
  }
  const shadowX = Math.round((CANVAS_W - shadowW) / 2);
  const shadowY = CANVAS_H - BOTTOM_MARGIN - Math.round(shadowH * 0.55);
  (canvas as Image).composite(shadow, shadowX, shadowY);

  (canvas as Image).composite(car as Image, carX, carY);

  const out = await (canvas as Image).encodeJPEG(92);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let imageId = "";
  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
    const adminOrResp = await assertAdmin(req);
    if (adminOrResp instanceof Response) return adminOrResp;
    const admin = adminOrResp;

    const body = await req.json().catch(() => ({}));
    imageId = typeof body?.imageId === "string" ? body.imageId : "";
    const force = body?.force === true;
    if (!imageId) return json({ error: "imageId required" }, 400);

    const { data: img, error: imgErr } = await admin
      .from("vehicle_images")
      .select("id, vehicle_id, image_url, showroom_url, original_backup_url, showroom_status")
      .eq("id", imageId).maybeSingle();
    if (imgErr || !img) return json({ error: "Image not found" }, 404);

    if (!force && (img as any).showroom_url && (img as any).showroom_status === "done") {
      return json({ ok: true, cached: true, showroom_url: (img as any).showroom_url });
    }

    await setState(admin, imageId, { showroom_status: "processing", showroom_progress: 10, showroom_error: "" });
    await appendHistory(admin, imageId, "queued", "Gemini cutout + math compositor v6");

    const sourceUrl = (img as any).original_backup_url || (img as any).image_url;
    if (!sourceUrl) {
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: "No source image" });
      return json({ error: "No source image" }, 400);
    }

    // 1) Fetch source car photo
    const carResp = await fetch(sourceUrl);
    if (!carResp.ok) throw new Error(`Car source fetch ${carResp.status}`);
    const carCt = carResp.headers.get("content-type") || "image/jpeg";
    const carBytes = new Uint8Array(await carResp.arrayBuffer());
    await setState(admin, imageId, { showroom_progress: 25 });

    // 2) Gemini → transparent PNG cutout of the car
    const cutoutPng = await geminiCutout(carBytes, carCt);
    await setState(admin, imageId, { showroom_progress: 55 });

    // 3) Background bytes
    const bgBytes = await fetchBgBytes();
    await setState(admin, imageId, { showroom_progress: 70 });

    // 4) Math composite on server
    const outBytes = await compose(bgBytes, cutoutPng);
    const contentType = "image/jpeg";
    await setState(admin, imageId, { showroom_progress: 88 });

    const stamp = Date.now();
    const filename = `showroom/Web_Showroom/${(img as any).vehicle_id}/${imageId}_${stamp}.jpg`;
    const thumbFilename = `showroom/Inzerce/${(img as any).vehicle_id}/${imageId}_${stamp}.jpg`;
    const opts = { contentType, upsert: true, cacheControl: "31536000" };

    const { error: upErr } = await admin.storage.from("vehicles").upload(filename, outBytes, opts);
    if (upErr) throw new Error(`Upload: ${upErr.message}`);
    await admin.storage.from("vehicles").upload(thumbFilename, outBytes, opts).catch(() => null);

    const showroomUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicles/${filename}`;
    const thumbUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicles/${thumbFilename}`;
    await setState(admin, imageId, {
      showroom_url: showroomUrl,
      showroom_thumb_url: thumbUrl,
      showroom_status: "done",
      showroom_progress: 100,
      showroom_error: "",
      showroom_generated_at: new Date().toISOString(),
    });
    await appendHistory(admin, imageId, "generated", "Gemini cutout + deterministic compositor");

    return json({ ok: true, showroom_url: showroomUrl, showroom_thumb_url: thumbUrl });
  } catch (e: any) {
    console.error("showroom-generate fatal:", e);
    if (imageId) {
      try {
        await createClient(SUPABASE_URL, SERVICE_ROLE)
          .from("vehicle_images")
          .update({ showroom_status: "failed", showroom_progress: 0, showroom_error: String(e?.message ?? e).slice(0, 500) })
          .eq("id", imageId);
      } catch { /* ignore */ }
    }
    return json({ error: e?.message ?? "Internal error", imageId }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
