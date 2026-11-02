import { getPublicVehicleImageUrl, type ShowroomImageLike } from "@/lib/showroomImage";

export const dedupeImageUrls = (urls: Array<string | null | undefined>) =>
  Array.from(new Set(urls.filter((url): url is string => Boolean(url))));

// Dead legacy server URLs reliably 404 / time out — treat them as missing.
export const isUsableImageUrl = (url: string | null | undefined): url is string =>
  !!url && !url.includes("chrysler-pardubice.cz");

export const VEHICLE_IMAGE_PLACEHOLDER = "/vehicle-placeholder.svg";

type VehicleLike = {
  /** Admin-published showroom composite — listing card only. */
  showroom_image_url?: string | null;
  /** Global/per-vehicle Tutorial switch. Showroom variants are opt-in only. */
  showroom_mode?: string | null;
  /** Smart Capture thumbnail — listing card only, not the detail gallery. */
  thumbnail_url?: string | null;
  image_url?: string | null;
  vehicle_images?: Array<ShowroomImageLike & { is_main?: boolean; sort_order?: number }> | null;
};

/**
 * Single source of truth for the photo that represents a vehicle in catalogue cards.
 * The showroom composite may replace the primary photo ONLY while showroom_mode is
 * explicitly "main". When the switch is off, the original primary photo is used.
 * Vehicles without a showroom image naturally fall back to their original photo.
 */
export const getVehicleCardImage = (vehicle: VehicleLike | null | undefined): string => {
  if (!vehicle) return "";
  const sorted = [...(vehicle.vehicle_images ?? [])].sort((a, b) => {
    if (Boolean(a.is_main) !== Boolean(b.is_main)) return Number(b.is_main) - Number(a.is_main);
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const primary = sorted[0];
  const showroomEnabled = vehicle.showroom_mode === "main";
  const primaryShowroom = showroomEnabled && primary?.showroom_url
    ? getPublicVehicleImageUrl(primary)
    : "";

  const candidates = dedupeImageUrls([
    showroomEnabled && isUsableImageUrl(vehicle.showroom_image_url) ? vehicle.showroom_image_url : null,
    primaryShowroom && primaryShowroom !== primary?.image_url ? primaryShowroom : null,
    vehicle.thumbnail_url,
    ...sorted.map((img) => img.image_url),
    vehicle.image_url,
  ]).filter(isUsableImageUrl);

  return candidates[0] ?? "";
};
