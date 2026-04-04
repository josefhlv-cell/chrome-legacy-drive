import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Types ──
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

interface JobState {
  status: "running" | "completed" | "failed";
  phase: "queued" | "scraping" | "extracting" | "saving" | "done" | "error";
  progress: number;
  message: string;
  vehicles: number;
  updated: number;
  created: number;
  started_at: string;
  completed_at: string | null;
  user_id: string | null;
}

// ── Firecrawl ──
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
      waitFor: 8000,
      timeout: 120000,
    }),
  });
  return await response.json();
}

// ── Parse vehicles from markdown ──
function parseVehiclesFromMarkdown(markdown: string): ParsedVehicle[] {
  const vehicles: ParsedVehicle[] = [];
  const seen = new Set<string>();

  const offerIdx = markdown.indexOf("naše nabídka vozů");
  if (offerIdx === -1) return vehicles;

  const section = markdown.substring(offerIdx);
  const lines = section.split("\n");

  let current: Partial<ParsedVehicle> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const titleMatch = line.match(/^#{1,3}\s+(.+)/);
    if (titleMatch) {
      const text = titleMatch[1].trim().replace(/\\-/g, "-");

      if (
        text.match(/^\+\s*DPH$/i) ||
        text.match(/^Sleva\s/i) ||
        text.match(/nabídka|autoservis|kontakt|služby|díly|video|rady|náhradní|prodej|TADY BYDLÍ/i) ||
        text.length < 8
      ) continue;

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

    const imgMatch = line.match(/!\[.*?\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|webp)[^)]*)\)/i);
    if (imgMatch && !current.image) {
      const url = imgMatch[1];
      if (!url.includes("logo") && !url.includes("icon") && !url.includes("Vector") && !url.includes("sale-tag") && !url.includes("/images/")) {
        current.image = url;
        continue;
      }
    }

    const fuelMatch = line.match(/Palivo:\s*(.+)/i);
    if (fuelMatch) { current.fuel = fuelMatch[1].trim(); continue; }

    const mileageMatch = line.match(/Nájezd:\s*([\d\s]+)\s*(Km|Mil)/i);
    if (mileageMatch) {
      const value = parseInt(mileageMatch[1].replace(/\s/g, ""), 10) || 0;
      const unit = mileageMatch[2].toLowerCase();
      current.mileage = unit === "mil" ? Math.round(value * 1.60934) : value;
      continue;
    }

    const yearMatch = line.match(/Rok výroby:\s*(\d{4})/i);
    if (yearMatch) { current.year = parseInt(yearMatch[1], 10); continue; }

    const salePriceMatch = line.match(/Nová cena:\s*([\d\s]+)\s*Kč/i);
    if (salePriceMatch) {
      current.salePrice = parseInt(salePriceMatch[1].replace(/\s/g, ""), 10) || null;
      if (salePriceMatch.input && /\+\s*DPH/i.test(salePriceMatch.input)) current.showVat = true;
      continue;
    }

    const priceMatch = line.match(/Cena:\s*([\d\s]+)\s*Kč/i);
    if (priceMatch) {
      current.price = parseInt(priceMatch[1].replace(/\s/g, ""), 10) || 0;
      current.showVat = /\+\s*DPH/i.test(line);
      continue;
    }
  }

  if (current?.title && current?.price && current?.image) {
    if (!seen.has(current.image)) {
      seen.add(current.image);
      vehicles.push(current as ParsedVehicle);
    }
  }

  return vehicles;
}

// ── Download image to storage ──
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
    if (blob.size < 5000) return null;

    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const filename = `${vehicleId}/${index}.${ext}`;

    const { error } = await supabase.storage
      .from("vehicles")
      .upload(filename, blob, { upsert: true, contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });

    if (error) { console.error(`Upload error for ${filename}:`, error.message); return null; }

    const { data: urlData } = supabase.storage.from("vehicles").getPublicUrl(filename);
    return urlData.publicUrl;
  } catch (e) {
    console.error(`Download failed for ${imageUrl}:`, e);
    return null;
  }
}

// ── Update job state in api_cache ──
async function updateJobState(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  updates: Partial<JobState>
) {
  // Read current state
  const { data: existing } = await supabase
    .from("api_cache")
    .select("data")
    .eq("cache_key", jobId)
    .eq("cache_type", "vehicle_sync_status")
    .single();

  const currentData = (existing?.data || {}) as JobState;
  const newData = { ...currentData, ...updates };

  await supabase
    .from("api_cache")
    .update({ data: newData })
    .eq("cache_key", jobId)
    .eq("cache_type", "vehicle_sync_status");
}

