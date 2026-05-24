// deno-lint-ignore-file no-explicit-any
// Showroom pipeline v3 — Remove.bg with fixed background composite.
// One identical background for every car. No AI generation. No checkerboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REMOVEBG_API_KEY = Deno.env.get("REMOVEBG_API_KEY")!;

// THE ONE AND ONLY showroom background. Never changes.
const BG_PUBLIC_URL = "https://chdp.chryslerpardubice.site/showroom-background.jpg";
const BG_FALLBACKS = [
  BG_PUBLIC_URL,
  "https://chtysler-cz.lovable.app/showroom-background.jpg",
];

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
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
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

async function reachableBackgroundUrl(): Promise<string> {
  for (const u of BG_FALLBACKS) {
    try {
      const r = await fetch(u, { method: "HEAD" });
      if (r.ok) return u;
    } catch (_) { /* try next */ }
  }
  throw new Error("Showroom background URL unreachable");
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

    await setState(admin, imageId, { showroom_status: "queued", showroom_progress: 5, showroom_error: "" });
    await appendHistory(admin, imageId, "queued", "Remove.bg pipeline queued");

    const sourceUrl = (img as any).original_backup_url || (img as any).image_url;
    if (!sourceUrl) {
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: "No source image" });
      return json({ error: "No source image" }, 400);
    }

    await setState(admin, imageId, { showroom_status: "processing", showroom_progress: 20 });

    // 1. Fetch source car photo
    let carBlob: Blob;
    try {
      const r = await fetch(sourceUrl);
      if (!r.ok) throw new Error(`Source ${r.status}`);
      carBlob = await r.blob();
    } catch (e: any) {
      const msg = `Source fetch: ${e?.message ?? e}`;
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: msg });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    await setState(admin, imageId, { showroom_progress: 40 });

    // 2. Resolve background URL (Remove.bg fetches it directly)
    let bgUrl: string;
    try {
      bgUrl = await reachableBackgroundUrl();
    } catch (e: any) {
      const msg = `Background unreachable: ${e?.message ?? e}`;
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: msg });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    // 3. Remove.bg: cut car + composite onto THE fixed background in one call → final JPEG
    const form = new FormData();
    form.append("image_file", carBlob, "car.jpg");
    form.append("size", "auto");
    form.append("type", "car");
    form.append("format", "jpg");
    form.append("bg_image_url", bgUrl);

    await setState(admin, imageId, { showroom_progress: 60 });

    const rb = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": REMOVEBG_API_KEY },
      body: form,
    });

    if (!rb.ok) {
      const errText = await rb.text();
      const msg = `Remove.bg ${rb.status}: ${errText.slice(0, 300)}`;
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: msg });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    const bytes = new Uint8Array(await rb.arrayBuffer());
    if (bytes.byteLength < 20_000) {
      const msg = "Remove.bg output too small";
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: msg });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 502);
    }

    await setState(admin, imageId, { showroom_progress: 85 });

    const stamp = Date.now();
    const filename = `showroom/Web_Showroom/${(img as any).vehicle_id}/${imageId}_${stamp}.jpg`;
    const thumbFilename = `showroom/Inzerce/${(img as any).vehicle_id}/${imageId}_${stamp}.jpg`;
    const opts = { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" };

    const { error: upErr } = await admin.storage.from("vehicles").upload(filename, bytes, opts);
    if (upErr) {
      const msg = `Upload: ${upErr.message}`;
      await setState(admin, imageId, { showroom_status: "failed", showroom_progress: 0, showroom_error: msg });
      await appendHistory(admin, imageId, "failed", msg);
      return json({ error: msg }, 500);
    }
    await admin.storage.from("vehicles").upload(thumbFilename, bytes, opts).catch(() => null);

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
    await appendHistory(admin, imageId, "generated", "Remove.bg cut + fixed background composite");

    return json({ ok: true, showroom_url: showroomUrl, showroom_thumb_url: thumbUrl });
  } catch (e: any) {
    console.error("showroom-generate fatal:", e);
    return json({ error: e?.message ?? "Internal error", imageId }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
