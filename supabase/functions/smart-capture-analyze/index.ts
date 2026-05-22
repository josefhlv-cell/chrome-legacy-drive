// Smart Capture — analýza kvality + klasifikace záběru přes Gemini 2.5 Flash Image
// (přímé REST volání Google Generative Language API; logika/prompty 1:1, viz .bak)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOT_TYPES = [
  "predni-pravy-roh", "pravy-bok", "pravy-zadni-roh", "zadni-cast",
  "levy-zadni-roh", "levy-bok", "levy-predni-roh", "predni-cast",
  "kola-disky", "motor", "ridicuv-prostor", "predni-sedacky",
  "druha-rada", "treti-rada", "kufr", "panorama-strop", "vin-stitek",
  "interier-jine", "exterier-jine", "detail",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { imageBase64, imageUrl } = await req.json();
    if (!imageBase64 && !imageUrl) throw new Error("Chybí obrázek");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY není nakonfigurován");

    let mimeType = "image/jpeg";
    let b64 = imageBase64 as string | undefined;
    if (!b64 && imageUrl) {
      const r = await fetch(imageUrl);
      if (!r.ok) throw new Error(`Nelze stáhnout obrázek: ${r.status}`);
      mimeType = r.headers.get("content-type") || "image/jpeg";
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk) as unknown as number[]);
      }
      b64 = btoa(bin);
    }

    const systemPrompt = `Jsi expert na automotive fotografování. Analyzuj fotografii vozidla a vrať POUZE JSON ve formátu:
{
  "shot_type": "jeden z: ${SHOT_TYPES.join(", ")}",
  "quality_score": 0-100,
  "sharpness": 0-100,
  "exposure": 0-100,
  "composition": 0-100,
  "issues": ["seznam stručných problémů česky"],
  "tip": "jedna krátká doporučující věta česky, vždy pozitivně (např. 'Zkuste ustoupit pro lepší kompozici')",
  "is_blurry": boolean,
  "is_overexposed": boolean,
  "is_underexposed": boolean,
  "dirty_lens": boolean,
  "obstructions": boolean
}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: "Analyzuj tuto fotografii vozidla. Vrať POUZE čistý JSON, bez markdown bloků." },
              { inlineData: { mimeType, data: b64 } },
            ],
          }],
          generationConfig: { responseModalities: ["TEXT"], temperature: 0.4 },
        }),
      },
    );

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Gemini analyze HTTP", resp.status, t.slice(0, 400));
      if (resp.status === 429) return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    let text = "";
    for (const p of parts) if (p?.text) text += p.text;
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { raw: text }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Neznámá chyba";
    console.error("smart-capture-analyze:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
