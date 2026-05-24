// deno-lint-ignore-file no-explicit-any
// Showroom pipeline v4 — Remove.bg cutout (PNG) + server-side composite onto
// the ONE fixed Pardubice background. No AI generation. No bg_image_url.
// No duplicate cars. Identical pixel-perfect background for every vehicle.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REMOVEBG_API_KEY = Deno.env.get("REMOVEBG_API_KEY")!;

// THE ONE AND ONLY showroom background. Never changes.
const BG_FALLBACKS = [
  "https://chdp.chryslerpardubice.site/showroom-background.jpg",
  "https://chtysler-cz.lovable.app/showroom-background.jpg",
];

const CANVAS_W = 1920;
const CANVAS_H = 1080;

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

async function fetchBackgroundBytes(): Promise<Uint8Array> {
  let lastErr: unknown;
  for (const u of BG_FALLBACKS) {
    try { return await fetchBytes(u); } catch (e) { lastErr = e; }
  }
  throw new Error(`Background unreachable: ${(lastErr as any)?.message ?? lastErr}`);
}

async function removeBgPng(carBytes: Uint8Array): Promise<Uint8Array> {
  const form = new FormData();
  form.append("image_file", new Blob([carBytes], { type: "image/jpeg" }), "car.jpg");
  form.append("size", "auto");
  form.append("type", "car");
  form.append("format", "png"); // transparent PNG — NO bg_image_url
  const rb = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": REMOVEBG_API_KEY },
    body: form,
  });
  if (!rb.ok) {
    const t = await rb.text();
    throw new Error(`Remove.bg ${rb.status}: ${t.slice(0, 300)}`);
  }
  const png = new Uint8Array(await rb.arrayBuffer());
  if (png.byteLength < 5000) throw new Error("Remove.bg PNG too small");
  return png;
}

// Compose: 1920x1080 background, car centered horizontally, bottom-aligned
// with 40px gap, soft contact shadow ellipse beneath wheels.
async function composite(bgBytes: Uint8Array, carPngBytes: Uint8Array): Promise<Uint8Array> {
  const bg = await Image.decode(bgBytes);
  const car = await Image.decode(carPngBytes);

  // Scale background to canvas size (cover).
  const bgScaled = bg.resize(CANVAS_W, CANVAS_H);

  // Fit car into safe area: max 80% width, max 70% height of canvas, keep aspect.
  const maxW = Math.floor(CANVAS_W * 0.8);
  const maxH = Math.floor(CANVAS_H * 0.7);
  const scale = Math.min(maxW / car.width, maxH / car.height, 1);
  const carW = Math.max(1, Math.floor(car.width * scale));
  const carH = Math.max(1, Math.floor(car.height * scale));
  const carScaled = scale === 1 ? car : car.resize(carW, carH);

  const carX = Math.floor((CANVAS_W - carW) / 2);
  const carY = CANVAS_H - carH - 40;

  // Soft contact shadow ellipse (semi-transparent dark band).
  const shadow = new Image(carW, 40);
  const cx = (carW - 1) / 2;
  const cy = 20;
  const rx = (carW * 0.42);
  const ry = 14;
  for (let y = 0; y < shadow.height; y++) {
    for (let x = 0; x < shadow.width; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1) {
        const alpha = Math.round(110 * (1 - Math.sqrt(d))); // soft falloff
        if (alpha > 0) shadow.setPixelAt(x + 1, y + 1, Image.rgbaToColor(0, 0, 0, alpha));
      }
    }
  }
  const shadowY = carY + carH - 20;
  bgScaled.composite(shadow, carX, shadowY);

  // Car on top.
  bgScaled.composite(carScaled, carX, carY);

  const jpeg = await bgScaled.encodeJPEG(92);
  return jpeg;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let imageId = "";
  try {
    if (!REMOVEBG_API_KEY) return json({ error: "REMOVEBG_API_KEY is not configured" }, 500);
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
    await appendHistory(admin, imageId, "queued", "Remove.bg cutout + canvas composite");

    const sourceUrl = (img as any).original_backup_url || (img as any).image_url;
    if (!sourceUrl) {
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: "No source image" });
      return json({ error: "No source image" }, 400);
    }

    // 1. Fetch source car photo
    const carBytes = await fetchBytes(sourceUrl).catch((e) => { throw new Error(`Source: ${e.message}`); });
    await setState(admin, imageId, { showroom_progress: 30 });

    // 2. Remove.bg → transparent PNG
    const carPng = await removeBgPng(carBytes);
    await setState(admin, imageId, { showroom_progress: 60 });

    // 3. Background
    const bgBytes = await fetchBackgroundBytes();
    await setState(admin, imageId, { showroom_progress: 75 });

    // 4. Composite
    const finalJpeg = await composite(bgBytes, carPng);
    await setState(admin, imageId, { showroom_progress: 88 });

    const stamp = Date.now();
    const filename = `showroom/Web_Showroom/${(img as any).vehicle_id}/${imageId}_${stamp}.jpg`;
    const thumbFilename = `showroom/Inzerce/${(img as any).vehicle_id}/${imageId}_${stamp}.jpg`;
    const opts = { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" };

    const { error: upErr } = await admin.storage.from("vehicles").upload(filename, finalJpeg, opts);
    if (upErr) throw new Error(`Upload: ${upErr.message}`);
    await admin.storage.from("vehicles").upload(thumbFilename, finalJpeg, opts).catch(() => null);

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
    await appendHistory(admin, imageId, "generated", "Cutout + fixed-background composite");

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
