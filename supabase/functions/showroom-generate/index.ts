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

const PROMPT = `You are a professional automotive photo compositor.

TASK: Place the car from the SECOND image onto the showroom background shown in the FIRST image. Output a single photorealistic image, same composition as the FIRST image.

ABSOLUTE RULES — MUST FOLLOW EXACTLY:
1. The background (building, roof shape, gutters, fascia texture, trees, asphalt, sky) MUST stay 1:1 identical to the FIRST image. Do not redraw, restyle, recolor, or reinterpret the building. Preserve the Chrysler & Dodge Pardubice shield logo on the wall exactly as shown.
2. Replace ONLY the car in front of the building with the car from the SECOND image. Keep the car's exact model, color, trim, wheels, grille, headlights, and proportions — do not invent details.
3. Position the car centered, facing 3/4 to the right (same angle as reference). Wheels firmly on the asphalt, realistic contact shadow under the tires, soft ambient occlusion under body.
4. Match daylight: soft overcast/sunny daylight from upper left, neutral white balance, no harsh studio lighting, no HDR glow, no neon, no fantasy effects.
5. Reflections on the car body should subtly mirror the building/sky above — natural, not exaggerated.
6. Keep the car proportionally similar to the reference (large MPV/sedan fills lower 2/3 of frame). Do not shrink or distort.
7. NO text overlays, NO watermarks, NO logos added, NO borders, NO frames.
8. Output: single high-resolution photorealistic JPEG-style image, no collage, no split view.

Result must look as if the car was actually photographed in front of this exact building, at the same spot, same lens, same day.`;

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
        model: "google/gemini-2.5-flash-image-preview",
        modalities: ["image", "text"],
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: backgroundDataUrl } },
            { type: "image_url", image_url: { url: carDataUrl } },
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
