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
const BG_FALLBACK_URLS = [
  BG_PUBLIC_URL,
  "https://chtysler-cz.lovable.app/showroom-background.jpg",
  "https://id-preview--c84aefff-909b-427b-9038-4e6708c93b3b.lovable.app/showroom-background.jpg",
];

const SHOWROOM_PROMPT = `MASTER PROMPT — CHRYSLER.CZ SHOWROOM BACKGROUND MODE v2

Produce ONE photorealistic dealership listing photo of the EXACT same vehicle shown in the SOURCE CAR PHOTO, placed against a clean white Chrysler & Dodge Pardubice showroom facade wall.

INPUTS:
1) LOGO REFERENCE: the official round "CHRYSLER & DODGE PARDUBICE" pentastar sign. Use ONLY for logo/typography reference. Do NOT copy the building, roof, sky, trees or surroundings from this reference.
2) SOURCE CAR PHOTO: the real vehicle (exterior OR interior). This is the truth source for the car.

================================================
PRIORITY ORDER (apply in this order, never break a higher rule for a lower one)
================================================
1) CAR / INTERIOR IDENTITY — LOCKED.
2) PHOTOREALISM — natural light, real shadows, real material.
3) NATURAL LIGHT — preserve the original light direction and daylight feel.
4) COMPOSITION NORMALIZATION — gently unify framing.
5) SHOWROOM BACKGROUND — applied last, never at the cost of realism.

If you cannot satisfy rules 1 and 2 at the same time, return the source as-is. NEVER ship a deformed, fake, plastic, CGI, studio-burn, AI-fantasy or halo result.

================================================
CAR / INTERIOR IDENTITY LOCK
================================================
- Same make, model, generation, year, body color, paint, wheels, tires, bumpers (front AND rear), grille, headlights, taillights, mirrors, trim, badges, glass, license plate, proportions, stance, visible damage and details.
- Same side / angle as the source. NEVER mirror, flip or rotate the vehicle. If the source shows the LEFT side, the output MUST show the LEFT side, and so on for right / front / rear / interior.
- Preserve original framing. Keep ALL visible vehicle parts intact (no cropping off bumpers, mirrors, wheels, steering wheel, screens, seats).
- Do NOT re-pose, recolor, redesign, replace with another model, alter bumpers, add spoilers, change wheels, grille or lights, change interior trim or upholstery.

================================================
BACKGROUND — WHITE SHOWROOM FACADE WALL ONLY
================================================
The background is ONLY a clean, premium, realistic white exterior facade wall of the dealership. Treat it as if the car is standing directly in front of an endless white plaster facade.

YOU MUST NOT show:
- roof, roof edge, gutter, eaves, rooftop, top of the building, building corners, end of the building.
- sky, clouds, sun, trees, plants, lamps, doors, windows on the facade, fences, people, other cars, road signs, futuristic elements.
- studio cyclorama, photo backdrop, green screen, gradient sweep, CGI plane, vignette.

YOU MUST show:
- subtle real plaster/render texture (fine grain, hairline imperfections).
- realistic outdoor daylight on the wall.
- realistic soft shadows where the car body or mirrors approach the wall.
- believable contact shadows under the tires on a thin strip of gray asphalt (only the asphalt strip — no horizon, no environment behind it).

The wall must look like a REAL outdoor dealership facade — endlessly wide, premium, neutral. NEVER like a studio backdrop, green screen, or AI background.

================================================
LOGO PLACEMENT
================================================
- Place the round "CHRYSLER & DODGE PARDUBICE" pentastar logo on the wall, TOP RIGHT, smaller and discreet, as if physically mounted on the facade.
- Logo design must match the reference exactly (same pentastar, same typography, same circular layout). No re-draw, no re-lettering, no color change.
- Logo must always be FULLY visible (never cropped, never covered by the car). It must look mounted on the wall (faint subsurface shadow), not floating.
- Only ONE logo. No extra signs, no extra text.

================================================
INTERIOR — SHOWROOM WINDOW MODE
================================================
If the SOURCE CAR PHOTO is an interior shot (steering wheel, dashboard, screen, seats, rear cabin) and outside scenery is visible through any window:
- Replace ONLY what is visible through the windows with the SAME white showroom facade wall.
- Keep realistic depth, perspective, daylight intensity and natural brightness behind the glass — it must feel like soft outdoor daylight on a white wall, not a blown-out white plane, not a fake studio, not a CGI fill.
- NEVER touch the interior itself: dashboard, screens (keep current display content untouched), buttons, stitching, leather, plastics, steering wheel, pedals, seatbelts, headrests, mirrors, trim, materials, colors, scratches.

================================================
SMART ANGLE / FRAMING NORMALIZATION (GENTLE)
================================================
Normalization MUST stay SUBTLE, GENTLE and SAFE. The goal is to unify the catalog, NOT to redraw the car.

Allowed (only these, only in tiny amounts):
- gentle horizon leveling
- light re-centering of the car within the frame
- small framing correction (a few percent)
- light unification of perceived distance
- adaptive scaling within safe limits

STRICTLY FORBIDDEN:
- aggressive perspective change, fish-eye, tilt-shift, lens warp
- warping body lines, wheel arches, roofline, beltline
- deforming wheels (must stay perfectly round) or bodywork
- changing car proportions, ride height, stance, track width
- changing interior proportions (wheel, dashboard, seats, screens)
- extreme zoom-in or aggressive cropping
- cropping bumpers, mirrors, wheels, steering wheel, seats, screens

Rule: PREFER small framing corrections OVER any visible geometric manipulation. If a normalization step would cause deformation, an unnatural look, or any loss of realism — DO NOT apply that step. Ship the source framing instead. Realism > uniformity, ALWAYS.

================================================
REALISTIC BLENDING
================================================
- Segment the car / interior cleanly. Replace ONLY the original background / window view.
- Natural soft contact shadows. Tires touch the asphalt believably.
- Match light direction, contrast and white balance gently between subject and new background.
- No halos, no mask edges, no over-sharpening, no fake glow, no surreal HDR, no plastic paint, no studio look, no AI backdrop feel.

================================================
OUTPUT
================================================
- Return ONLY one final image.
- Horizontal listing photo when the source is horizontal; otherwise keep the source aspect ratio.
- No text, no watermark, no border, no UI overlay.
- If you cannot deliver a fully realistic result that honors rules 1–3, return the original source image unchanged.`;

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
      await setImageState(admin, imageId, {
        showroom_status: "failed",
        showroom_progress: 0,
        showroom_error: "No source image",
      });
      await appendHistory(admin, imageId, "failed", "No source image");
      return json({ error: "No source image" }, 400);
    }

    await setImageState(admin, imageId, { showroom_status: "processing", showroom_progress: 15 });

    let bgDataUrl: string;
    let carDataUrl: string;
    try {
      const [bg, car] = await Promise.all([fetchBackground(), fetchAsDataUrl(sourceUrl)]);
      bgDataUrl = bg;
      carDataUrl = car.dataUrl;
    } catch (e: any) {
      const msg = `Fetch failed: ${e?.message ?? e}`;
      await setImageState(admin, imageId, {
        showroom_status: "failed",
        showroom_progress: 0,
        showroom_error: msg,
      });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    await setImageState(admin, imageId, { showroom_progress: 35 });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "native-fetch",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        modalities: ["image", "text"],
        messages: [{
          role: "user",
          content: [
            { type: "text", text: SHOWROOM_PROMPT },
            { type: "image_url", image_url: { url: bgDataUrl } },
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
        ? "AI kredity vyčerpány — doplňte kredity ve Workspace Usage"
        : `AI error ${aiResp.status}: ${errText.slice(0, 300)}`;
      await setImageState(admin, imageId, {
        showroom_status: "failed",
        showroom_progress: 0,
        showroom_error: msg,
      });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    await setImageState(admin, imageId, { showroom_progress: 75 });

    const aiData = await aiResp.json();
    const outDataUrl = extractImageDataUrl(aiData);
    if (!outDataUrl) {
      const msg = "AI returned no image";
      await setImageState(admin, imageId, {
        showroom_status: "failed",
        showroom_progress: 0,
        showroom_error: msg,
      });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    const { bytes, contentType } = dataUrlToBytes(outDataUrl);
    if (!ALLOWED_TYPES.includes(contentType)) {
      const msg = `Unsupported output: ${contentType}`;
      await setImageState(admin, imageId, {
        showroom_status: "failed",
        showroom_progress: 0,
        showroom_error: msg,
      });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    if (bytes.byteLength < 50_000) {
      const msg = "AI output is too small; refusing to save broken image";
      await setImageState(admin, imageId, {
        showroom_status: "failed",
        showroom_progress: 0,
        showroom_error: msg,
      });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    await setImageState(admin, imageId, { showroom_progress: 90 });

    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const stamp = Date.now();
    const filename = `showroom/Web_Showroom/${(img as any).vehicle_id}/${imageId}_${stamp}.${ext}`;
    const thumbFilename = `showroom/Inzerce/${(img as any).vehicle_id}/${imageId}_${stamp}.${ext}`;

    const uploadOptions = { contentType, upsert: true, cacheControl: "31536000" };
    const { error: upErr } = await admin.storage.from("vehicles").upload(filename, bytes, uploadOptions);
    if (upErr) {
      const msg = `Upload: ${upErr.message}`;
      await setImageState(admin, imageId, {
        showroom_status: "failed",
        showroom_progress: 0,
        showroom_error: msg,
      });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 500);
    }

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
    await appendHistory(admin, imageId, "generated", "Showroom image generated and stored separately");

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
