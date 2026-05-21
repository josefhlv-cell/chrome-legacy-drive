// AI Smart Price Check — analyzuje trh pro daný vůz a navrhne cenu.
// Vstup: { vin, make, model, year, mileage, equipment, gallery, vehicleId? }
// Výstup: { recommended, market_avg, market_low, market_high, sell_speed,
//           reasons_up[], reasons_down[], confidence, sources[], mara_message }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceInput {
  vin?: string;
  vehicleId?: string;
  make: string;
  model: string;
  year?: number;
  mileage?: number;
  fuel?: string;
  engine?: string;
  power?: string;
  equipment?: string;
  gallery?: { count: number; hasShowroom: boolean; mainQuality?: number };
}

async function firecrawlSearch(query: string): Promise<Array<{ url: string; title: string; description: string }>> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 8 }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const arr = j?.data?.web ?? j?.data ?? [];
    return Array.isArray(arr) ? arr.slice(0, 8) : [];
  } catch (_e) {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const input = (await req.json()) as PriceInput;
    if (!input?.make || !input?.model) {
      return new Response(JSON.stringify({ error: "make + model required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // 1) Firecrawl — paralelní vyhledávání na CZ portálech
    const yearRange = input.year ? `${input.year - 1} OR ${input.year} OR ${input.year + 1}` : "";
    const baseQ = `${input.make} ${input.model} ${input.year ?? ""}`.trim();
    const queries = [
      `site:sauto.cz ${baseQ}`,
      `site:tipcars.com ${baseQ}`,
      `site:auto.cz ${baseQ} prodej`,
    ];
    const searchResults = (await Promise.all(queries.map(firecrawlSearch))).flat();
    const sources = searchResults.slice(0, 12).map((s) => ({
      url: s.url, title: s.title, description: s.description?.slice(0, 240) ?? "",
    }));

    // 2) Historická paměť — předchozí prodeje stejného modelu (pokud existují)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: memory } = await supabase
      .from("ai_price_memory")
      .select("listed_price, sold_price, days_to_sell, mileage, year, gallery_score")
      .ilike("make", `%${input.make}%`)
      .ilike("model", `%${input.model}%`)
      .order("sold_at", { ascending: false })
      .limit(20);

    // 3) AI — strukturovaná analýza
    const systemPrompt = `Jsi zkušený český automobilový obchodník specializovaný na americká auta (Chrysler, Dodge, Ram, Lancia).
Cílem je doporučit prodejní cenu v Kč na základě:
- aktuálních inzerátů (Sauto, TipCars, Auto.cz) — uvedeny níže
- vlastní paměti prodejů firmy (uvedena níže, pokud existuje)
- stavu vozu a kvality prezentace (galerie, showroom mode)

VRÁTÍŠ POUZE JSON v přesné struktuře:
{
  "recommended": number (Kč, celé tisíce),
  "market_avg": number,
  "market_low": number,
  "market_high": number,
  "sell_speed": "fast" | "medium" | "slow",
  "confidence": number 0-100,
  "reasons_up": [string, ...] (česky, krátce),
  "reasons_down": [string, ...] (česky, krátce),
  "mara_message": string (1-3 věty česky, ležérní tón zkušeného obchodníka, na konci NEPŘIPOJUJ slogan — ten doplní UI)
}`;

    const userPrompt = JSON.stringify({
      vehicle: input,
      market_listings_sample: sources,
      our_sales_memory: memory ?? [],
    });

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Služba je momentálně mimo provoz." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI failed: ${txt}`);
    }

    const aiData = await aiResp.json();
    const content = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const result = {
      recommended: Number(parsed.recommended) || null,
      market_avg: Number(parsed.market_avg) || null,
      market_low: Number(parsed.market_low) || null,
      market_high: Number(parsed.market_high) || null,
      sell_speed: (parsed.sell_speed as string) || "medium",
      confidence: Number(parsed.confidence) || 50,
      reasons_up: Array.isArray(parsed.reasons_up) ? parsed.reasons_up : [],
      reasons_down: Array.isArray(parsed.reasons_down) ? parsed.reasons_down : [],
      mara_message: (parsed.mara_message as string) || "Mrkni na doporučenou cenu.",
      sources,
    };

    // 4) Ulož návrh pro učení
    await supabase.from("ai_price_suggestions").insert({
      vehicle_id: input.vehicleId ?? null,
      vin: input.vin ?? "",
      recommended: result.recommended,
      market_avg: result.market_avg,
      market_low: result.market_low,
      market_high: result.market_high,
      sell_speed: result.sell_speed,
      confidence: result.confidence,
      reasons_up: result.reasons_up,
      reasons_down: result.reasons_down,
      sources: result.sources,
      input_snapshot: input as unknown as Record<string, unknown>,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-price-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
