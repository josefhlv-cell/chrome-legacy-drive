// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const BG_PUBLIC_URL = "https://chdp.chryslerpardubice.site/showroom-background.jpg";
// Fallback to lovable preview if production not reachable
const BG_FALLBACK_URLS = [
  BG_PUBLIC_URL,
  "https://chtysler-cz.lovable.app/showroom-background.jpg",
];

const MASK_PROMPT = `Create a precise vehicle alpha mask for the provided car photo.

OUTPUT FORMAT:
- Return ONLY one black-and-white mask image.
- SAME width, SAME height, SAME crop, SAME perspective as the input photo.
- Vehicle pixels = pure white (#FFFFFF).
- Non-vehicle background = pure black (#000000).

WHITE AREA MUST INCLUDE:
- the exact whole vehicle body from the input photo,
- bumpers, wheels, tires, mirrors, grille, headlights, badges, license plate,
- roof/convertible top, windshield, windows and visible interior that belongs to the car.

BLACK AREA MUST INCLUDE:
- sky, buildings, fields, trees, road, pavement, walls, signs, poles and all unrelated background.

CRITICAL:
- Do not redraw the car.
- Do not change the car angle.
- Do not create a showroom image.
- Do not add shadows, labels, borders, text, logos, or gradients.
- This is segmentation only: white silhouette of the original car on black background.`;

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

async function fetchAsDataUrl(url: string): Promise<string> {
  const { bytes, contentType } = await fetchAsBytes(url);
  return bytesToDataUrl(bytes, contentType);
}

