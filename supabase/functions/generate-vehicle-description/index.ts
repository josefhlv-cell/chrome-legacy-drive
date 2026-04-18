// Generování popisu vozu přes Lovable AI - pouze z reálných vyplněných dat
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vehicle } = await req.json();
    if (!vehicle || typeof vehicle !== "object") {
      return new Response(JSON.stringify({ error: "Chybí data vozu" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY není nakonfigurován");

    // Sestavíme strukturovaná fakta - JEN to co je vyplněno
    const facts: string[] = [];
    if (vehicle.name) facts.push(`Model: ${vehicle.name}`);
    if (vehicle.year) facts.push(`Rok: ${vehicle.year}`);
    if (vehicle.vin) facts.push(`VIN: ${vehicle.vin}`);
    if (vehicle.mileage) facts.push(`Nájezd: ${Number(vehicle.mileage).toLocaleString("cs-CZ")} km`);
    if (vehicle.engine) facts.push(`Motor: ${vehicle.engine}`);
    if (vehicle.transmission) facts.push(`Převodovka: ${vehicle.transmission}`);
    if (vehicle.power) facts.push(`Výkon: ${vehicle.power}`);
    if (vehicle.fuel) facts.push(`Palivo: ${vehicle.fuel}`);
    if (vehicle.color) facts.push(`Barva: ${vehicle.color}`);
    if (vehicle.body) facts.push(`Karoserie: ${vehicle.body}`);
    if (vehicle.doors) facts.push(`Dveře: ${vehicle.doors}`);
    if (vehicle.drive) facts.push(`Pohon: ${vehicle.drive}`);
    if (vehicle.lpg_enabled) facts.push(`LPG${vehicle.lpg_description ? ": " + vehicle.lpg_description : ""}`);
    if (vehicle.warranty_enabled) facts.push("Záruka 100.000 km / 1 rok");
    if (vehicle.typicalEquipment) facts.push(`Typická výbava: ${vehicle.typicalEquipment}`);

    const priceWithVat = vehicle.price_with_vat ? Number(vehicle.price_with_vat) : null;
    const showVat = !!vehicle.show_vat;
    let priceLine = "";
    if (priceWithVat) {
      if (showVat) {
        // price_with_vat ukládá NETTO když show_vat = true
        const withVat = Math.round(priceWithVat * 1.21);
        priceLine = `Cena bez DPH: ${priceWithVat.toLocaleString("cs-CZ")} Kč, cena s DPH: ${withVat.toLocaleString("cs-CZ")} Kč`;
      } else {
        priceLine = `Cena: ${priceWithVat.toLocaleString("cs-CZ")} Kč`;
      }
    }

    const systemPrompt = `Jsi copywriter autobazaru Chrysler Pardubice. Píšeš popis inzerátu vozu v češtině.

PRAVIDLA - velmi důležité:
1. Používej POUZE fakta která dostaneš. NIKDY si nic nevymýšlej, nedoplňuj výbavu, nepřidávej technické údaje které nejsou uvedeny.
2. Pokud informace chybí, nezmiňuj ji vůbec. Raději kratší popis než nepravdivý.
3. Styl: profesionální, plynulý odstavec/odstavce, bez odrážek, bez nadpisů. Jeden souvislý text.
4. Délka: 150-300 slov dle množství dat.
5. Pokud jde o dovoz z USA (americká značka jako Chrysler, Dodge, RAM, Cadillac, Lincoln, Ford), zmiň "Dovezeno z USA, kompletní dokumenty pro provoz v ČR (dohlášení, emise, legalizace)".
6. Pokud je uvedena záruka, zmiň "garanční list 100.000 km / 1 rok".
7. Vždy zmiň "výstupní servis: kompletní servisní prohlídka, nové náplně, filtry, svíčky, flash jednotek, kontrola náprav, brzdového i palivového systému".
8. Cenu uveď na konci přesně tak jak je dána.
9. Žádné emoji, žádné markdown formátování.
10. Začni přímo popisem vozu, bez úvodního pozdravu.`;

    const userPrompt = `Vygeneruj popis pro tento vůz na základě POUZE těchto reálných údajů:

${facts.join("\n")}

${priceLine}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Příliš mnoho požadavků, zkuste za chvíli." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Vyčerpán kredit Lovable AI." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      throw new Error("AI gateway selhalo");
    }

    const data = await aiResp.json();
    const description = data?.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-vehicle-description error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Neznámá chyba" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
