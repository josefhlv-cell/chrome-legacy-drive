import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function scrapeWithFirecrawl(url: string, apiKey: string) {
  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["html", "markdown"],
      waitFor: 5000,
    }),
  });
  return await response.json();
}

function parseVehiclesFromHtml(html: string): Array<{
  title: string;
  images: string[];
  details: Record<string, string>;
}> {
  const vehicles: Array<{
    title: string;
    images: string[];
    details: Record<string, string>;
  }> = [];

  // Parse vehicle cards/slides from chrysler.cz HTML
  // The site uses splide carousel with vehicle cards
  const cardRegex =
    /<div[^>]*class="[^"]*(?:car-card|splide__slide|vehicle-card|car-item)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*(?:car-card|splide__slide|vehicle-card|car-item)|\z)/gi;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const cardHtml = match[1];

    // Extract title
    const titleMatch = cardHtml.match(
      /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i
    );
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    if (!title) continue;

    // Extract images
    const imgRegex = /(?:src|data-src)="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/gi;
    const images: string[] = [];
    let imgMatch;
    while ((imgMatch = imgRegex.exec(cardHtml)) !== null) {
      if (
        !imgMatch[1].includes("logo") &&
        !imgMatch[1].includes("icon") &&
        !imgMatch[1].includes("Vector")
      ) {
        images.push(imgMatch[1]);
      }
    }

    // Extract details like price, year, km etc.
    const details: Record<string, string> = {};
    const priceMatch = cardHtml.match(
      /(\d[\d\s]*)\s*(?:Kč|CZK)/i
    );
    if (priceMatch) details.price = priceMatch[1].replace(/\s/g, "");

    const yearMatch = cardHtml.match(/\b(20[0-2]\d|19\d\d)\b/);
    if (yearMatch) details.year = yearMatch[1];

    const kmMatch = cardHtml.match(
      /(\d[\d\s]*)\s*km/i
    );
    if (kmMatch) details.mileage = kmMatch[1].replace(/\s/g, "");

    vehicles.push({ title, images, details });
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

    // Update log if provided
    const updateLog = async (updates: Record<string, unknown>) => {
      if (logId) {
        await supabase
          .from("scrape_log")
          .update(updates)
          .eq("id", logId);
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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 1: Scrape chrysler.cz main page
    await updateLog({ status: "scraping_main_page" });

    const mainPage = await scrapeWithFirecrawl(
      "https://www.chrysler.cz",
      firecrawlKey
    );

    const html = mainPage?.data?.html || mainPage?.html || "";
    const markdown = mainPage?.data?.markdown || mainPage?.markdown || "";

    // Step 2: Try to find vehicle detail page links
    await updateLog({ status: "finding_vehicle_links" });

    // Look for links to individual vehicle pages
    const linkRegex =
      /href="(https?:\/\/(?:www\.)?chrysler\.cz\/[^"]*(?:nabidka|vozidlo|auto|car|detail)[^"]*)"/gi;
    const vehicleLinks: string[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      vehicleLinks.push(linkMatch[1]);
    }

    // Step 3: Parse vehicles from main page
    const vehicles = parseVehiclesFromHtml(html);

    // Also try to extract from markdown
    if (vehicles.length === 0 && markdown) {
      // Parse markdown for vehicle info
      const lines = markdown.split("\n");
      let currentVehicle: { title: string; images: string[]; details: Record<string, string> } | null = null;

      for (const line of lines) {
        const headingMatch = line.match(/^#{1,4}\s+(.+)/);
        if (headingMatch) {
          const text = headingMatch[1].trim();
          if (
            text.match(
              /chrysler|dodge|voyager|pacifica|300|charger|challenger|grand caravan|town|ram/i
            ) &&
            text.length > 5
          ) {
            if (currentVehicle) vehicles.push(currentVehicle);
            currentVehicle = {
              title: text,
              images: [],
              details: {},
            };
          }
        }

        if (currentVehicle) {
          const imgMatch = line.match(
            /!\[.*?\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|webp)[^)]*)\)/i
          );
          if (imgMatch) currentVehicle.images.push(imgMatch[1]);

          const priceMatch = line.match(/(\d[\d\s]*)\s*(?:Kč|CZK)/i);
          if (priceMatch)
            currentVehicle.details.price = priceMatch[1].replace(/\s/g, "");
        }
      }
      if (currentVehicle) vehicles.push(currentVehicle);
    }

    // Step 4: If we found vehicle detail links, scrape each one
    await updateLog({
      status: "scraping_details",
      vehicles_found: vehicles.length + vehicleLinks.length,
    });

    let updatedCount = 0;
    let imagesCount = 0;

    for (const vehicle of vehicles) {
      if (!vehicle.title) continue;

      // Check if vehicle already exists
      const { data: existing } = await supabase
        .from("vehicles")
        .select("id")
        .ilike("name", `%${vehicle.title}%`)
        .maybeSingle();

      const vehicleData = {
        name: vehicle.title,
        year: parseInt(vehicle.details.year || "") || new Date().getFullYear(),
        price_with_vat: parseInt(vehicle.details.price || "") || 0,
        mileage: parseInt(vehicle.details.mileage || "") || 0,
        image_url: vehicle.images[0] || "",
        status: "skladem" as const,
      };

      let vehicleId: string;

      if (existing) {
        await supabase
          .from("vehicles")
          .update(vehicleData)
          .eq("id", existing.id);
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

      // Save images
      if (vehicleId && vehicle.images.length > 0) {
        for (let i = 0; i < vehicle.images.length; i++) {
          const { data: existingImg } = await supabase
            .from("vehicle_images")
            .select("id")
            .eq("vehicle_id", vehicleId)
            .eq("image_url", vehicle.images[i])
            .maybeSingle();

          if (!existingImg) {
            await supabase.from("vehicle_images").insert({
              vehicle_id: vehicleId,
              image_url: vehicle.images[i],
              is_main: i === 0,
              sort_order: i,
            });
            imagesCount++;
          }
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
        images_downloaded: imagesCount,
        vehicle_links_found: vehicleLinks.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