// ── Background sync process ──
async function runSync(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  firecrawlKey: string
) {
  try {
    // Phase 1: Scraping
    await updateJobState(supabase, jobId, {
      phase: "scraping",
      progress: 10,
      message: "Stahování dat z chrysler.cz...",
    });

    const mainPage = await scrapeWithFirecrawl("https://www.chrysler.cz", firecrawlKey);
    const markdown = mainPage?.data?.markdown || mainPage?.markdown || "";

    if (!markdown) {
      await updateJobState(supabase, jobId, {
        status: "failed",
        phase: "error",
        progress: 100,
        message: "Nepodařilo se stáhnout obsah z chrysler.cz",
        completed_at: new Date().toISOString(),
      });
      return;
    }

    // Phase 2: Extracting
    await updateJobState(supabase, jobId, {
      phase: "extracting",
      progress: 35,
      message: "Extrakce vozidel z dat...",
    });

    const scrapedVehicles = parseVehiclesFromMarkdown(markdown);
    console.log(`Parsed ${scrapedVehicles.length} unique vehicles`);

    if (scrapedVehicles.length === 0) {
      await updateJobState(supabase, jobId, {
        status: "failed",
        phase: "error",
        progress: 100,
        message: "Nebyly nalezeny žádné vozy v obsahu",
        completed_at: new Date().toISOString(),
      });
      return;
    }

    await updateJobState(supabase, jobId, {
      phase: "extracting",
      progress: 55,
      message: `Nalezeno ${scrapedVehicles.length} vozidel, ukládám...`,
      vehicles: scrapedVehicles.length,
    });

    // Phase 3: Saving
    await updateJobState(supabase, jobId, {
      phase: "saving",
      progress: 60,
      message: "Ukládání do databáze...",
    });

    const { data: existingVehicles } = await supabase
      .from("vehicles")
      .select("id, name, image_url");

    const existingByName = new Map<string, { id: string; image_url: string }>();
    for (const v of existingVehicles || []) {
      existingByName.set(v.name.toLowerCase().trim(), { id: v.id, image_url: v.image_url });
    }

    const seenNames = new Set<string>();
    let updatedCount = 0;
    let createdCount = 0;
    let imagesCount = 0;

    for (let i = 0; i < scrapedVehicles.length; i++) {
      const vehicle = scrapedVehicles[i];
      if (!vehicle.title || !vehicle.price) continue;

      const nameKey = vehicle.title.toLowerCase().trim();
      seenNames.add(nameKey);

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
        updatedCount++;
      } else {
        const { data: created } = await supabase
          .from("vehicles")
          .insert(vehicleData)
          .select("id")
          .single();
        vehicleId = created?.id || "";
        createdCount++;
      }

      // Download image to storage
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
            await supabase.from("vehicles").update({ image_url: storedUrl }).eq("id", vehicleId);
            imagesCount++;
          }
        }
      }

      // Update progress during saving (60-90%)
      const saveProgress = 60 + Math.round((i / scrapedVehicles.length) * 30);
      await updateJobState(supabase, jobId, {
        progress: saveProgress,
        message: `Ukládání vozidla ${i + 1}/${scrapedVehicles.length}...`,
        updated: updatedCount,
        created: createdCount,
      });
    }

    // Mark vehicles not on chrysler.cz as "prodano"
    for (const [name, { id }] of existingByName) {
      if (!seenNames.has(name)) {
        await supabase
          .from("vehicles")
          .update({ status: "prodano" })
          .eq("id", id)
          .neq("status", "prodano");
      }
    }

    // Done
    await updateJobState(supabase, jobId, {
      status: "completed",
      phase: "done",
      progress: 100,
      message: `Dokončeno! ${updatedCount} aktualizováno, ${createdCount} nových, ${imagesCount} fotek staženo.`,
      vehicles: scrapedVehicles.length,
      updated: updatedCount,
      created: createdCount,
      completed_at: new Date().toISOString(),
    });

    // Also log to scrape_log
    await supabase.from("scrape_log").insert({
      status: "completed",
      vehicles_found: scrapedVehicles.length,
      vehicles_updated: updatedCount + createdCount,
      images_downloaded: imagesCount,
      finished_at: new Date().toISOString(),
      triggered_by: "admin",
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Neznámá chyba";
    console.error("Sync error:", msg);
    await updateJobState(supabase, jobId, {
      status: "failed",
      phase: "error",
      progress: 100,
      message: `Chyba: ${msg}`,
      completed_at: new Date().toISOString(),
    });
  }
}

// ── Main handler ──
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

    // ── Mode B: Poll job status ──
    if (body.jobId) {
      const { data: cache } = await supabase
        .from("api_cache")
        .select("data")
        .eq("cache_key", body.jobId)
        .eq("cache_type", "vehicle_sync_status")
        .single();

      if (!cache) {
        return new Response(
          JSON.stringify({ success: false, error: "Job not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, ...(cache.data as Record<string, unknown>) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Mode A: Start new sync ──
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if another sync is running
    const { data: running } = await supabase
      .from("api_cache")
      .select("cache_key, data")
      .eq("cache_type", "vehicle_sync_status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (running) {
      const runData = running.data as JobState;
      if (runData.status === "running") {
        return new Response(
          JSON.stringify({
            success: true,
            queued: false,
            already_running: true,
            jobId: running.cache_key,
            ...runData,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create new job
    const jobId = crypto.randomUUID();
    const initialState: JobState = {
      status: "running",
      phase: "queued",
      progress: 0,
      message: "Spouštím synchronizaci...",
      vehicles: 0,
      updated: 0,
      created: 0,
      started_at: new Date().toISOString(),
      completed_at: null,
      user_id: null,
    };

    await supabase.from("api_cache").insert({
      cache_type: "vehicle_sync_status",
      cache_key: jobId,
      data: initialState,
    });

    // Fire and forget — start sync in background
    // EdgeRuntime doesn't support waitUntil, so we use a non-awaited promise
    runSync(supabase, jobId, firecrawlKey).catch((e) =>
      console.error("Background sync crashed:", e)
    );

    // Return immediately
    return new Response(
      JSON.stringify({ success: true, queued: true, jobId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Scrape error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
