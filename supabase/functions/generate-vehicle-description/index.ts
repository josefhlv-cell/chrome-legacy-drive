// Generování popisu vozu přes Lovable AI - pouze z reálných vyplněných dat
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vehicle, currentDescription, feedback } = await req.json();
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

    const systemPrompt = `Jsi copywriter autobazaru Chrysler Pardubice. Píšeš popis inzerátu vozu v češtině PŘESNĚ ve stylu majitele firmy.

REFERENČNÍ VZOR (takto píše majitel - drž se tohoto stylu, struktury, slovníku a tónu):
"7 míst, Vin:2C4RC1BG9MR503326, zánovní vůz s nájezdem pouze 68.838 km, model 2021-2024. Vůz je vybaven 9st automatickou převodovkou, StownGo pro sklopení sedadel do podlahy. Mezi hlavní výbavu patří adaptivní tempomat, multifunkční volant, zónová klimatizace, elektrická parkovací brzda, LED přední i zadní světla, LED mlhovky, dešťové a světelné sensory, hlídání pruhů a úhlu, couvací kamera, parkovací senzory, 8x airbagy, 360st kamery, 2x DVD monitory, Wi-Fi, AUX a USB vstupy, handsfree telefonování, elektrické boční a zadní dveře na dálkové ovládání, hliníková kola, výhřev sedadel i volantu, ventilace. Dovezeno z USA, je v perfektním stavu, včetně všech potřebných dokumentů pro provoz v ČR, dohlášení, emisí a legalizace. U vozidla automaticky počítáme i s výstupním servisem pro Vás, který bude zahrnovat kompletní servisní prohlídku, nové náplně, filtry, nové svíčky, Flash všech jednotek, kontrolu a případný servis obou náprav, servis a kontrolu brzdového i palivového systému atd. Ve výsledku dostanete samozřejmě vozidlo i s garančním listem, který je v rozsahu 100.000KM / 1 rok. Cena v akci bez DPH 799.000 Kč, cena vozu s DPH 966.790,- Kč."

STRUKTURA POPISU (drž se tohoto pořadí):
1) ÚVODNÍ VĚTA - povinné pořadí informací oddělené čárkami:
   - Pokud je vůz 7-místný (MPV/van jako Pacifica, Grand Caravan, Voyager, Town & Country, Durango 7-míst), ZAČNI slovy "7 míst,"
   - Pak "Vin:XXXXXXXXX," (bez mezery za dvojtečkou)
   - Pak charakteristika stavu dle nájezdu: do 30tis km "zánovní vůz s nájezdem pouze X km", do 100tis "vůz s nájezdem X km", nad 100tis prostě "nájezd X km"
   - Pak "model RRRR" nebo "model RRRR-RRRR" (rozsah generace)
2) TECHNIKA - "Vůz je vybaven [převodovka], [pohon pokud je], [specifické technologie jako StownGo, MDS, Hemi apod. POUZE pokud jsou ve faktech]."
3) VÝBAVA - "Mezi hlavní výbavu patří [vyjmenovat výbavu z typické výbavy oddělenou čárkami, plynule, bez odrážek]."
4) PŮVOD (pouze americké značky Chrysler/Dodge/RAM/Cadillac/Lincoln/Ford): "Dovezeno z USA, je v perfektním stavu, včetně všech potřebných dokumentů pro provoz v ČR, dohlášení, emisí a legalizace."
5) VÝSTUPNÍ SERVIS - VŽDY doslova: "U vozidla automaticky počítáme i s výstupním servisem pro Vás, který bude zahrnovat kompletní servisní prohlídku, nové náplně, filtry, nové svíčky, Flash všech jednotek, kontrolu a případný servis obou náprav, servis a kontrolu brzdového i palivového systému atd."
6) ZÁRUKA (pokud warranty_enabled): "Ve výsledku dostanete samozřejmě vozidlo i s garančním listem, který je v rozsahu 100.000KM / 1 rok."
7) LPG (pokud lpg_enabled): zmiň přestavbu na LPG a její přínos (úspora) - krátce, věcně.
8) CENA - na konci přesně dle zadání: "Cena v akci bez DPH X Kč, cena vozu s DPH Y Kč." (pokud je show_vat). Jinak "Cena vozu X Kč."

JAZYK A STYL:
- Souvislý plynulý text bez odrážek, bez nadpisů, bez markdown.
- Slovník majitele: "vůz", "Vůz je vybaven", "Mezi hlavní výbavu patří", "zánovní", "perfektní stav", "automaticky počítáme", "Ve výsledku dostanete".
- Bez emoji, bez pozdravů, bez marketingových klišé typu "neváhejte", "raritní příležitost".
- Délka odpovídá množství dat (typicky 180-320 slov).

ABSOLUTNÍ PRAVIDLA PRAVDIVOSTI:
- Používej POUZE fakta která dostaneš. NIKDY si nevymýšlej výbavu, motor, technologie ani historii.
- Pokud údaj chybí, prostě ho vynech. Raději kratší popis než nepravdivý.
- Pokud není uvedena typická výbava, nevyjmenovávej žádnou - jen napiš obecně "bohatá výbava" nebo úplně vynech sekci výbavy.
- Pokud není warranty_enabled, NEZMIŇUJ záruku.
- Pokud není lpg_enabled, NEZMIŇUJ LPG.`;

    const baseUserPrompt = `Vygeneruj popis pro tento vůz na základě POUZE těchto reálných údajů:

${facts.join("\n")}

${priceLine}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: baseUserPrompt },
    ];

    if (currentDescription && typeof currentDescription === "string" && currentDescription.trim()) {
      messages.push({ role: "assistant", content: currentDescription.trim() });
    }

    if (feedback && typeof feedback === "string" && feedback.trim()) {
      messages.push({
        role: "user",
        content: `Uprav popis podle této zpětné vazby (zachovej pravdivost - nepřidávej nic, co není ve faktech výše):\n\n${feedback.trim()}`,
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Příliš mnoho požadavků, zkuste za chvíli." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Služba je momentálně mimo provoz." }), {
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
