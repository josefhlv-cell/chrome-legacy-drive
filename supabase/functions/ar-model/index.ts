/**
 * ar-model — doručí privátní GLB/USDZ konkrétního vozu bez odhalení
 * servisního klíče. USDZ zároveň dostane správný MIME typ pro Quick Look.
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
type ResolvedSource = {
  source: string;
  headers?: Record<string, string>;
  kind: "glb" | "usdz";
};

const resolveSource = async (url: URL): Promise<ResolvedSource | null> => {
  const match = url.pathname.match(/\/ar-model\/v\/(.+\.(glb|usdz))$/);
  if (!match) return { source: DEFAULT_SOURCE, kind: "usdz" };

  const storagePath = match[1]
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");

  // Funkce smí číst jen očekávané relativní cesty k USDZ souborům.
  if (
    storagePath.includes("..") ||
    storagePath.startsWith("/") ||
    !/^[0-9a-zA-Z._/-]+\.(glb|usdz)$/.test(storagePath)
  ) {
    return null;
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const vehicleId = storagePath.split("/")[0];
  const vehicleResponse = await fetch(
    `${PROJECT_URL}/rest/v1/vehicles?id=eq.${encodeURIComponent(vehicleId)}&select=ar_model_ready,ar_model_url,ar_model_usdz_url`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
  );
  if (!vehicleResponse.ok) return null;

  const rows = await vehicleResponse.json() as Array<{
    ar_model_ready: boolean;
    ar_model_url: string | null;
    ar_model_usdz_url: string | null;
  }>;
  const vehicle = rows[0];
  const expectedPath = match[2] === "glb"
    ? vehicle?.ar_model_url
    : vehicle?.ar_model_usdz_url;

  // Rozpracovaný, starý nebo cizímu vehicle_id nepřiřazený soubor nevydáme.
  if (!vehicle?.ar_model_ready || expectedPath !== storagePath) return null;

  return {
    source: `${PROJECT_URL}/storage/v1/object/vehicle-models/${storagePath}`,
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    kind: match[2] === "glb" ? "glb" : "usdz",
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
    const resolved = await resolveSource(new URL(req.url));
    if (!resolved) {
      return new Response("Model nenalezen", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const { source, headers: authHeaders, kind } = resolved;

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
    headers.set(
      "Content-Type",
      kind === "glb" ? "model/gltf-binary" : "model/vnd.usdz+zip",
    );
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
