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

// FIXNÍ POZADÍ Pardubice (reálné parkovací místo u zdi s logem).
// AI ho dostane jako vstup a MUSÍ ho použít pixel-přesně beze změny.
const BG_PUBLIC_URL = "https://chdp.chryslerpardubice.site/showroom-background.jpg";
const BG_FALLBACK_URLS = [
  BG_PUBLIC_URL,
  "https://chtysler-cz.lovable.app/showroom-background.jpg",
  "https://id-preview--c84aefff-909b-427b-9038-4e6708c93b3b.lovable.app/showroom-background.jpg",
];

// AI skládá auto na fixní pozadí. Vrací plochý JPEG (žádná průhlednost, žádný checker).
const SHOWROOM_PROMPT = `PHOTOREALISTIC CAR COMPOSITE — CHRYSLER & DODGE PARDUBICE

VSTUPY:
- IMAGE 1 = FIXNÍ POZADÍ (parkovací místo u bílé zdi s logem Chrysler Pardubice). MUSÍŠ ho použít PIXEL-PŘESNĚ beze změny.
- IMAGE 2 = ZDROJOVÉ VOZIDLO. Vyřízni vozidlo (auto + přirozený kontaktní stín pod koly) a vlož na IMAGE 1.

UMÍSTĚNÍ:
- Auto stojí na asfaltu IMAGE 1, vystředěné horizontálně, spodní část pneumatik na úrovni asfaltu (cca dolní třetina obrázku).
- Měřítko: auto vyplňuje cca 70–80 % šířky scény. Realistická perspektiva, auto pevně stojí na zemi.
- Pod každou pneumatikou jemný realistický kontaktní stín ladící se světlem scény.

ABSOLUTNÍ ZÁKAZY:
- NEMĚŇ pozadí (IMAGE 1) ANI O JEDEN PIXEL. Bílá zeď, logo, asfalt, čáry – vše zůstává identicky.
- NEPŘEKRESLUJ vozidlo. Kola, disky, světla, lak, zrcátka, SPZ, tvar karoserie zůstávají 1:1 jako v IMAGE 2.
- NEZRCADLI a neotáčej auto.
- ŽÁDNÝ checker / šachovnicový pattern, ŽÁDNÁ průhlednost, ŽÁDNÁ bílá plocha okolo, žádné nové logo, text, vodoznak, nebe, střechu.

VÝSTUP:
- Jeden finální fotorealistický plochý obrázek (JPEG/PNG bez alfa kanálu) = IMAGE 1 (beze změny) + auto z IMAGE 2 položené na asfalt.`;

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
      // try next
    }
  }
  throw new Error("Fixed showroom background is unreachable");
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
    await appendHistory(admin, imageId, "queued", "Background removal queued");

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

    let carDataUrl: string;
    try {
      carDataUrl = (await fetchAsDataUrl(sourceUrl)).dataUrl;
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

    // POUZE auto + prompt na background removal. Žádné referenční pozadí se nepřikládá.
    const content: any[] = [
      { type: "text", text: SHOWROOM_PROMPT },
      { type: "image_url", image_url: { url: carDataUrl } },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "native-fetch",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["image", "text"],
        messages: [{ role: "user", content }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      const msg = (aiResp.status === 429 || aiResp.status === 402)
        ? "Služba je momentálně mimo provoz."
        : `Služba je momentálně mimo provoz. (${aiResp.status})`;
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

    if (bytes.byteLength < 20_000) {
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

    // Pro průhlednost preferujeme PNG/WebP. Pokud AI vrátí JPEG, ukládáme s .jpg příponou
    // (nebude průhledné, frontend si poradí - zobrazí ho přes pozadí jako fallback).
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
    await appendHistory(admin, imageId, "generated", "Car cutout (transparent) generated; background composited on client");

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
