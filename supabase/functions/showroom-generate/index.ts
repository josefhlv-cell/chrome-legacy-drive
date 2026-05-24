// deno-lint-ignore-file no-explicit-any
// Showroom pipeline v5 — Lovable AI Gemini Nano Banana (google/gemini-2.5-flash-image)
// Sends the car photo + the ONE fixed Pardubice background as references.
// Model returns a flat JPEG/PNG with the car composited onto the unchanged background.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

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

const PROMPT = [
  "Take the car from the FIRST image (the car photo).",
  "Remove its entire original background completely.",
  "Place the car onto the SECOND image (the fixed showroom background).",
  "Position it precisely: centered horizontally, wheels touching the ground/floor line.",
  "Keep the SECOND image (background) 100% pixel-perfect unchanged — do NOT alter the wall, the floor, the logos, the lighting, or any other detail of the background.",
  "Add a soft, realistic contact shadow under the wheels so the car looks grounded.",
  "Output a single flat photographic image (no transparency, no checkerboard, no duplicates, only one car).",
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

async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch ${url} failed: ${r.status}`);
  const ct = r.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await r.arrayBuffer());
  // base64 encode
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  return `data:${ct};base64,${b64}`;
}

async function fetchBgDataUrl(): Promise<string> {
  let lastErr: unknown;
  for (const u of BG_FALLBACKS) {
    try { return await fetchAsDataUrl(u); } catch (e) { lastErr = e; }
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

async function generateWithGemini(carDataUrl: string, bgDataUrl: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: carDataUrl } },
            { type: "image_url", image_url: { url: bgDataUrl } },
          ],
        },
      ],
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
  if (!url || !url.startsWith("data:")) throw new Error("Gemini returned no image");
  return dataUrlToBytes(url);
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
    await appendHistory(admin, imageId, "queued", "Gemini Nano Banana + fixed background");

    const sourceUrl = (img as any).original_backup_url || (img as any).image_url;
    if (!sourceUrl) {
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: "No source image" });
      return json({ error: "No source image" }, 400);
    }

    const carDataUrl = await fetchAsDataUrl(sourceUrl);
    await setState(admin, imageId, { showroom_progress: 30 });

    const bgDataUrl = await fetchBgDataUrl();
    await setState(admin, imageId, { showroom_progress: 45 });

    const { bytes: outBytes, contentType } = await generateWithGemini(carDataUrl, bgDataUrl);
    await setState(admin, imageId, { showroom_progress: 85 });

    const ext = contentType.includes("png") ? "png" : "jpg";
    const stamp = Date.now();
    const filename = `showroom/Web_Showroom/${(img as any).vehicle_id}/${imageId}_${stamp}.${ext}`;
    const thumbFilename = `showroom/Inzerce/${(img as any).vehicle_id}/${imageId}_${stamp}.${ext}`;
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
    await appendHistory(admin, imageId, "generated", "Gemini composite on fixed background");

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
