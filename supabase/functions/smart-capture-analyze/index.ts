// Smart Capture — analýza kvality + klasifikace záběru pomocí Lovable AI (vision)
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
    const image = imageBase64 || imageUrl;
    if (!image) throw new Error("Chybí obrázek");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY není nakonfigurován");

    const imageContent = imageBase64
      ? { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      : { type: "image_url", image_url: { url: imageUrl } };

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

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [imageContent, { type: "text", text: "Analyzuj tuto fotografii vozidla." }] },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Služba je momentálně mimo provoz." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI selhalo: ${txt}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-capture-analyze:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Neznámá chyba" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
