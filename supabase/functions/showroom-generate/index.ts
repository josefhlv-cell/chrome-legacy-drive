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

const SHOWROOM_PROMPT = `ROLE: You are a professional automotive product photo editor. Your task is to replace only the car photo background with the exact provided Chrysler Pardubice showroom reference scene. Do NOT write any code. Return only the final edited image.

ABSOLUTE PRIORITY:
- The background must match the attached reference scene, not a generic studio.
- Do NOT create a seamless white cyclorama.
- Do NOT create a curved wall/floor transition.
- Do NOT create a bright empty white studio.
- The wall-to-floor boundary must be a straight horizontal line with a visible skirting board/baseboard.
- The final image must look like the car is parked in front of the same flat plaster wall and grey concrete floor shown in the reference.

REFERENCE SCENE (apply exactly to every car):

WALL:
- Slightly warm off-white plastered wall (light cream tone: hex #F5F0E8 or similar).
- Matte, painted plaster texture visible — not perfectly smooth digital white.
- Wall extends upward with NO visible ceiling, NO top edge, NO molding. Just an infinite wall.

FLOOR:
- Light grey polished concrete (hex #D5D0C8 or similar).
- Subtle concrete texture visible.
- Clean, modern look.

SKIRTING BOARD (SOKL):
- A visible baseboard where the wall meets the floor.
- Height: approx 10–15 cm.
- Color: slightly darker cream tone than the wall, or light warm grey.
- Clean, minimal profile — no decorative grooves.

SHADOW:
- Soft, realistic drop shadow cast by the car directly onto the concrete floor.
- Light source from front-upper, studio style.
- Shadow must be natural, not harsh or painted-looking.

LIGHTING:
- Bright, even studio lighting from the front and slightly above.
- No dramatic highlights or reflections on the wall.
- Car retains its original paint reflections and gloss.

LOGO:
- Use the exact Chrysler Dodge Pardubice black/silver shield logo from the reference image.
- Do NOT use a Chrysler wings logo.
- Do NOT invent a new logo, icon, badge, watermark, round mark, or tiny symbol.
- Position: TOP RIGHT area exactly like the reference scene.
- Size: clearly visible and proportional like the reference, not miniature.
- Opacity: 100%, clean and sharp.

CAR:
- Extract the car from its original background with surgical precision.
- Do NOT change the car's color, paint shade, reflections, or body shape.
- Wheels and tires must remain perfectly sharp with correct proportions.
- Window glass and chrome trim must retain realistic reflections.
- If the car casts its own subtle reflection on the floor, it is welcome — but keep it very subtle.

FINAL OUTPUT:
- High-quality, photorealistic product image.
- Do NOT add any text overlay except the Chrysler logo.
- Do NOT crop the car. Keep comfortable padding around it.
- Reject any result that looks like a white curved studio/cyclorama; regenerate internally until the reference wall, floor, skirting board and shield logo are visible.
- Return the finished image. No code. No explanation.`;


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
      content.push({ type: "text", text: "SCENE REFERENCE — MATCH THIS EXACTLY (background wall color & texture, grey concrete floor, skirting board, soft shadow under car, AND the Chrysler shield logo in the TOP-RIGHT corner with the same size, position and styling as shown). Replicate this scene 1:1 for the new car." });
      content.push({ type: "image_url", image_url: { url: bgDataUrl } });
    }
    if (logoDataUrl) {
      content.push({ type: "text", text: "SHIELD LOGO REFERENCE (use this exact shield silhouette, layout, chrome frame and lettering — NEVER a round disc):" });
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
