import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "vehicles";
const BASE_URL = `https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/${BUCKET}`;
const MIN_UPLOAD_SIZE = 10000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Keep gallery order deterministic and repair old rows where every newly
 * uploaded photo was saved with the DB default sort_order = 0.
 *
 * Main photo is always position 0. Other photos are 1..N in their current
 * order. Temporary negative values make the operation safe even if a unique
 * index on (vehicle_id, sort_order) is added later.
 */
const normalizeVehicleImageOrder = async (vehicleId: string) => {
  const { data: rows, error } = await supabase
    .from("vehicle_images")
    .select("id, sort_order, is_main, created_at")
    .eq("vehicle_id", vehicleId)
    .order("is_main", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  const list = rows ?? [];
  if (list.length === 0) return [];

  const main = list.find((row) => row.is_main);
  const nonMain = list.filter((row) => !row.is_main);
  const ordered = main ? [main, ...nonMain] : nonMain;

  // First move everything to unique temporary values.
  for (let i = 0; i < ordered.length; i += 1) {
    const { error: tempError } = await supabase
      .from("vehicle_images")
      .update({ sort_order: -1000000 - i })
      .eq("id", ordered[i].id);
    if (tempError) throw tempError;
  }

  // Then write the final stable order: main = 0, others = 1..N.
  for (let i = 0; i < ordered.length; i += 1) {
    const { error: finalError } = await supabase
      .from("vehicle_images")
      .update({ sort_order: i })
      .eq("id", ordered[i].id);
    if (finalError) throw finalError;
  }

  return ordered;
};

export const useVehicleImages = (vehicleId: string | undefined) => {
  return useQuery({
    queryKey: ["vehicle-images", vehicleId],
    queryFn: async () => {
      if (!vehicleId) return [];
      const { data, error } = await supabase
        .from("vehicle_images")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!vehicleId,
  });
};

export const useVehicleMainImage = (vehicleId: string | undefined) => {
  const { data } = useVehicleImages(vehicleId);
  const mainImg = data?.find((img) => img.is_main);
  return mainImg?.image_url ?? null;
};

export const useAddVehicleImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      vehicleId,
      file,
      isMain = false,
    }: {
      vehicleId: string;
      file: File;
      isMain?: boolean;
    }) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Nepovolený formát: ${file.type}`);
      }
      if (file.size < MIN_UPLOAD_SIZE) {
        throw new Error(`Soubor příliš malý: ${(file.size / 1024).toFixed(1)} KB (min 10 KB)`);
      }

      const filename = `${vehicleId}_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const imageUrl = `${BASE_URL}/${filename}`;

      // Repair/normalize the gallery before adding a new photo. This is the
      // important fix for older/newly created vehicles whose rows all have
      // sort_order = 0.
      await normalizeVehicleImageOrder(vehicleId);

      if (isMain) {
        await supabase
          .from("vehicle_images")
          .update({ is_main: false })
          .eq("vehicle_id", vehicleId)
          .eq("is_main", true);
      }

      const { data: maxRow, error: maxError } = await supabase
        .from("vehicle_images")
        .select("sort_order")
        .eq("vehicle_id", vehicleId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxError) throw maxError;

      // Main is pinned at 0. Non-main photos are appended after the current
      // last photo, so every new upload gets a unique sortable position.
      const nextSortOrder = isMain
        ? 0
        : Math.max(0, Number(maxRow?.sort_order ?? -1) + 1);

      const { data, error } = await supabase
        .from("vehicle_images")
        .insert({
          vehicle_id: vehicleId,
          image_url: imageUrl,
          is_main: isMain,
          sort_order: nextSortOrder,
        })
        .select()
        .single();
      if (error) throw error;

      if (isMain) {
        await supabase
          .from("vehicles")
          .update({ image_url: imageUrl })
          .eq("id", vehicleId);

        // The old main photo just became a normal photo. Normalize again so
        // it cannot keep sort_order = 0 ahead of the rest of the gallery.
        await normalizeVehicleImageOrder(vehicleId);
      }

      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useDeleteVehicleImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vehicleId }: { id: string; vehicleId: string }) => {
      const { error } = await supabase.from("vehicle_images").delete().eq("id", id);
      if (error) throw error;
      await normalizeVehicleImageOrder(vehicleId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useSetMainImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vehicleId, imageUrl }: { id: string; vehicleId: string; imageUrl: string }) => {
      const { error: unsetError } = await supabase
        .from("vehicle_images")
        .update({ is_main: false })
        .eq("vehicle_id", vehicleId);
      if (unsetError) throw unsetError;

      const { error: setError } = await supabase
        .from("vehicle_images")
        .update({ is_main: true, sort_order: 0 })
        .eq("id", id)
        .eq("vehicle_id", vehicleId);
      if (setError) throw setError;

      const { error: vehicleError } = await supabase
        .from("vehicles")
        .update({ image_url: imageUrl })
        .eq("id", vehicleId);
      if (vehicleError) throw vehicleError;

      await normalizeVehicleImageOrder(vehicleId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["showroom-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

// Reorders one photo within a vehicle's gallery. The main photo stays locked
// at position 0; up/down only swap among the remaining (non-main) photos.
export const useReorderVehicleImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      vehicleId,
      direction,
    }: {
      id: string;
      vehicleId: string;
      direction: "up" | "down";
    }) => {
      // This also repairs the current broken gallery where all 9 new photos
      // may currently have sort_order = 0.
      const ordered = await normalizeVehicleImageOrder(vehicleId);
      const idx = ordered.findIndex((row) => row.id === id);
      if (idx < 0) return;
      if (ordered[idx].is_main) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= ordered.length) return;
      if (ordered[swapIdx].is_main) return;

      const a = ordered[idx];
      const b = ordered[swapIdx];

      // Swap the already-normalized positions using a temporary value.
      const { error: tempError } = await supabase
        .from("vehicle_images")
        .update({ sort_order: -2000000 })
        .eq("id", a.id);
      if (tempError) throw tempError;

      const { error: bError } = await supabase
        .from("vehicle_images")
        .update({ sort_order: idx })
        .eq("id", b.id);
      if (bError) throw bError;

      const { error: aError } = await supabase
        .from("vehicle_images")
        .update({ sort_order: swapIdx })
        .eq("id", a.id);
      if (aError) throw aError;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["showroom-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};
