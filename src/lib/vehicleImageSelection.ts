

export const dedupeImageUrls = (urls: Array<string | null | undefined>) =>
  Array.from(new Set(urls.filter((url): url is string => Boolean(url))));

// Dead legacy server URLs reliably 404 / time out — treat them as missing.
export const isUsableImageUrl = (url: string | null | undefined): url is string =>
  !!url && !url.includes("chrysler-pardubice.cz");

export const VEHICLE_IMAGE_PLACEHOLDER = "/vehicle-placeholder.svg";

type VehicleLike = {
  /** Miniatura z Smart Capture — POUZE pro kartu v nabídce, ne pro detail. */
  thumbnail_url?: string | null;
  image_url?: string | null;
  vehicle_images?: Array<{ image_url?: string | null; is_main?: boolean; sort_order?: number }> | null;
};

/**
 * Single source of truth for "the one photo that represents a vehicle".
 *
 * Catalogue card keeps the original vehicle-photo logic. A separate showroom
 * offer image is intentionally never read here.
 * Main image first, then lowest sort_order, then the flat `image_url` column.
 * Returns "" when nothing usable exists so callers can fall back to the placeholder.
 */
export const getVehicleCardImage = (vehicle: VehicleLike | null | undefined): string => {
  if (!vehicle) return "";
  const sorted = [...(vehicle.vehicle_images ?? [])].sort((a, b) => {
    if (Boolean(a.is_main) !== Boolean(b.is_main)) return Number(b.is_main) - Number(a.is_main);
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const candidates = dedupeImageUrls([
    vehicle.thumbnail_url,
    ...sorted.map((img) => img.image_url),
    vehicle.image_url,
  ]).filter(isUsableImageUrl);

  return candidates[0] ?? "";
};
