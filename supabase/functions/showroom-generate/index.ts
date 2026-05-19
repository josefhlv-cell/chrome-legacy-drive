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

const BG_PUBLIC_URL = "https://chdp.chryslerpardubice.site/showroom-background.jpg";
// Fallback to lovable preview if production not reachable
const BG_FALLBACK_URLS = [
  BG_PUBLIC_URL,
  "https://chtysler-cz.lovable.app/showroom-background.jpg",
];

const PROMPT = `BACKGROUND-ONLY REPLACEMENT TASK.

You receive TWO images:
- IMAGE 1 = REFERENCE BACKGROUND (Chrysler & Dodge Pardubice white building with shield logo, flat roof, trees, asphalt forecourt).
- IMAGE 2 = SOURCE PHOTO of a car taken outdoors somewhere else.

YOUR ONLY JOB: Return IMAGE 2 with the surroundings behind/around the car replaced by the scene from IMAGE 1. Think of it as a green-screen / sky-replacement edit, not a re-render.

═══ CAR — DO NOT TOUCH ═══
- Keep the car pixels from IMAGE 2 untouched: same exact car, same model, same generation, same color, same paint, same wheels, same tires, same grille, same headlights, same bumpers (front AND rear), same mirrors, same badges, same license plate, same glass tint, same dirt/reflections.
- Keep the car at the EXACT SAME angle, EXACT SAME perspective, EXACT SAME size, EXACT SAME position in the frame as in IMAGE 2. Do not rotate it. Do not flip it. Do not re-pose it. Do not zoom in or out on it. Do not move it left/right/up/down.
- Keep the same crop and aspect ratio as IMAGE 2. If part of the car is cut off in IMAGE 2, keep it cut off the same way.

═══ BACKGROUND — REPLACE WITH IMAGE 1 ═══
- Everything that is NOT the car (sky, houses, road markings, fences, grass, trees, other cars, signs, poles, pavement texture) must be replaced with elements from the scene of IMAGE 1.
- The white Chrysler & Dodge Pardubice building with the shield logo should be visible behind the car, positioned naturally as if the car were parked in front of it. Use the same wall texture, roof line, and shield logo as IMAGE 1.
- The ground under the car should become the asphalt forecourt from IMAGE 1.
- Do NOT invent new buildings, gutters, doors, windows, fences, or extra logos that are not in IMAGE 1.

═══ BLENDING ═══
- Match the daylight of IMAGE 1: soft daylight from upper left, neutral white balance.
- Add a realistic contact shadow under the tires onto the new asphalt.
- Subtle, natural reflections of the new wall/sky on the car body — do not over-do it, do not repaint the body.
- Edges around the car must be photographically clean: no halo, no double outline, no smudged silhouette, no ghosting, no painted-on look.

═══ OUTPUT ═══
- One single photorealistic image with the SAME aspect ratio and SAME framing as IMAGE 2.
- No text, no watermark, no extra logo, no border, no collage, no before/after.

If you cannot replace the background without changing the car, return IMAGE 2 unchanged rather than producing a different car or a different angle.`;

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch ${url} → ${r.status}`);
  const ct = r.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await r.arrayBuffer());
  // base64 encode in chunks (Deno-safe)
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as unknown as number[]);
  }
  return `data:${ct};base64,${btoa(bin)}`;
}

async function fetchBackground(): Promise<string> {
  for (const u of BG_FALLBACK_URLS) {
    try {
      return await fetchAsDataUrl(u);
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
            { type: "text", text: "IMAGE 1 = BACKGROUND PLATE (fixed backdrop, do not alter). IMAGE 2 = SOURCE CAR — keep this exact car (same model, generation, year, color, wheels, bumpers, headlights, grille). Composite the car from IMAGE 2 into the scene of IMAGE 1." },
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
