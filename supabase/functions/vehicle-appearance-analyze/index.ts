/**
 * vehicle-appearance-analyze — vytáhne z fotek vozu jeho "appearance profil".
 *
 * Proč to běží na serveru:
 *  - fotky leží v PRIVÁTNÍM bucketu `vehicle-photos` (servisní klíč),
 *  - volání Lovable AI Gateway nesmí ven z prohlížeče (API klíč).
 *
 * Co to NEDĚLÁ: negeneruje 3D geometrii. Vrací jen měřitelné vlastnosti
 * vzhledu (barva laku, lesk, tmavost skel, chrom/black paket, kola,
 * poškození, barva interiéru). Skládání GLB dělá admin stránka v prohlížeči.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_KEY = Deno.env.get("LOVABLE_API_KEY");

/** Fotky, které pro analýzu vzhledu nesou nejvíc informace. */
const ANALYSIS_SLOTS = [
  "ext_45_left",
  "ext_90_left",
  "ext_180",
  "detail_wheel",
  "detail_window",
  "int_front",
] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `Jsi technik automobilového showroomu. Z fotografií JEDNOHO konkrétního vozu
popiš jeho vzhled tak, aby se dal přenést na existující 3D model.
Nikdy si nevymýšlej to, co na fotkách není. Když si nejsi jistý, přiznej nízkou jistotu.
Odpověz VÝHRADNĚ jedním JSON objektem v tomto tvaru:
{
  "body_color_hex": "#rrggbb",        // skutečná barva laku v neutrálním světle
  "body_color_name": "string",         // česky, např. "grafitová šedá metalíza"
  "paint_finish": "solid|metallic|pearl|matte",
  "clearcoat": 0.0-1.0,                // lesk laku (nový lesklý = 1.0)
  "roughness": 0.05-0.6,
  "glass_opacity": 0.2-0.9,            // 0.2 = čirá skla, 0.9 = silně zatmavená
  "trim_style": "chrome|black|body",   // lišty, mřížka, rámy okének
  "wheel_style": "default|5spoke|10spoke|multispoke|alloy_dark|steel_cover",
  "wheel_condition": "string",         // česky, opotřebení pneu/disku
  "interior_color_hex": "#rrggbb",
  "interior_material": "string",
  "damages": [ { "part": "predni_naraznik|zadni_naraznik|dvere_levo|dvere_pravo|blatnik|kapota|paty_dvere|strecha|jine", "type": "skrabanec|dulek|rez|koroze|odrena_barva", "severity": "lehke|stredni|vyrazne", "note": "string" } ],
  "confidence": 0.0-1.0,
  "warnings": ["string"]               // špatné fotky, odlesky, chybějící pohledy
}`;

async function assertAdmin(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return null;

  const userClient = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data } = await userClient.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return role ? admin : null;
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await assertAdmin(req);
    if (!admin) return json({ error: "Forbidden" }, 403);
    if (!AI_KEY) return json({ error: "LOVABLE_API_KEY není nastavený" }, 401);

    const body = await req.json().catch(() => ({}));
    const vehicleId: string = typeof body?.vehicleId === "string" ? body.vehicleId : "";
    // { slot: "storage/cesta.jpg" } — cesty v bucketu vehicle-photos
    const photos: Record<string, string> = body?.photos ?? {};
    if (!vehicleId) return json({ error: "vehicleId je povinné" }, 400);
    if (!Object.keys(photos).length) return json({ error: "Chybí fotografie" }, 400);

    // 1) Fotky pro analýzu → base64 (odkazy Gemini limituje, base64 ne).
    const parts: unknown[] = [
      {
        type: "text",
        text:
          "Analyzuj tento konkrétní vůz z přiložených fotografií a vrať JSON profil vzhledu. " +
          "Fotky jsou v pořadí: " +
          ANALYSIS_SLOTS.filter((s) => photos[s]).join(", "),
      },
    ];

    for (const slot of ANALYSIS_SLOTS) {
      const path = photos[slot];
      if (!path) continue;

      const { data: file, error } = await admin.storage.from("vehicle-photos").download(path);
      if (error || !file) {
        console.warn("Fotku nelze stáhnout:", path, error?.message);
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!bytes.length) continue;

      parts.push({
        type: "image_url",
        image_url: { url: `data:${file.type || "image/jpeg"};base64,${toBase64(bytes)}` },
      });
    }

    if (parts.length < 2) return json({ error: "Žádnou fotografii se nepodařilo načíst" }, 400);

    // 2) Vision analýza (bez umělého timeoutu — model si vezme, co potřebuje).
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": AI_KEY },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: parts },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const message = await aiRes.text();
      console.error("AI gateway error", aiRes.status, message);
      return json({ error: `Analýza selhala (${aiRes.status}): ${message}` }, aiRes.status);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let profile: Record<string, unknown>;
    try {
      profile = JSON.parse(raw);
    } catch {
      const match = String(raw).match(/\{[\s\S]*\}/);
      profile = match ? JSON.parse(match[0]) : {};
    }

    const clamp = (v: unknown, min: number, max: number, fallback: number) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const hex = (v: unknown, fallback: string) =>
      typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : fallback;

    const row = {
      vehicle_id: vehicleId,
      body_color_hex: hex(profile.body_color_hex, "#e9eaec"),
      paint_finish: ["solid", "metallic", "pearl", "matte"].includes(String(profile.paint_finish))
        ? String(profile.paint_finish)
        : "metallic",
      clearcoat: clamp(profile.clearcoat, 0, 1, 1),
      roughness: clamp(profile.roughness, 0.05, 0.6, 0.2),
      glass_opacity: clamp(profile.glass_opacity, 0.2, 0.9, 0.55),
      trim_style: ["chrome", "black", "body"].includes(String(profile.trim_style))
        ? String(profile.trim_style)
        : "chrome",
      wheel_style: typeof profile.wheel_style === "string" ? profile.wheel_style : "default",
      wheel_condition: typeof profile.wheel_condition === "string" ? profile.wheel_condition : null,
      damages: Array.isArray(profile.damages) ? profile.damages : [],
      interior_color_hex: hex(profile.interior_color_hex, "#2b2b2e"),
      photos,
      analysis: profile,
      status: "analyzed",
    };

    const { data: saved, error: saveError } = await admin
      .from("vehicle_appearance_profiles")
      .upsert(row, { onConflict: "vehicle_id" })
      .select()
      .maybeSingle();

    if (saveError) {
      console.error("Uložení profilu selhalo:", saveError);
      return json({ error: saveError.message }, 500);
    }

    return json({ ok: true, profile: saved, analysis: profile });
  } catch (e) {
    console.error("vehicle-appearance-analyze fatal:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
