// VIN decoder via NHTSA vPIC + AI doplnění typické výbavy (Lovable AI)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DecodedVehicle {
  name?: string;
  year?: number;
  fuel?: string;
  engine?: string;
  transmission?: string;
  power?: string;
  body?: string;
  doors?: string;
  drive?: string;
  make?: string;
  model?: string;
  trim?: string;
  typicalEquipment?: string;
}

const fuelMap: Record<string, string> = {
  "gasoline": "Benzín",
  "diesel": "Diesel",
  "electric": "Elektro",
  "ethanol": "Benzín",
  "flexible fuel vehicle": "Benzín",
  "natural gas": "CNG",
  "hybrid": "Hybrid",
};

function mapFuel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  for (const key of Object.keys(fuelMap)) {
    if (lower.includes(key)) return fuelMap[key];
  }
  return raw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vin } = await req.json();
    if (!vin || typeof vin !== "string" || vin.length < 11) {
      return new Response(JSON.stringify({ error: "Neplatný VIN (min. 11 znaků)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanVin = vin.trim().toUpperCase();

    // 1) NHTSA vPIC
    const nhtsaUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${cleanVin}?format=json`;
    const nhtsaResp = await fetch(nhtsaUrl);
    if (!nhtsaResp.ok) throw new Error("NHTSA API selhalo");
    const nhtsaData = await nhtsaResp.json();
    const r = nhtsaData?.Results?.[0] ?? {};

    const make = r.Make || "";
    const model = r.Model || "";
    const year = r.ModelYear ? Number(r.ModelYear) : undefined;
    const trim = r.Trim || r.Series || "";
    const displacement = r.DisplacementL ? `${parseFloat(r.DisplacementL).toFixed(1)}L` : "";
    const engineCyl = r.EngineCylinders ? `${r.EngineCylinders}cyl` : "";
    const engineConfig = r.EngineConfiguration || "";
    const hp = r.EngineHP ? `${Math.round(Number(r.EngineHP) * 0.7457)} kW (${r.EngineHP} HP)` : "";
    const transmission = r.TransmissionStyle || r.TransmissionSpeeds || "";
    const fuel = mapFuel(r.FuelTypePrimary);
    const body = r.BodyClass || "";
    const doors = r.Doors || "";
    const drive = r.DriveType || "";

    const decoded: DecodedVehicle = {
      make,
      model,
      year,
      trim,
      name: [make, model, trim].filter(Boolean).join(" ").trim(),
      engine: [displacement, engineCyl, engineConfig].filter(Boolean).join(" ").trim(),
      power: hp,
      transmission: transmission || undefined,
      fuel,
      body,
      doors,
      drive,
    };

    // 2) AI dohledání typické výbavy (best-effort)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && make && model && year) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Jsi expert na americká auta. Pro daný model napiš STRUČNÝ seznam typické výbavy v češtině, oddělený čárkou. Pouze prvky které jsou pro daný model/rok/výbavu standardní. Žádné spekulace. Max 15 položek. Žádné úvody, žádné tečky na konci.",
              },
              {
                role: "user",
                content: `${year} ${make} ${model}${trim ? " " + trim : ""}`,
              },
            ],
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData?.choices?.[0]?.message?.content?.trim();
          if (content) decoded.typicalEquipment = content;
        }
      } catch (e) {
        console.warn("AI equipment lookup failed:", e);
      }
    }

    return new Response(JSON.stringify({ decoded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vin-decode error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Neznámá chyba" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
