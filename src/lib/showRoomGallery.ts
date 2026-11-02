export type ShowRoomImage = { id: string; url: string; path: string };

export function readShowRoomImages(value: unknown, vehicleId: string): ShowRoomImage[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is ShowRoomImage => {
    if (!item || typeof item !== "object") return false;
    const { id, url, path } = item;
    if (typeof id !== "string" || typeof url !== "string" || !isShowRoomPath(path, vehicleId) || seen.has(path)) return false;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !parsed.pathname.endsWith(`/storage/v1/object/public/vehicles/${path}`)) return false;
    } catch { return false; }
    seen.add(path);
    return true;
  });
}

export function isShowRoomPath(path: unknown, vehicleId: string): path is string {
  return typeof path === "string" && path.startsWith(`show-room/${vehicleId}/`) && /^show-room\/[0-9a-f-]+\/[0-9a-f-]+\.(jpg|png|webp)$/.test(path);
}

export function selectPublicDetailGallery(original: string[], enabled: boolean, images: ShowRoomImage[]): string[] {
  return enabled && images.length > 0 ? images.map(image => image.url) : original;
}

export function moveShowRoomImage(images: ShowRoomImage[], id: string, target: number): ShowRoomImage[] {
  const index = images.findIndex(image => image.id === id);
  if (index < 0 || target < 0 || target >= images.length) return images;
  const next = [...images];
  const [image] = next.splice(index, 1);
  next.splice(target, 0, image);
  return next;
}