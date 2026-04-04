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
  salePrice: number | null;
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
  const seen = new Set<string>(); // deduplicate by image URL

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
        text.match(/^Sleva\s/i) ||
        text.match(/nabídka|autoservis|kontakt|služby|díly|video|rady|náhradní|prodej|TADY BYDLÍ/i) ||
        text.length < 8
      ) continue;

      // Save previous vehicle if valid
      if (current?.title && current?.price && current?.image) {
        if (!seen.has(current.image)) {
          seen.add(current.image);
          vehicles.push(current as ParsedVehicle);
        }
      }

      current = {
        title: text.replace(/\s*AKCE\s.*$/i, "").trim(),
        image: "",
        fuel: "Benzín",
        mileage: 0,
        year: new Date().getFullYear(),
        price: 0,
        showVat: false,
        salePrice: null,
      };
      continue;
    }

    if (!current) continue;

    // Image: ![alt](url)
    const imgMatch = line.match(/!\[.*?\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|webp)[^)]*)\)/i);
    if (imgMatch && !current.image) {
      const url = imgMatch[1];
      if (!url.includes("logo") && !url.includes("icon") && !url.includes("Vector") && !url.includes("sale-tag") && !url.includes("/images/")) {
        current.image = url;
        continue;
      }
    }

    // Fuel
    const fuelMatch = line.match(/Palivo:\s*(.+)/i);
    if (fuelMatch) {
      current.fuel = fuelMatch[1].trim();
      continue;
    }

    // Mileage: handle both Km and Mil (miles)
    const mileageMatch = line.match(/Nájezd:\s*([\d\s]+)\s*(Km|Mil)/i);
    if (mileageMatch) {
      const value = parseInt(mileageMatch[1].replace(/\s/g, ""), 10) || 0;
      const unit = mileageMatch[2].toLowerCase();
      // Convert miles to km if needed
      current.mileage = unit === "mil" ? Math.round(value * 1.60934) : value;
      continue;
    }

    // Year
    const yearMatch = line.match(/Rok výroby:\s*(\d{4})/i);
    if (yearMatch) {
      current.year = parseInt(yearMatch[1], 10);
      continue;
    }

    // Sale price: "Nová cena: 519 000 Kč + DPH"
    const salePriceMatch = line.match(/Nová cena:\s*([\d\s]+)\s*Kč/i);
    if (salePriceMatch) {
      current.salePrice = parseInt(salePriceMatch[1].replace(/\s/g, ""), 10) || null;
      if (salePriceMatch.input && /\+\s*DPH/i.test(salePriceMatch.input)) {
        current.showVat = true;
      }
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

  // Don't forget the last one
  if (current?.title && current?.price && current?.image) {
    if (!seen.has(current.image)) {
      seen.add(current.image);
      vehicles.push(current as ParsedVehicle);
    }
  }

  return vehicles;
}

async function downloadImageToStorage(
  supabase: ReturnType<typeof createClient>,
  imageUrl: string,
  vehicleId: string,
  index: number
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.size < 5000) return null; // skip tiny/invalid

    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const filename = `${vehicleId}/${index}.${ext}`;

    const { error } = await supabase.storage
      .from("vehicles")
      .upload(filename, blob, {
        upsert: true,
        contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      });

    if (error) {
      console.error(`Upload error for ${filename}:`, error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("vehicles")
      .getPublicUrl(filename);

    return urlData.publicUrl;
  } catch (e) {
    console.error(`Download failed for ${imageUrl}:`, e);
    return null;
  }
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

    // Step 2: Parse vehicles from markdown (deduped)
    await updateLog({ status: "parsing_vehicles" });
    const scrapedVehicles = parseVehiclesFromMarkdown(markdown);
    console.log(`Parsed ${scrapedVehicles.length} unique vehicles from markdown`);

    // Step 3: Get existing vehicles
    const { data: existingVehicles } = await supabase
      .from("vehicles")
      .select("id, name, image_url");

    const existingByName = new Map<string, { id: string; image_url: string }>();
    for (const v of existingVehicles || []) {
      existingByName.set(v.name.toLowerCase().trim(), { id: v.id, image_url: v.image_url });
    }

    // Track which vehicle names we see in this scrape
    const seenNames = new Set<string>();

    await updateLog({ status: "updating_database", vehicles_found: scrapedVehicles.length });

    let updatedCount = 0;
    let imagesCount = 0;

    for (const vehicle of scrapedVehicles) {
      if (!vehicle.title || !vehicle.price) continue;

      const nameKey = vehicle.title.toLowerCase().trim();
      seenNames.add(nameKey);

      // Use sale price if available
      const finalPrice = vehicle.salePrice || vehicle.price;

      const vehicleData = {
        name: vehicle.title,
        year: vehicle.year,
        price_with_vat: finalPrice,
        mileage: vehicle.mileage,
        fuel: vehicle.fuel,
        image_url: vehicle.image,
        status: "skladem" as const,
        show_vat: vehicle.showVat,
      };

      let vehicleId: string;
      const existing = existingByName.get(nameKey);

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

      // Download and save main image to Supabase storage
      if (vehicleId && vehicle.image) {
        const { data: existingImg } = await supabase
          .from("vehicle_images")
          .select("id")
          .eq("vehicle_id", vehicleId)
          .limit(1)
          .maybeSingle();

        if (!existingImg) {
          const storedUrl = await downloadImageToStorage(supabase, vehicle.image, vehicleId, 0);
          if (storedUrl) {
            await supabase.from("vehicle_images").insert({
              vehicle_id: vehicleId,
              image_url: storedUrl,
              is_main: true,
              sort_order: 0,
            });
            // Update the vehicle's image_url to use stored version
            await supabase.from("vehicles").update({ image_url: storedUrl }).eq("id", vehicleId);
            imagesCount++;
          }
        }
      }
    }

    // Step 4: Mark vehicles not found on chrysler.cz as "prodano"
    const scrapedNameSet = seenNames;
    for (const [name, { id }] of existingByName) {
      if (!scrapedNameSet.has(name)) {
        await supabase
          .from("vehicles")
          .update({ status: "prodano" })
          .eq("id", id)
          .neq("status", "prodano");
      }
    }

    await updateLog({
      status: "completed",
      vehicles_found: scrapedVehicles.length,
      vehicles_updated: updatedCount,
      images_downloaded: imagesCount,
      finished_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        vehicles_found: scrapedVehicles.length,
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
