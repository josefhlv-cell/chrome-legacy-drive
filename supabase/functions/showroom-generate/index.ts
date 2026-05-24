// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const BG_FALLBACK_URLS = [
  "https://chdp.chryslerpardubice.site/showroom-reference.jpg",
  "https://chtysler-cz.lovable.app/showroom-reference.jpg",
  "https://id-preview--c84aefff-909b-427b-9038-4e6708c93b3b.lovable.app/showroom-reference.jpg",
  "https://chdp.chryslerpardubice.site/showroom-background.jpg",
  "https://chtysler-cz.lovable.app/showroom-background.jpg",
];

const LOGO_FALLBACK_URLS = [
  "https://chdp.chryslerpardubice.site/showroom-logo-shield.png",
  "https://chtysler-cz.lovable.app/showroom-logo-shield.png",
  "https://id-preview--c84aefff-909b-427b-9038-4e6708c93b3b.lovable.app/showroom-logo-shield.png",
];

const SHOWROOM_PROMPT = `ROLE: You are a professional automotive photo retoucher. You receive THREE inputs in this exact order:
  1) SOURCE CAR PHOTO — the real vehicle to keep.
  2) SCENE REFERENCE — the showroom background to copy.
  3) LOGO REFERENCE — the shield logo to place on the wall.

YOUR ONLY TASK: keep the SOURCE CAR PHOTO's vehicle 100% identical (same make, model, generation, body shape, color, wheels, trim, badges, headlights, grille, windows, ride height, tint, mirrors, license plate, dirt, damage — EVERYTHING) and replace ONLY the surroundings (background + ground) with the SCENE REFERENCE. Add the LOGO on the wall.

⛔ ABSOLUTELY FORBIDDEN — automatic rejection:
- Replacing the car with a different model (e.g. swapping a Town & Country / Voyager minivan for a Pacifica, or any other substitution).
- Repainting the car (e.g. black → white, white → grey).
- Changing wheels, rims, headlights, grille, badges, bumpers, body shape, or generation.
- Removing the original license plate, dirt, scratches, or characteristic details.
- Generating a "similar" or "newer" version of the car. This is photo retouching, NOT redesign.
- Creating a seamless white cyclorama / curved studio / bright empty white room.

✅ REQUIRED:
- Treat the SOURCE CAR as a locked cut-out. Pixel-level identity preservation of the vehicle.
- Only the ground beneath the car and everything behind/around it changes.
- Background must match the SCENE REFERENCE: warm cream plaster wall (#F5F0E8), light grey polished concrete floor (#D5D0C8), visible straight horizontal skirting board (~10–15 cm, slightly darker cream), no ceiling, no curved cyclorama.
- Soft realistic drop shadow under the original car on the concrete.
- LOGO: place the exact Chrysler Dodge Pardubice black/silver shield logo from the LOGO REFERENCE in the TOP-RIGHT of the wall, clearly visible, proportional, sharp, 100% opacity. NEVER use a Chrysler wings logo, round disc, generic emblem or tiny watermark.
- Lighting: even studio light, keep the car's original paint, reflections and gloss intact.
- Keep comfortable padding around the car; do not crop it.

OUTPUT: a single photorealistic image. No text overlays (except the shield logo). No code. No explanation.`;


const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

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
  const next = [
    ...prev.slice(-19),
    { at: new Date().toISOString(), event, detail },
  ];
  await admin.from("vehicle_images").update({ showroom_history: next }).eq("id", imageId);
}

async function fetchAsDataUrl(url: string): Promise<{ dataUrl: string; contentType: string; bytes: Uint8Array }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch ${url} → ${r.status}`);
  const contentType = r.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error(`Invalid image type: ${contentType}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength < 10_000) throw new Error("Image too small or corrupted");
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return { dataUrl: `data:${contentType};base64,${btoa(bin)}`, contentType, bytes };
}

async function fetchBackground(): Promise<string> {
  for (const u of BG_FALLBACK_URLS) {
    try {
      return (await fetchAsDataUrl(u)).dataUrl;
    } catch (_) {
      // try next background source
    }
  }
  throw new Error("Reference showroom background is unreachable");
}

