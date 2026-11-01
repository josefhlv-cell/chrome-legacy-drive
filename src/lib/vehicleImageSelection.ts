import { getPublicVehicleImageUrl, type ShowroomImageLike } from "@/lib/showroomImage";

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
  vehicle_images?: Array<ShowroomImageLike & { is_main?: boolean; sort_order?: number }> | null;
};

/**
 * The public catalogue uses the showroom composite ONLY for the first/main
 * photo after an admin explicitly publishes it. All other gallery images stay
 * original. The vehicle detail page intentionally continues to use image_url.
 */
export const getVehicleCardImage = (vehicle: VehicleLike | null | undefined): string => {
  if (!vehicle) return "";
  const sorted = [...(vehicle.vehicle_images ?? [])].sort((a, b) => {
    if (Boolean(a.is_main) !== Boolean(b.is_main)) return Number(b.is_main) - Number(a.is_main);
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const first = sorted[0];
  const firstUrl = first
    ? getPublicVehicleImageUrl(first)
    : vehicle.image_url || "";

  const candidates = dedupeImageUrls([
    firstUrl,
    vehicle.thumbnail_url,
    vehicle.image_url,
  ]).filter(isUsableImageUrl);

  return candidates[0] ?? "";
};
