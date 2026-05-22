// Smart Capture — OCR VIN z fotografie štítku přes Gemini 2.5 Flash Image
// (přímé volání @google/genai; logika a prompty zachovány 1:1, viz .bak)
import { GoogleGenAI } from "npm:@google/genai@0.21.0";

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

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash-image",
      config: { responseModalities: ["TEXT"] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Z fotografie najdi VIN (Vehicle Identification Number — 17 znaků, bez I/O/Q). Vrať POUZE JSON: {"vin":"...","confidence":0-100}. Pokud VIN nelze přečíst, vrať {"vin":"","confidence":0}. Bez markdown bloků.`,
            },
            { text: "Najdi a přepiš VIN." },
            { inlineData: { mimeType, data: b64 } },
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

    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: { vin?: string; confidence?: number } = {};
    try { parsed = JSON.parse(cleaned); } catch { /* ignore */ }
    const vin = (parsed.vin ?? "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    return new Response(JSON.stringify({ vin, confidence: parsed.confidence ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const isQuota = /quota|rate|429|402|exhaust/i.test(msg);
    return new Response(
      JSON.stringify({ error: isQuota ? "Služba je momentálně mimo provoz." : msg }),
      { status: isQuota ? 402 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