async function fetchAsBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch ${url} → ${r.status}`);
  const contentType = r.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await r.arrayBuffer());
  return { bytes, contentType };
}

function bytesToDataUrl(buf: Uint8Array, contentType: string): string {
  // base64 encode in chunks (Deno-safe)
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as unknown as number[]);
  }
  return `data:${contentType};base64,${btoa(bin)}`;
}

async function fetchBackground(): Promise<string> {
  for (const u of BG_FALLBACK_URLS) {
    try {
      return await fetchAsDataUrl(u);
    } catch (_) { /* try next */ }
  }
  throw new Error("Background image unreachable");
}

async function fetchBackgroundBytes(): Promise<Uint8Array> {
  for (const u of BG_FALLBACK_URLS) {
    try {
      return (await fetchAsBytes(u)).bytes;
    } catch (_) { /* try next */ }
  }
  throw new Error("Background image unreachable");
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL from AI");
  const contentType = m[1];
  const b = atob(m[2]);
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  return { bytes, contentType };
}

function maskAlpha(mask: Uint8ClampedArray, i: number): number {
  return Math.max(mask[i], mask[i + 1], mask[i + 2]) / 255;
}

async function composeShowroomPhoto(backgroundBytes: Uint8Array, carBytes: Uint8Array, maskBytes: Uint8Array): Promise<Uint8Array> {
  const car = await Image.decode(carBytes);
  const mask = (await Image.decode(maskBytes)).cover(car.width, car.height);
  const bg = (await Image.decode(backgroundBytes)).cover(car.width, car.height);

  let minX = car.width, minY = car.height, maxX = 0, maxY = 0;
  for (let y = 0; y < car.height; y++) for (let x = 0; x < car.width; x++) {
    const i = (y * car.width + x) * 4;
    if (maskAlpha(mask.bitmap, i) > 0.45) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX > minX && maxY > minY) {
    const cx = (minX + maxX) / 2;
    const cy = maxY - (maxY - minY) * 0.03;
    const rx = (maxX - minX) * 0.56;
    const ry = Math.max(10, (maxY - minY) * 0.08);
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(car.height, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(car.width, Math.ceil(cx + rx)); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d < 1) {
        const i = (y * car.width + x) * 4;
        const strength = (1 - d) * 0.26;
        bg.bitmap[i] = Math.round(bg.bitmap[i] * (1 - strength));
        bg.bitmap[i + 1] = Math.round(bg.bitmap[i + 1] * (1 - strength));
        bg.bitmap[i + 2] = Math.round(bg.bitmap[i + 2] * (1 - strength));
      }
    }
  }

  const out = bg.clone();
  for (let i = 0; i < out.bitmap.length; i += 4) {
    const raw = maskAlpha(mask.bitmap, i);
    const a = raw >= 0.58 ? 1 : raw <= 0.34 ? 0 : (raw - 0.34) / 0.24;
    if (a <= 0) continue;
    out.bitmap[i] = Math.round(car.bitmap[i] * a + out.bitmap[i] * (1 - a));
    out.bitmap[i + 1] = Math.round(car.bitmap[i + 1] * a + out.bitmap[i + 1] * (1 - a));
    out.bitmap[i + 2] = Math.round(car.bitmap[i + 2] * a + out.bitmap[i + 2] * (1 - a));
    out.bitmap[i + 3] = 255;
  }

  return await out.encodeJPEG(92);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: require admin via user JWT
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const imageId: string | undefined = body?.imageId;
    if (!imageId || typeof imageId !== "string") return json({ error: "imageId required" }, 400);

    const { data: img, error: imgErr } = await admin
      .from("vehicle_images")
      .select("id, vehicle_id, image_url, original_backup_url")
      .eq("id", imageId)
      .maybeSingle();
    if (imgErr || !img) return json({ error: "Image not found" }, 404);

    // mark processing
    await admin.from("vehicle_images")
      .update({ showroom_status: "processing", showroom_error: "" })
      .eq("id", imageId);

    const sourceUrl = img.original_backup_url || img.image_url;
    if (!sourceUrl) {
      await admin.from("vehicle_images").update({
        showroom_status: "failed", showroom_error: "No source image",
      }).eq("id", imageId);
      return json({ error: "No source image" }, 400);
    }

    let backgroundDataUrl: string;
    let carDataUrl: string;
    try {
      [backgroundDataUrl, carDataUrl] = await Promise.all([
        fetchBackground(),
        fetchAsDataUrl(sourceUrl),
      ]);
    } catch (e: any) {
      await admin.from("vehicle_images").update({
        showroom_status: "failed", showroom_error: `Fetch source failed: ${e?.message ?? e}`,
      }).eq("id", imageId);
      return json({ error: "Fetch failed" }, 502);
    }

    // Call Lovable AI gateway (Gemini image edit)
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["image", "text"],
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Edit the SECOND image (the car photo). Keep the car pixels, angle, framing, and aspect ratio identical. Replace ONLY the surroundings behind/around the car with the scene from the FIRST image (Chrysler & Dodge Pardubice building). This is a background-swap, not a re-render." },
            { type: "image_url", image_url: { url: backgroundDataUrl } },
            { type: "image_url", image_url: { url: carDataUrl } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      const msg = aiResp.status === 429
        ? "AI rate limit — zkuste znovu za chvíli"
        : aiResp.status === 402
        ? "AI kredity vyčerpány — doplňte v Settings → Workspace → Usage"
        : `AI error ${aiResp.status}: ${errText.slice(0, 200)}`;
      await admin.from("vehicle_images").update({
        showroom_status: "failed", showroom_error: msg,
      }).eq("id", imageId);
      return json({ error: msg }, 502);
    }

    const aiData = await aiResp.json();
    const outDataUrl: string | undefined =
      aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url
      ?? aiData?.choices?.[0]?.message?.images?.[0]?.url;

    if (!outDataUrl) {
      await admin.from("vehicle_images").update({
        showroom_status: "failed", showroom_error: "AI returned no image",
      }).eq("id", imageId);
      return json({ error: "AI returned no image", debug: aiData }, 502);
    }

    const { bytes, contentType } = dataUrlToBytes(outDataUrl);
    if (!ALLOWED_TYPES.includes(contentType)) {
      await admin.from("vehicle_images").update({
        showroom_status: "failed", showroom_error: `Unsupported output: ${contentType}`,
      }).eq("id", imageId);
      return json({ error: "Unsupported output type" }, 502);
    }

    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const filename = `showroom/${img.vehicle_id}_${img.id}_${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage.from("vehicles").upload(filename, bytes, {
      contentType, upsert: true, cacheControl: "3600",
    });
    if (upErr) {
      await admin.from("vehicle_images").update({
        showroom_status: "failed", showroom_error: `Upload: ${upErr.message}`,
      }).eq("id", imageId);
      return json({ error: upErr.message }, 500);
    }

    const showroomUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicles/${filename}`;
    await admin.from("vehicle_images").update({
      showroom_url: showroomUrl,
      showroom_status: "done",
      showroom_error: "",
      showroom_generated_at: new Date().toISOString(),
    }).eq("id", imageId);

    return json({ ok: true, showroom_url: showroomUrl });
  } catch (e: any) {
    console.error("showroom-generate fatal:", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
