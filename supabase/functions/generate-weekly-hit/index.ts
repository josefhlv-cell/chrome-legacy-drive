// Generuje text popové písničky ve stylu Chinaski a uloží do weekly_hit_songs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const isSpecial = body?.special === true;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `Jsi český textař v duchu Michala Malátného (Chinaski). Napíšeš text popové písničky v češtině, který má ambici stát se hitem.
Pravidla:
- Civilní poetika, obrazy z všedního života (kafe, ráno, déšť, holka, auto, dálnice, město).
- 1. sloka, refrén, 2. sloka, refrén, bridge (2-4 řádky), refrén.
- Refrén musí být chytlavý a opakovatelný.
- Žádné rýmy na sílu, ale rytmus musí sedět.
- Délka řádků jako u Chinaski (8-12 slabik).
- Žádné komentáře, jen čistý text + na začátek titul.

Formát výstupu JSON:
{ "title": "...", "lyrics": "...sloka 1...\\n\\n[REFRÉN]\\n...\\n\\n...sloka 2...\\n\\n[REFRÉN]\\n...\\n\\n[BRIDGE]\\n...\\n\\n[REFRÉN]\\n..." }`;

    const userPrompt = isSpecial
      ? "Napiš mimořádnou písničku pro Máru — obchodníka s americkými auty v Pardubicích. Téma: parťák, který vede dealerství srdcem. Lehce vtipně, tepleji."
      : "Napiš nový pondělní hit. Vyber si svěží téma (může být i o autech, ale nemusí).";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
    let parsed: { title?: string; lyrics?: string } = {};
    try { parsed = JSON.parse(content); } catch { /* noop */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase
      .from("weekly_hit_songs")
      .insert({
        title: parsed.title || "Bez názvu",
        lyrics: parsed.lyrics || "",
        is_special: isSpecial,
      })
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ song: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-weekly-hit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
