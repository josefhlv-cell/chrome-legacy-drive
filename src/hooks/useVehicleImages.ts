import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "vehicles";
const BASE_URL = `https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/${BUCKET}`;
const MIN_UPLOAD_SIZE = 10000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

      // Put new secondary photos at the end. This prevents new galleries from
      // getting duplicate sort_order=0 values and keeps drag/drop deterministic.
      let nextSortOrder = 0;
      if (!isMain) {
        const { data: lastRows, error: orderError } = await supabase
          .from("vehicle_images")
          .select("sort_order")
          .eq("vehicle_id", vehicleId)
          .eq("is_main", false)
          .order("sort_order", { ascending: false })
          .limit(1);
        if (orderError) throw orderError;
        nextSortOrder = (lastRows?.[0]?.sort_order ?? -1) + 1;
      }

      // If setting as main, unset existing main
      if (isMain) {
        await supabase
          .from("vehicle_images")
          .update({ is_main: false })
          .eq("vehicle_id", vehicleId)
          .eq("is_main", true);
      }

      const { data, error } = await supabase
        .from("vehicle_images")
        .insert({ vehicle_id: vehicleId, image_url: imageUrl, is_main: isMain, sort_order: nextSortOrder })
        .select()
        .single();
      if (error) throw error;

      // Also update vehicles.image_url if this is main
      if (isMain) {
        await supabase
          .from("vehicles")
          .update({ image_url: imageUrl })
          .eq("id", vehicleId);
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
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle-images", vars.vehicleId] });
    },
  });
};

export const useSetMainImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vehicleId, imageUrl }: { id: string; vehicleId: string; imageUrl: string }) => {
      // Unset all main for this vehicle
      await supabase
        .from("vehicle_images")
        .update({ is_main: false })
        .eq("vehicle_id", vehicleId);
      // Set new main
      const { error } = await supabase
        .from("vehicle_images")
        .update({ is_main: true })
        .eq("id", id);
      if (error) throw error;
      // Update vehicles.image_url
      await supabase
        .from("vehicles")
        .update({ image_url: imageUrl })
        .eq("id", vehicleId);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

// Reorders one photo within a vehicle's gallery. The main photo stays locked at
// position 0; up/down only swap among the remaining (non-main) photos.
export const useMoveVehicleImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      vehicleId,
      targetId,
    }: {
      id: string;
      vehicleId: string;
      targetId: string;
    }) => {
      const { data: rows, error } = await supabase
        .from("vehicle_images")
        .select("id, sort_order, is_main")
        .eq("vehicle_id", vehicleId)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;

      const main = (rows ?? []).filter((r) => r.is_main);
      const nonMain = (rows ?? []).filter((r) => !r.is_main);
      const from = nonMain.findIndex((r) => r.id === id);
      const to = nonMain.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0 || from === to) return;

      const reordered = [...nonMain];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);

      // First put every non-main row into a unique temporary range. This also
      // repairs galleries where older uploads accidentally all had sort_order=0.
      for (let i = 0; i < reordered.length; i++) {
        const { error: tempError } = await supabase
          .from("vehicle_images")
          .update({ sort_order: -100000 - i })
          .eq("id", reordered[i].id);
        if (tempError) throw tempError;
      }

      // Then write the final contiguous order. Main photos remain untouched.
      for (let i = 0; i < reordered.length; i++) {
        const { error: finalError } = await supabase
          .from("vehicle_images")
          .update({ sort_order: i + main.length })
          .eq("id", reordered[i].id);
        if (finalError) throw finalError;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["showroom-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};

export const useReorderVehicleImage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vehicleId, direction }: { id: string; vehicleId: string; direction: "up" | "down" }) => {
      const { data: rows, error } = await supabase
        .from("vehicle_images")
        .select("id, sort_order, is_main")
        .eq("vehicle_id", vehicleId)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      const list = rows ?? [];
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) return;
      if (list[idx].is_main) return; // main photo is pinned first
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= list.length) return;
      if (list[swapIdx].is_main) return;
      const a = list[idx];
      const b = list[swapIdx];
      // Two-step swap via a temporary value, safe even if a unique index is added later.
      const tempOrder = -1 - idx;
      await supabase.from("vehicle_images").update({ sort_order: tempOrder }).eq("id", a.id);
      await supabase.from("vehicle_images").update({ sort_order: a.sort_order }).eq("id", b.id);
      await supabase.from("vehicle_images").update({ sort_order: b.sort_order }).eq("id", a.id);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicle-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["showroom-images", vars.vehicleId] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};
