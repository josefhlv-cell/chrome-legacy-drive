import { supabase } from "@/integrations/supabase/client";
import { captureImportMeta, listingName } from "./captureMath";
import type { VehicleInfo } from "./export";

const BUCKET = "vehicles";
const BASE_URL = "https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/vehicles";

export type ListingPhoto = { url: string; isMain: boolean; shotType: string };

/**
 * Creates the vehicle listing and copies the original (full) capture photos.
 * Returns an existing listing instead of creating a second one.
 */
export async function publishCaptureListing(input: {
  sessionId: string;
  info: VehicleInfo;
  decoded?: Record<string, unknown> | null;
  sessionVin?: string;
  photos: ListingPhoto[];
  alreadyPublishedId?: string | null;
}): Promise<{ vehicleId: string; created: boolean }> {
  const current = await supabase.from("smart_capture_sessions").select("published_vehicle_id").eq("id", input.sessionId).maybeSingle();
  if (current.error) throw current.error;
  const existingId = current.data?.published_vehicle_id || input.alreadyPublishedId;
  if (existingId) return { vehicleId: existingId, created: false };

  const meta = captureImportMeta(input.info, input.decoded, input.sessionVin);
  const name = listingName(meta);
  if (!name) throw new Error("Vyplňte značku nebo model, aby šel vytvořit inzerát.");
  if (!meta.price) throw new Error("Vyplňte cenu, aby šel vytvořit inzerát.");

  const { data, error } = await supabase.from("vehicles").insert({
    name,
    year: meta.year ?? new Date().getFullYear(),
    price_with_vat: meta.price,
    mileage: meta.mileage ?? 0,
    vin: meta.vin ?? "",
    fuel: meta.fuel ?? "Benzín",
    transmission: meta.transmission ?? "",
    power: meta.power ?? "",
    color: meta.color ?? "",
    description: meta.description ?? "",
    image_url: "",
    status: "skladem",
    show_vat: false,
  }).select("id").single();
  if (error) throw error;
  const vehicleId = data.id;

  // Link first so a retry cannot create a second listing if photo copy fails later.
  const linked = await supabase.from("smart_capture_sessions").update({
    published_vehicle_id: vehicleId,
    vin: meta.vin ?? "",
  }).eq("id", input.sessionId);
  if (linked.error) {
    await supabase.from("vehicles").delete().eq("id", vehicleId);
    throw linked.error;
  }

  try {

  const explicitMain = input.photos.some((photo) => photo.isMain);
  let order = 0;
  let mainUrl = "";
  for (const photo of input.photos) {
    if (!photo.url) continue;
    const response = await fetch(photo.url);
    if (!response.ok) continue;
    const blob = await response.blob();
    if (blob.size < 10000) continue;
    const filename = `${vehicleId}_${Date.now()}_${order}.jpg`;
    const upload = await supabase.storage.from(BUCKET).upload(filename, blob, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (upload.error) throw upload.error;
    const imageUrl = `${BASE_URL}/${filename}`;
    const isMain = photo.isMain || (!explicitMain && order === 0);
    const inserted = await supabase.from("vehicle_images").insert({
      vehicle_id: vehicleId,
      image_url: imageUrl,
      is_main: isMain,
      sort_order: isMain ? 0 : order,
    });
    if (inserted.error) throw inserted.error;
    if (isMain) mainUrl = imageUrl;
    order += 1;
  }
  if (mainUrl) {
    const updated = await supabase.from("vehicles").update({ image_url: mainUrl }).eq("id", vehicleId);
    if (updated.error) throw updated.error;
  }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Neznámá chyba";
    throw new Error(`Inzerát je založený, ale nepodařilo se přenést všechny fotky. ${reason}`);
  }
  return { vehicleId, created: true };
}
