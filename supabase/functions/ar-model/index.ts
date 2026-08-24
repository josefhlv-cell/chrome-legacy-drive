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

const SOURCE_URL =
  "https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/vehicles/ar/pacifica-v3.usdz";

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

    const upstream = await fetch(SOURCE_URL, {
      method: req.method === "HEAD" ? "GET" : req.method,
      headers: range ? { Range: range } : undefined,
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
