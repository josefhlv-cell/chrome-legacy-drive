import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VEHICLE_API = "https://chrysler-pardubice.cz/chrysler_server/Vehicle.php";

interface ApiVehicle {
  ID_vozidla: string;
  nazev: string;
  cena: string;
  cena_akce: string;
  rok_vyroby: string;
  objem: string;
  palivo: string;
  vykon: string;
  spotreba: string;
  karoserie: string;
  najeto: string;
  barva: string;
  stk: string;
  vin: string;
  vybava: string;
  doplnujici_popis: string;
  url: string; // semicolon-separated image URLs
  jednotka: string;
  DPH: string;
}

async function fetchVehiclesFromApi(): Promise<ApiVehicle[]> {
  const response = await fetch(VEHICLE_API);
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return await response.json();
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
    if (blob.size < 5000) return null;

    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const filename = `${vehicleId}/${index}.${ext}`;

    const { error } = await supabase.storage
      .from("vehicles")
      .upload(filename, blob, { upsert: true, contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });

    if (error) { console.error(`Upload error:`, error.message); return null; }

    const { data: urlData } = supabase.storage.from("vehicles").getPublicUrl(filename);
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
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const logId = body.log_id;

    const updateLog = async (updates: Record<string, unknown>) => {
      if (logId) {
        await supabase.from("scrape_log").update(updates).eq("id", logId);
      }
    };

    // Step 1: Fetch vehicles from API
    await updateLog({ status: "fetching_api" });
    console.log("Fetching vehicles from Vehicle.php API...");
    const apiVehicles = await fetchVehiclesFromApi();
    console.log(`Fetched ${apiVehicles.length} vehicles from API`);

    if (!apiVehicles.length) {
      await updateLog({ status: "error", error_message: "No vehicles from API", finished_at: new Date().toISOString() });
      return new Response(
        JSON.stringify({ error: "No vehicles returned from API" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get existing vehicles
    await updateLog({ status: "syncing", vehicles_found: apiVehicles.length });

    const { data: existingVehicles } = await supabase.from("vehicles").select("id, name, image_url");
    const existingByName = new Map<string, { id: string; image_url: string }>();
    for (const v of existingVehicles || []) {
      existingByName.set(v.name.toLowerCase().trim(), { id: v.id, image_url: v.image_url });
    }

    const seenNames = new Set<string>();
    let updatedCount = 0;
    let createdCount = 0;
    let imagesCount = 0;

    // Step 3: Upsert vehicles + download all gallery images
    // Deduplicate API results by name
    const deduped = new Map<string, ApiVehicle>();
    for (const av of apiVehicles) {
      if (!av.nazev || !av.cena) continue;
      const key = av.nazev.toLowerCase().trim();
      if (!deduped.has(key)) deduped.set(key, av);
    }

    for (const av of deduped.values()) {

      const nameKey = av.nazev.toLowerCase().trim();
      seenNames.add(nameKey);

      const imageUrls = av.url ? av.url.split(";").filter(u => u.startsWith("http")) : [];
      const mainImageUrl = imageUrls[0] || "";

      const price = parseInt(av.cena_akce || av.cena, 10) || 0;
      const mileageRaw = parseInt(av.najeto.replace(/[\s.]/g, ""), 10) || 0;
      const mileage = av.jednotka?.toLowerCase() === "mil"
        ? Math.round(mileageRaw * 1.60934)
        : mileageRaw;

      // Build description from vybava + doplnujici_popis
      const descParts: string[] = [];
      if (av.vybava) descParts.push(av.vybava.trim());
      if (av.doplnujici_popis) descParts.push(av.doplnujici_popis.trim());
      const description = descParts.join("\n\n");

      const vehicleData = {
        name: av.nazev,
        year: parseInt(av.rok_vyroby, 10) || new Date().getFullYear(),
        price_with_vat: price,
        mileage,
        fuel: av.palivo || "Benzín",
        image_url: mainImageUrl,
        status: "skladem" as const,
        show_vat: av.DPH === "1" || av.DPH?.toLowerCase() === "ano",
        vin: av.vin || "",
        engine: av.objem ? `${av.objem} ccm` : "",
        power: av.vykon ? `${av.vykon} kW` : "",
        color: av.barva || "",
        transmission: "Automatická",
        description,
      };

      let vehicleId: string;
      const existing = existingByName.get(nameKey);

      if (existing) {
        await supabase.from("vehicles").update(vehicleData).eq("id", existing.id);
        vehicleId = existing.id;
        updatedCount++;
      } else {
        const { data: created } = await supabase
          .from("vehicles").insert(vehicleData).select("id").single();
        vehicleId = created?.id || "";
        createdCount++;
      }

      // Download ALL gallery images (not just main)
      if (vehicleId && imageUrls.length > 0) {
        // Check how many images already exist for this vehicle
        const { data: existingImgs } = await supabase
          .from("vehicle_images")
          .select("id")
          .eq("vehicle_id", vehicleId);

        const existingImgCount = existingImgs?.length || 0;

        // Only download if we have more images from API than in DB
        if (existingImgCount < imageUrls.length) {
          // Delete old images and re-download all
          if (existingImgCount > 0) {
            await supabase.from("vehicle_images").delete().eq("vehicle_id", vehicleId);
          }

          for (let i = 0; i < imageUrls.length; i++) {
            const storedUrl = await downloadImageToStorage(supabase, imageUrls[i], vehicleId, i);
            if (storedUrl) {
              await supabase.from("vehicle_images").insert({
                vehicle_id: vehicleId,
                image_url: storedUrl,
                is_main: i === 0,
                sort_order: i,
              });
              imagesCount++;

              // Update main image_url on vehicle
              if (i === 0) {
                await supabase.from("vehicles").update({ image_url: storedUrl }).eq("id", vehicleId);
              }
            }
          }
        }
      }
    }

    // Step 4: Mark missing vehicles as sold
    for (const [name, { id }] of existingByName) {
      if (!seenNames.has(name)) {
        await supabase.from("vehicles").update({ status: "prodano" }).eq("id", id).neq("status", "prodano");
      }
    }

    await updateLog({
      status: "completed",
      vehicles_found: apiVehicles.length,
      vehicles_updated: updatedCount + createdCount,
      images_downloaded: imagesCount,
      finished_at: new Date().toISOString(),
    });

    console.log(`Done: ${updatedCount} updated, ${createdCount} created, ${imagesCount} images`);

    return new Response(
      JSON.stringify({
        success: true,
        vehicles_found: apiVehicles.length,
        vehicles_updated: updatedCount + createdCount,
        images_saved: imagesCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Sync error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
