// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { GoogleGenAI } from "npm:@google/genai@0.21.0";


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

const LOGO_FALLBACK_URLS = [
  "https://chdp.chryslerpardubice.site/showroom-logo-shield.png",
  "https://chtysler-cz.lovable.app/showroom-logo-shield.png",
  "https://id-preview--c84aefff-909b-427b-9038-4e6708c93b3b.lovable.app/showroom-logo-shield.png",
];

const SHOWROOM_PROMPT = `SHOWROOM NORMALIZATION MODE v4 — CHRYSLER & DODGE PARDUBICE

ABSOLUTNĚ KRITICKÉ — NEPŘEKRESLOVAT VOZIDLO:
- NIKDY nepřegenerovávej, nepřekresluj, neredesignuj ani jinak vizuálně nepřetváříš vozidlo ze SOURCE CAR PHOTO.
- Vozidlo musí zůstat 1:1 identické jako v originálu — stejný tvar karoserie, stejná kola (počet paprsků, design, ráfky, pneumatiky), stejné světlomety (přední i zadní), stejná barva laku, stejné odlesky, stejné nárazníky, mřížka, zrcátka, sklo, lemy, kliky, znaky, SPZ, viditelná poškození a detaily.
- ŽÁDNÉ zrcadlení, otáčení, překlápění, změna úhlu, změna strany, změna pózy, změna proporcí, změna výšky podvozku, změna rozchodu kol.

JEDINÉ POVOLENÉ OPERACE (nic jiného):
1) Geometrické zarovnání (vyrovnání horizontu, jemné srovnání perspektivy karoserie do svislé/vodorovné osy).
2) Korekce perspektivy (decentní, jen pro sjednocení katalogu — nikdy fish-eye, nikdy lens warp).
3) Změna měřítka vozidla (scale) tak, aby všechna auta v showroomu byla stejně velká a ve stejné zdánlivé vzdálenosti od kamery.
4) Vystředění kompozice (recentering) — auto vždy uprostřed kádru.
5) Konzistentní zarovnání kol — obě nápravy stojí na stejné vodorovné lince (asfaltový pruh).
6) Výměna pozadí za showroom (jediná povolená vizuální úprava mimo geometrii).

CÍLOVÁ NORMALIZACE — VŠECHNA AUTA V SHOWROOMU MUSÍ PŮSOBIT VIZUÁLNĚ KONZISTENTNĚ:
- Stejný úhel kamery (drž originální úhel ze zdroje, jen jemně srovnej horizont — neměň stranu/pohled).
- Stejná velikost vozidla v rámci kádru.
- Stejná vzdálenost od kamery (zdánlivá).
- Vystředěná kompozice.
- Konzistentní zarovnání kol na společné spodní lince.

POZADÍ — CLEAN WHITE SHOWROOM FACADE:
- Čistá, realistická bílá vnější fasáda dealerství (jemná omítka, decentní textura, realistické denní světlo).
- Tenký pruh světle šedého asfaltu pod koly s měkkými kontaktními stíny.
- ŽÁDNÁ obloha, střecha, okap, rohy budovy, okna, dveře, stromy, lampy, lidé, jiná auta, značky, studiové cyklorámy, CGI plochy, halo, fake daylight.
- Logo nepřidávej žádné AI generované; pokud nelze logo vykreslit 100% věrně dle reference, NEPŘIDÁVEJ ho vůbec.

ZAKÁZÁNO:
- jakákoli změna tvaru/barvy/detailů auta
- deformace kol (musí zůstat dokonale kruhová), karoserie, prahů, blatníků, střechy
- agresivní perspektiva, tilt-shift, fish-eye, warp
- ořezávání nárazníků, zrcátek, kol
- studiový vzhled, CGI, plast, HDR, neon, halo, AI fantazie
- přidávání spoilerů, jiných ráfků, jiné mřížky, jiných světel
- jakákoli změna interiéru (pokud je zdroj interiér, vrať zdroj beze změny)

PRIORITA:
1) Identita vozidla (LOCKED, nepřekreslovat).
2) Fotorealismus.
3) Geometrická normalizace (jemně).
4) Výměna pozadí za showroom fasádu.

POKUD nelze splnit body 1 a 2 současně → VRAŤ ZDROJOVOU FOTOGRAFII BEZE ZMĚNY. Čistý originál je vždy lepší než deformovaný, překreslený, otočený nebo zrcadlený výstup.

VÝSTUP:
- Jeden finální obrázek, bez textu, bez vodoznaku, bez rámečku, bez UI.
- Zachovat poměr stran zdrojové fotografie.`;

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
    let logoDataUrl: string | null = null;
    try {
      const [bg, car, logo] = await Promise.all([fetchBackground(), fetchAsDataUrl(sourceUrl), fetchLogo()]);
      bgDataUrl = bg;
      carDataUrl = car.dataUrl;
      logoDataUrl = logo;
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

    const content: any[] = [
      { type: "text", text: SHOWROOM_PROMPT },
      { type: "image_url", image_url: { url: bgDataUrl } },
    ];
    if (logoDataUrl) {
      content.push({ type: "text", text: "SHIELD LOGO REFERENCE (use this exact shield silhouette, layout, chrome frame and lettering — NEVER a round disc):" });
      content.push({ type: "image_url", image_url: { url: logoDataUrl } });
    }
    content.push({ type: "text", text: "SOURCE CAR PHOTO (identity-lock the vehicle):" });
    content.push({ type: "image_url", image_url: { url: carDataUrl } });

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
        messages: [{
          role: "user",
          content,
        }],
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
