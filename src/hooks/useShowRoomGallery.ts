import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { isShowRoomPath, readShowRoomImages, type ShowRoomImage } from "@/lib/showRoomGallery";

const BUCKET = "vehicles";
const cleanupKey = (vehicleId: string) => `show-room-cleanup:${vehicleId}`;

export function pendingShowRoomCleanup(vehicleId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(cleanupKey(vehicleId)) || "[]");
    return Array.isArray(value) ? value.filter(path => isShowRoomPath(path, vehicleId)) : [];
  } catch { return []; }
}

function recordCleanup(vehicleId: string, paths: string[]) {
  localStorage.setItem(cleanupKey(vehicleId), JSON.stringify([...new Set(paths)]));
}

export async function retryShowRoomCleanup(vehicleId: string) {
  const paths = pendingShowRoomCleanup(vehicleId);
  if (!paths.length) return;
  // Never remove an object still referenced by the latest persisted gallery.
  const { data, error } = await supabase.from("vehicles").select("show_room_images").eq("id", vehicleId).single();
  if (error) throw error;
  const used = new Set(readShowRoomImages(data.show_room_images, vehicleId).map(image => image.path));
  const removable = paths.filter(path => !used.has(path));
  if (removable.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(removable);
    if (storageError) throw storageError;
  }
  recordCleanup(vehicleId, []);
}

export function useShowRoomGallery(vehicleId: string, load: boolean) {
  return useQuery({
    queryKey: ["show-room-gallery", vehicleId], enabled: load,
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("show_room_images,show_room_enabled").eq("id", vehicleId).single();
      if (error) throw error;
      return { raw: data.show_room_images, images: readShowRoomImages(data.show_room_images, vehicleId), enabled: data.show_room_enabled };
    },
  });
}

type Snapshot = { raw: Json; enabled: boolean };

export function useSaveShowRoomGallery(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ snapshot, images, enabled }: { snapshot: Snapshot; images: ShowRoomImage[]; enabled: boolean }) => {
      if (enabled && !images.length) throw new Error("Nejprve nahrajte fotografie Show Room.");
      const { data, error } = await supabase.from("vehicles")
        .update({ show_room_images: images as Json, show_room_enabled: enabled })
        .eq("id", vehicleId).eq("show_room_images", JSON.stringify(snapshot.raw)).eq("show_room_enabled", snapshot.enabled)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Galerii mezitím změnil jiný administrátor. Obnovte ji a zkuste to znovu.");
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["show-room-gallery", vehicleId] }),
        qc.invalidateQueries({ queryKey: ["vehicle", vehicleId] }),
        qc.invalidateQueries({ queryKey: ["vehicles", true] }),
      ]);
    },
  });
}

export async function uploadShowRoomImage(vehicleId: string, file: File): Promise<ShowRoomImage> {
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type];
  if (!extension) throw new Error("Povolené formáty: JPG, PNG a WebP.");
  if (file.size < 10000) throw new Error("Fotografie musí mít alespoň 10 KB.");
  const id = crypto.randomUUID();
  const path = `show-room/${vehicleId}/${id}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return { id, path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

export async function scheduleShowRoomCleanup(vehicleId: string, paths: string[]) {
  if (paths.some(path => !isShowRoomPath(path, vehicleId))) throw new Error("Původní fotografie nelze touto akcí odstranit.");
  recordCleanup(vehicleId, [...pendingShowRoomCleanup(vehicleId), ...paths]);
  await retryShowRoomCleanup(vehicleId);
}