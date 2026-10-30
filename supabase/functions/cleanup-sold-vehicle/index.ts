// Smart Capture — smazání fotek prodaného vozidla
// Vstup: { vehicleId: string }  (uuid z tabulky vehicles)
// Najde relaci přes published_vehicle_id, smaže soubory ve storage i záznamy v DB.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "smart-capture";

/** Z public URL vytáhne cestu uvnitř bucketu (nebo null). */
function pathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  // …/storage/v1/object/public/smart-capture/<path>
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let path = url.slice(idx + marker.length);
  // odřízni query (?v=…)
  const q = path.indexOf("?");
  if (q !== -1) path = path.slice(0, q);
  return path || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const vehicleId = (body as { vehicleId?: string; vehicle_id?: string }).vehicleId
      ?? (body as { vehicle_id?: string }).vehicle_id;

    if (!vehicleId || typeof vehicleId !== "string") {
      return new Response(
        JSON.stringify({ error: "Chybí vehicleId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Najdi relaci napojenou na toto auto
    const { data: session, error: sessionErr } = await supabase
      .from("smart_capture_sessions")
      .select("id, metadata")
      .eq("published_vehicle_id", vehicleId)
      .maybeSingle();

    if (sessionErr) throw sessionErr;

    if (!session) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Žádná Smart Capture relace pro toto vozidlo",
          deletedPhotos: 0,
          deletedFiles: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sessionId = session.id as string;

    // 2) Načti fotky (kvůli URL + počtu)
    const { data: photos, error: photosErr } = await supabase
      .from("smart_capture_photos")
      .select("id, original_url, processed_url")
      .eq("session_id", sessionId);

    if (photosErr) throw photosErr;

    const paths = new Set<string>();

    for (const p of photos ?? []) {
      const o = pathFromPublicUrl((p as { original_url?: string }).original_url);
      const pr = pathFromPublicUrl((p as { processed_url?: string }).processed_url);
      if (o) paths.add(o);
      if (pr) paths.add(pr);
    }

    // miniatura z metadata
    const meta = (session as { metadata?: Record<string, unknown> }).metadata ?? {};
    const thumb = pathFromPublicUrl(
      typeof meta.thumbnail_url === "string" ? meta.thumbnail_url : null,
    );
    if (thumb) paths.add(thumb);

    // 3) Smaž vše pod prefixem sessionId/ (pokryje i thumb-src a případné další soubory)
    const { data: listed, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list(sessionId, { limit: 1000 });

    if (!listErr && listed?.length) {
      for (const f of listed) {
        if (f.name) paths.add(`${sessionId}/${f.name}`);
      }
    }

    let deletedFiles = 0;
    const pathList = [...paths];

    if (pathList.length > 0) {
      // storage.remove bere max ~100 najednou — rozdělíme
      const chunk = 100;
      for (let i = 0; i < pathList.length; i += chunk) {
        const slice = pathList.slice(i, i + chunk);
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove(slice);
        if (rmErr) {
          console.warn("[cleanup-sold-vehicle] storage remove:", rmErr.message, slice);
        } else {
          deletedFiles += slice.length;
        }
      }
    }

    // 4) Smaž záznamy fotek (cascade by stačil, ale explicitně)
    const { error: delPhotosErr } = await supabase
      .from("smart_capture_photos")
      .delete()
      .eq("session_id", sessionId);

    if (delPhotosErr) throw delPhotosErr;

    // 5) Smaž relaci
    const { error: delSessionErr } = await supabase
      .from("smart_capture_sessions")
      .delete()
      .eq("id", sessionId);

    if (delSessionErr) throw delSessionErr;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Smart Capture fotky prodaného vozidla smazány",
        sessionId,
        deletedPhotos: (photos ?? []).length,
        deletedFiles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("cleanup-sold-vehicle:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Neznámá chyba",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
