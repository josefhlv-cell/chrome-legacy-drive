// Smart Capture — analýza kvality + klasifikace záběru pomocí Gemini 2.5 Flash Image
// (přímé volání přes @google/genai; logika a prompty zachovány 1:1, viz .bak)
import { GoogleGenAI } from "npm:@google/genai@2.6.0";

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

    // Připrav inlineData (pokud máme URL, stáhni a převeď na base64)
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

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash-image",
      config: { responseModalities: ["TEXT"] },
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: "Analyzuj tuto fotografii vozidla. Vrať POUZE čistý JSON, bez markdown bloků." },
            { inlineData: { mimeType, data: b64! } },
          ],
        },
      ],
    });

    let text = "";
    for await (const chunk of stream) {
      const parts = chunk?.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const p of parts) if ((p as any).text) text += (p as any).text;
    }

    // očisti případné ```json fences
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { raw: text }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Neznámá chyba";
    const isQuota = /quota|rate|429|402|exhaust/i.test(msg);
    console.error("smart-capture-analyze:", msg);
    return new Response(
      JSON.stringify({ error: isQuota ? "Služba je momentálně mimo provoz." : msg }),
      { status: isQuota ? 402 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
