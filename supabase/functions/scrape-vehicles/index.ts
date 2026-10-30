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
  // deno-lint-ignore no-explicit-any
  supabase: any,
  imageUrl: string,
  vehicleId: string,
  index: number
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`[img] HTTP ${response.status} for ${imageUrl}`);
      return null;
    }
    const blob = await response.blob();
    if (blob.size < 5000) {
      console.warn(`[img] too small (${blob.size}B) for ${imageUrl}`);
      return null;
    }

    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const filename = `${vehicleId}/${index}.${ext}`;

    const { error } = await supabase.storage
      .from("vehicles")
      .upload(filename, blob, { upsert: true, contentType: `image/${ext === "jpg" ? "jpeg" : ext}` });

    if (error) { console.error(`[img] upload error for ${filename}:`, error.message); return null; }

    const { data: urlData } = supabase.storage.from("vehicles").getPublicUrl(filename);
    return urlData.publicUrl;
  } catch (e) {
    console.error(`[img] fetch failed for ${imageUrl}:`, e);
    return null;
  }
}

/** Smaže Smart Capture fotky napojené na prodané vozidlo (stejná logika jako edge cleanup-sold-vehicle). */
async function cleanupSmartCapture(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  vehicleId: string,
) {
  try {
    const { data: session } = await supabase
      .from("smart_capture_sessions")
      .select("id, metadata")
      .eq("published_vehicle_id", vehicleId)
      .maybeSingle();

    if (!session?.id) return;

    const sessionId = session.id as string;
    const BUCKET = "smart-capture";

    const pathFromUrl = (url: string | null | undefined): string | null => {
      if (!url || typeof url !== "string") return null;
      const marker = `/object/public/${BUCKET}/`;
      const idx = url.indexOf(marker);
      if (idx === -1) return null;
      let path = url.slice(idx + marker.length);
      const q = path.indexOf("?");
      if (q !== -1) path = path.slice(0, q);
      return path || null;
    };

    const { data: photos } = await supabase
      .from("smart_capture_photos")
      .select("original_url, processed_url")
      .eq("session_id", sessionId);

    const paths = new Set<string>();
    for (const p of photos ?? []) {
      const o = pathFromUrl(p.original_url);
      const pr = pathFromUrl(p.processed_url);
      if (o) paths.add(o);
      if (pr) paths.add(pr);
    }

    const meta = (session.metadata ?? {}) as Record<string, unknown>;
    const thumb = pathFromUrl(typeof meta.thumbnail_url === "string" ? meta.thumbnail_url : null);
    if (thumb) paths.add(thumb);

    const { data: listed } = await supabase.storage.from(BUCKET).list(sessionId, { limit: 1000 });
    if (listed?.length) {
      for (const f of listed) {
        if (f.name) paths.add(`${sessionId}/${f.name}`);
      }
    }

    const pathList = [...paths];
    if (pathList.length > 0) {
      await supabase.storage.from(BUCKET).remove(pathList);
    }

    await supabase.from("smart_capture_photos").delete().eq("session_id", sessionId);
    await supabase.from("smart_capture_sessions").delete().eq("id", sessionId);
    console.log(`[cleanup] Smart Capture session ${sessionId} for vehicle ${vehicleId} removed`);
  } catch (e) {
    console.warn(`[cleanup] failed for vehicle ${vehicleId}:`, e);
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

    const { data: existingVehicles } = await supabase.from("vehicles").select("id, name, vin, image_url");
    const existingByName = new Map<string, { id: string; image_url: string }>();
    const existingByVin = new Map<string, { id: string; image_url: string }>();
    for (const v of existingVehicles || []) {
      existingByName.set(v.name.toLowerCase().trim(), { id: v.id, image_url: v.image_url });
      if (v.vin && v.vin.trim() !== "") {
        existingByVin.set(v.vin.trim().toUpperCase(), { id: v.id, image_url: v.image_url });
      }
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

      // Parse inventory number from "karoserie" — last 1-3 digit number in the string
      // e.g. "Rodinné kombi č 43" → "43"
      let inventoryNumber = "";
      if (av.karoserie) {
        const matches = av.karoserie.match(/\d{1,3}/g);
        if (matches && matches.length > 0) {
          inventoryNumber = matches[matches.length - 1];
        }
      }

      // Detect VAT flag — supports "1", "ano", "s dph", true
      const dphRaw = (av.DPH || "").toString().trim().toLowerCase();
      const showVat = dphRaw === "1" || dphRaw === "ano" || dphRaw === "true" || dphRaw.includes("dph");

      const vehicleData = {
        name: av.nazev,
        year: parseInt(av.rok_vyroby, 10) || new Date().getFullYear(),
        price_with_vat: price,
        mileage,
        fuel: av.palivo || "Benzín",
        image_url: mainImageUrl,
        status: "skladem" as const,
        show_vat: showVat,
        inventory_number: inventoryNumber,
        vin: av.vin || "",
        engine: av.objem ? `${av.objem} ccm` : "",
        power: av.vykon ? `${av.vykon} kW` : "",
        color: av.barva || "",
        transmission: "Automatická",
        description,
      };

      let vehicleId: string;
      // Match by VIN first (definitive), fall back to name (legacy entries without VIN)
      const vinKey = (av.vin || "").trim().toUpperCase();
      const existing = (vinKey && existingByVin.get(vinKey)) || existingByName.get(nameKey);

      if (existing) {
        // Never overwrite admin-set flags on existing vehicles — the nightly sync
        // must not reset the DPH toggle (or similar) that was set manually.
        const { show_vat: _ignoredShowVat, ...updateData } = vehicleData;
        await supabase.from("vehicles").update(updateData).eq("id", existing.id);
        vehicleId = existing.id;
        updatedCount++;
      } else {
        // Use upsert on VIN as a safety net against race conditions / concurrent inserts
        const { data: created, error: insErr } = await supabase
          .from("vehicles")
          .upsert(vehicleData, { onConflict: "vin", ignoreDuplicates: false })
          .select("id")
          .single();
        if (insErr) {
          console.error("Insert/upsert failed for", av.nazev, insErr);
          continue;
        }
        vehicleId = created?.id || "";
        createdCount++;
        // Cache the new entry so subsequent rows in same run don't duplicate
        if (vehicleId && vinKey) existingByVin.set(vinKey, { id: vehicleId, image_url: mainImageUrl });
        if (vehicleId) existingByName.set(nameKey, { id: vehicleId, image_url: mainImageUrl });
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

    // Step 4: Mark missing vehicles as sold + cleanup Smart Capture
    for (const [name, { id }] of existingByName) {
      if (!seenNames.has(name)) {
        const { data: updated } = await supabase
          .from("vehicles")
          .update({ status: "prodano" })
          .eq("id", id)
          .neq("status", "prodano")
          .select("id");

        // Cleanup jen pokud se stav skutečně změnil na prodano
        if (updated && updated.length > 0) {
          await cleanupSmartCapture(supabase, id);
        }
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
