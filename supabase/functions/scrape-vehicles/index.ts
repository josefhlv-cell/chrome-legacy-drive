import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedVehicle {
  title: string;
  image: string;
  fuel: string;
  mileage: number;
  year: number;
  price: number;
  showVat: boolean;
}

async function scrapeWithFirecrawl(url: string, apiKey: string) {
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      waitFor: 5000,
    }),
  });
  return await response.json();
}

function parseVehiclesFromMarkdown(markdown: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];

  // Find the vehicles section - starts after "naše nabídka vozů"
  const offerIdx = markdown.indexOf("naše nabídka vozů");
  if (offerIdx === -1) return vehicles;

  const section = markdown.substring(offerIdx);
  const lines = section.split("\n");

  let current: Partial<ParsedVehicle> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Vehicle title: "## Name of vehicle"
    const titleMatch = line.match(/^#{1,3}\s+(.+)/);
    if (titleMatch) {
      const text = titleMatch[1].trim().replace(/\\-/g, "-");

      // Skip non-vehicle headings
      if (
        text.match(/^\+\s*DPH$/i) ||
        text.match(/nabídka|autoservis|kontakt|služby|díly|video|rady|náhradní|prodej/i) ||
        text.length < 8
      ) continue;

      // Only accept vehicle-like titles
      if (text.match(/chrysler|dodge|lancia|ram|voyager|pacifica|300|charger|challenger|grand caravan|town|durango|wrangler|jeep/i)) {
        // Save previous vehicle
        if (current?.title && current?.price) {
          vehicles.push(current as ParsedVehicle);
        }
        current = {
          title: text,
          image: "",
          fuel: "Benzín",
          mileage: 0,
          year: new Date().getFullYear(),
          price: 0,
          showVat: false,
        };
      }
      continue;
    }

    // Image: ![alt](url)
    if (current) {
      const imgMatch = line.match(/!\[.*?\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|webp)[^)]*)\)/i);
      if (imgMatch && !current.image && !imgMatch[1].includes("logo") && !imgMatch[1].includes("icon") && !imgMatch[1].includes("Vector") && !imgMatch[1].includes("sale-tag")) {
        current.image = imgMatch[1];
        continue;
      }

      // Fuel: "Palivo: Ba 95"
      const fuelMatch = line.match(/Palivo:\s*(.+)/i);
      if (fuelMatch) {
        current.fuel = fuelMatch[1].trim();
        continue;
      }

      // Mileage: "Nájezd: 262 788 Km"
      const mileageMatch = line.match(/Nájezd:\s*([\d\s]+)\s*Km/i);
      if (mileageMatch) {
        current.mileage = parseInt(mileageMatch[1].replace(/\s/g, ""), 10) || 0;
        continue;
      }

      // Year: "Rok výroby: 2015 - červen" or "Rok výroby: 2019-Listopad"
      const yearMatch = line.match(/Rok výroby:\s*(\d{4})/i);
      if (yearMatch) {
        current.year = parseInt(yearMatch[1], 10);
        continue;
      }

      // Price: "Cena: 263 000 Kč" or "Cena: 770 000 Kč + DPH"
      const priceMatch = line.match(/Cena:\s*([\d\s]+)\s*Kč/i);
      if (priceMatch) {
        current.price = parseInt(priceMatch[1].replace(/\s/g, ""), 10) || 0;
        current.showVat = /\+\s*DPH/i.test(line);
        continue;
      }
    }
  }

  // Don't forget the last one
  if (current?.title && current?.price) {
    vehicles.push(current as ParsedVehicle);
  }

  return vehicles;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const logId = body.log_id;

    const updateLog = async (updates: Record<string, unknown>) => {
      if (logId) {
        await supabase.from("scrape_log").update(updates).eq("id", logId);
      }
    };

    if (!firecrawlKey) {
      await updateLog({
        status: "error",
        error_message: "FIRECRAWL_API_KEY not configured",
        finished_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Scrape chrysler.cz
    await updateLog({ status: "scraping_main_page" });
    const mainPage = await scrapeWithFirecrawl("https://www.chrysler.cz", firecrawlKey);
    const markdown = mainPage?.data?.markdown || mainPage?.markdown || "";

    if (!markdown) {
      await updateLog({
        status: "error",
        error_message: "No markdown content returned from Firecrawl",
        finished_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "No content scraped" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Parse vehicles from markdown
    await updateLog({ status: "parsing_vehicles" });
    const vehicles = parseVehiclesFromMarkdown(markdown);

    console.log(`Parsed ${vehicles.length} vehicles from markdown`);

    // Step 3: Upsert vehicles into database
    await updateLog({ status: "updating_database", vehicles_found: vehicles.length });

    let updatedCount = 0;
    let imagesCount = 0;

    for (const vehicle of vehicles) {
      if (!vehicle.title || !vehicle.price) continue;

      // Match by name (exact or close)
      const { data: existing } = await supabase
        .from("vehicles")
        .select("id, name")
        .ilike("name", `%${vehicle.title.substring(0, 30)}%`)
        .maybeSingle();

      const vehicleData = {
        name: vehicle.title,
        year: vehicle.year,
        price_with_vat: vehicle.price,
        mileage: vehicle.mileage,
        fuel: vehicle.fuel,
        image_url: vehicle.image,
        status: "skladem" as const,
        show_vat: vehicle.showVat,
      };

      let vehicleId: string;

      if (existing) {
        await supabase.from("vehicles").update(vehicleData).eq("id", existing.id);
        vehicleId = existing.id;
      } else {
        const { data: created } = await supabase
          .from("vehicles")
          .insert(vehicleData)
          .select("id")
          .single();
        vehicleId = created?.id || "";
      }

      updatedCount++;

      // Save main image to vehicle_images
      if (vehicleId && vehicle.image) {
        const { data: existingImg } = await supabase
          .from("vehicle_images")
          .select("id")
          .eq("vehicle_id", vehicleId)
          .eq("image_url", vehicle.image)
          .maybeSingle();

        if (!existingImg) {
          await supabase.from("vehicle_images").insert({
            vehicle_id: vehicleId,
            image_url: vehicle.image,
            is_main: true,
            sort_order: 0,
          });
          imagesCount++;
        }
      }
    }

    await updateLog({
      status: "completed",
      vehicles_found: vehicles.length,
      vehicles_updated: updatedCount,
      images_downloaded: imagesCount,
      finished_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        vehicles_found: vehicles.length,
        vehicles_updated: updatedCount,
        images_saved: imagesCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Scrape error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