async function fetchLogo(): Promise<string | null> {
  for (const u of LOGO_FALLBACK_URLS) {
    try {
      return (await fetchAsDataUrl(u)).dataUrl;
    } catch (_) {
      // try next logo source
    }
  }
  return null;
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

async function saveShowroomImage(
  admin: AdminClient,
  img: any,
  imageId: string,
  bytes: Uint8Array,
  contentType: string,
  historyDetail: string,
) {
  const normalizedType = contentType.toLowerCase();
  const ext = normalizedType === "image/png" ? "png" : normalizedType === "image/webp" ? "webp" : "jpg";
  const stamp = Date.now();
  const filename = `showroom/Web_Showroom/${img.vehicle_id}/${imageId}_${stamp}.${ext}`;
  const thumbFilename = `showroom/Inzerce/${img.vehicle_id}/${imageId}_${stamp}.${ext}`;
  const uploadOptions = { contentType: normalizedType, upsert: true, cacheControl: "31536000" };
  const { error: upErr } = await admin.storage.from("vehicles").upload(filename, bytes, uploadOptions);
  if (upErr) throw new Error(`Upload: ${upErr.message}`);
  await admin.storage.from("vehicles").upload(thumbFilename, bytes, uploadOptions).catch(() => null);

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
  await appendHistory(admin, imageId, "generated", historyDetail);
  return { showroomUrl, thumbUrl };
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

    await setImageState(admin, imageId, {
      showroom_status: "queued",
      showroom_progress: 5,
      showroom_error: "",
    });
    await appendHistory(admin, imageId, "queued", "Showroom generation queued");

    const sourceUrl = (img as any).original_backup_url || (img as any).image_url;
    if (!sourceUrl) {
      await setImageState(admin, imageId, { showroom_status: "none", showroom_progress: 0, showroom_error: "" });
      await appendHistory(admin, imageId, "skipped", "No source image");
      return json({ ok: true, skipped: true, reason: "No source image" });
    }

    await setImageState(admin, imageId, { showroom_status: "processing", showroom_progress: 15 });

    let bgDataUrl = "";
    let carDataUrl: string;
    let carBytes: Uint8Array;
    let carContentType: string;
    let logoDataUrl: string | null = null;
    try {
      const car = await fetchAsDataUrl(sourceUrl);
      carDataUrl = car.dataUrl;
      carBytes = car.bytes;
      carContentType = ALLOWED_TYPES.includes(car.contentType.toLowerCase()) ? car.contentType : "image/jpeg";
    } catch (e: any) {
      const msg = `Fetch failed: ${e?.message ?? e}`;
      await setImageState(admin, imageId, { showroom_status: "none", showroom_progress: 0, showroom_error: "" });
      await appendHistory(admin, imageId, "skipped", msg);
      return json({ ok: true, skipped: true, reason: msg });
    }

    try {
      const [bg, logo] = await Promise.all([fetchBackground(), fetchLogo()]);
      bgDataUrl = bg;
      logoDataUrl = logo;
    } catch (e: any) {
      await appendHistory(admin, imageId, "fallback", `Reference assets unavailable: ${e?.message ?? e}`);
    }

    await setImageState(admin, imageId, { showroom_progress: 35 });

    const content: any[] = [{ type: "text", text: SHOWROOM_PROMPT }];
    if (bgDataUrl) {
      content.push({ type: "text", text: "MANDATORY SCENE REFERENCE — MATCH THIS IMAGE EXACTLY. Copy the flat warm cream plaster wall, the straight horizontal baseboard/skirting board, the light grey polished concrete floor, the outdoor/showroom-like floor perspective, the soft car shadow, and the large black/silver Chrysler Dodge Pardubice shield logo on the wall in the upper-right/background area. Do NOT use a seamless white studio, curved cyclorama, ceiling, or generic showroom." });
      content.push({ type: "image_url", image_url: { url: bgDataUrl } });
    }
    if (logoDataUrl) {
      content.push({ type: "text", text: "EXACT LOGO REFERENCE — use this Chrysler Dodge Pardubice shield style only. It must appear on the wall like the reference photo. NEVER use Chrysler wings, a round disc, a random emblem, or a tiny watermark." });
      content.push({ type: "image_url", image_url: { url: logoDataUrl } });
    }
    content.push({ type: "text", text: "SOURCE CAR PHOTO (identity-lock the vehicle — keep car 100% identical, only replace background to match the SCENE REFERENCE above):" });
    content.push({ type: "image_url", image_url: { url: carDataUrl } });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Lovable-AIG-SDK": "native-fetch",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["image", "text"],
        messages: [{
          role: "user",
          content,
        }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      const fallback = await saveShowroomImage(admin, img, imageId, carBytes, carContentType, `Fallback to original photo after AI ${aiResp.status}: ${errText.slice(0, 180)}`);
      return json({ ok: true, fallback: true, showroom_url: fallback.showroomUrl, showroom_thumb_url: fallback.thumbUrl });
    }

    await setImageState(admin, imageId, { showroom_progress: 75 });

    const aiData = await aiResp.json();
    const outDataUrl = extractImageDataUrl(aiData);
    if (!outDataUrl) {
      const fallback = await saveShowroomImage(admin, img, imageId, carBytes, carContentType, "Fallback to original photo: AI returned no image");
      return json({ ok: true, fallback: true, showroom_url: fallback.showroomUrl, showroom_thumb_url: fallback.thumbUrl });
    }

    const { bytes, contentType } = dataUrlToBytes(outDataUrl);
    if (!ALLOWED_TYPES.includes(contentType)) {
      const fallback = await saveShowroomImage(admin, img, imageId, carBytes, carContentType, `Fallback to original photo: unsupported AI output ${contentType}`);
      return json({ ok: true, fallback: true, showroom_url: fallback.showroomUrl, showroom_thumb_url: fallback.thumbUrl });
    }

    if (bytes.byteLength < 50_000) {
      const fallback = await saveShowroomImage(admin, img, imageId, carBytes, carContentType, "Fallback to original photo: AI output too small");
      return json({ ok: true, fallback: true, showroom_url: fallback.showroomUrl, showroom_thumb_url: fallback.thumbUrl });
    }

    await setImageState(admin, imageId, { showroom_progress: 90 });

    const saved = await saveShowroomImage(admin, img, imageId, bytes, contentType, "Showroom image generated and stored separately");

    return json({ ok: true, showroom_url: saved.showroomUrl, showroom_thumb_url: saved.thumbUrl });
  } catch (e: any) {
    console.error("showroom-generate fatal:", e);
    return json({ ok: true, skipped: true, reason: e?.message ?? "Internal error", imageId });
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
