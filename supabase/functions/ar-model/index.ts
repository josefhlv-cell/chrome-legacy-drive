/**
 * ar-model — doručí USDZ model pro iOS AR Quick Look se SPRÁVNÝM MIME typem.
 *
 * Proč to existuje:
 *  - Safari (AR Quick Look) spustí AR jen tehdy, když soubor přijde jako
 *    `model/vnd.usdz+zip` (nebo alespoň bez `X-Content-Type-Options: nosniff`
 *    a se správnou příponou .usdz v URL).
 *  - CDN pro assety servíruje soubor jako `application/zip` + `nosniff`,
 *    takže Safari AR overlay otevřel prázdný / vůbec nezobrazil model.
 *
 * Tato funkce streamuje soubor ze Storage a přepíše hlavičky.
 * URL končí na `.usdz`, což Quick Look vyžaduje:
 *   /functions/v1/ar-model/pacifica.usdz
 */

const PROJECT_URL = "https://thqyzghifwmwohgfvshf.supabase.co";

/** Generický model Pacifiky (veřejný bucket). */
const DEFAULT_SOURCE = `${PROJECT_URL}/storage/v1/object/public/vehicles/ar/pacifica-v3.usdz`;

/**
 * USDZ konkrétního vozu vygenerované v /admin/3d-generator leží v PRIVÁTNÍM
 * bucketu `vehicle-models`. Quick Look neumí posílat hlavičky ani cookies,
 * takže soubor musíme přečíst servisním klíčem tady a poslat ho dál.
 *
 * URL formát:
 *   /functions/v1/ar-model/v/<vehicleId>/vehicle.usdz
 *   /functions/v1/ar-model/v/<vehicleId>/<revision>/vehicle.usdz
 */
const resolveSource = (url: URL): { source: string; headers?: Record<string, string> } => {
  const match = url.pathname.match(/\/ar-model\/v\/(.+\.usdz)$/);
  if (!match) return { source: DEFAULT_SOURCE };

  const storagePath = match[1]
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");

  // Funkce smí číst jen očekávané relativní cesty k USDZ souborům.
  if (
    storagePath.includes("..") ||
    storagePath.startsWith("/") ||
    !/^[0-9a-zA-Z._/-]+\.usdz$/.test(storagePath)
  ) {
    return { source: DEFAULT_SOURCE };
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return {
    source: `${PROJECT_URL}/storage/v1/object/vehicle-models/${storagePath}`,
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges, content-type",
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const range = req.headers.get("range");
    const { source, headers: authHeaders } = resolveSource(new URL(req.url));

    const upstream = await fetch(source, {
      method: req.method === "HEAD" ? "GET" : req.method,
      headers: { ...(authHeaders ?? {}), ...(range ? { Range: range } : {}) },
    });


    if (!upstream.ok && upstream.status !== 206) {
      return new Response("Model nenalezen", {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const headers = new Headers(corsHeaders);
    // Klíčová část: správný USDZ MIME typ pro AR Quick Look.
    headers.set("Content-Type", "model/vnd.usdz+zip");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Accept-Ranges", "bytes");

    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    const cr = upstream.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);

    if (req.method === "HEAD") {
      await upstream.body?.cancel();
      return new Response(null, { status: upstream.status, headers });
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error("ar-model error:", error);
    return new Response("Chyba při načítání modelu", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
