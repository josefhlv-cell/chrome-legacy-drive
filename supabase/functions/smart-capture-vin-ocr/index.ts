// Smart Capture — OCR VIN přes Gemini 2.5 Flash Image (REST API)
// (logika/prompty 1:1 viz .bak)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { imageBase64, imageUrl } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY chybí");

    let mimeType = "image/jpeg";
    let b64 = imageBase64 as string | undefined;
    if (!b64 && imageUrl) {
      const r = await fetch(imageUrl);
      if (!r.ok) throw new Error(`Fetch ${r.status}`);
      mimeType = r.headers.get("content-type") || "image/jpeg";
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as unknown as number[]);
      }
      b64 = btoa(bin);
    }
    if (!b64) throw new Error("Chybí obrázek");

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: `Z fotografie najdi VIN (Vehicle Identification Number — 17 znaků, bez I/O/Q). Vrať POUZE JSON: {"vin":"...","confidence":0-100}. Pokud VIN nelze přečíst, vrať {"vin":"","confidence":0}. Bez markdown bloků.` },
              { text: "Najdi a přepiš VIN." },
              { inlineData: { mimeType, data: b64 } },
            ],
          }],
          generationConfig: { responseModalities: ["TEXT"], temperature: 0.1 },
        }),
      },
    );

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Gemini VIN HTTP", resp.status, t.slice(0, 400));
      if (resp.status === 429) return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    let text = "";
    for (const p of parts) if (p?.text) text += p.text;
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: { vin?: string; confidence?: number } = {};
    try { parsed = JSON.parse(cleaned); } catch { /* ignore */ }
    const vin = (parsed.vin ?? "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    return new Response(JSON.stringify({ vin, confidence: parsed.confidence ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
