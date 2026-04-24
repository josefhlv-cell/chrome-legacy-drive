import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type VehicleImageRecord = Pick<Tables<"vehicle_images">, "image_url" | "is_main" | "sort_order">;
export type DbVehicle = Tables<"vehicles"> & { vehicle_images?: VehicleImageRecord[] };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const useVehicles = (includeHidden = false) => {
  return useQuery({
    queryKey: ["vehicles", includeHidden],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("vehicles")
        .select("*, vehicle_images(image_url, is_main, sort_order)")
        .order("created_at", { ascending: false });
      if (!includeHidden) {
        query = query.neq("status", "prodano");
      }
      const { data, error } = await query;
      if (error) throw error;

      // Dedupe by VIN (fallback to id). When duplicates exist, prefer the row that
      // actually has gallery images in vehicle_images — this avoids picking a stale
      // duplicate whose only image is a dead legacy URL (chrysler-pardubice.cz).
      const byKey = new Map<string, DbVehicle>();
      for (const v of (data as DbVehicle[]) ?? []) {
        const key = (v.vin && v.vin.trim()) || v.id;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, v);
          continue;
        }
        const existingHasImages = (existing.vehicle_images?.length ?? 0) > 0;
        const candidateHasImages = (v.vehicle_images?.length ?? 0) > 0;
        // Upgrade only if the new candidate has images and the existing one doesn't.
        if (!existingHasImages && candidateHasImages) {
          byKey.set(key, v);
        }
      }
      return Array.from(byKey.values());
    },
  });
};

export const useVehicle = (id: string | undefined) => {
  return useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      if (!id) return null;

      if (!UUID_REGEX.test(id)) {
        console.warn("Vehicle detail opened with non-UUID id, using fallback flow:", id);
        return null;
      }

      const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
      if (error) {
        console.error("Supabase Error:", error);
        throw error;
      }
      if (!data) {
        console.warn("Vehicle not found for id:", id);
      }
      return data as DbVehicle | null;
    },
    enabled: !!id,
  });
};

export const useCreateVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vehicle: TablesInsert<"vehicles">) => {
      const { data, error } = await supabase.from("vehicles").insert(vehicle).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
};

export const useUpdateVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<"vehicles"> }) => {
      const { data, error } = await supabase.from("vehicles").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
};

export const useDeleteVehicle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
};
