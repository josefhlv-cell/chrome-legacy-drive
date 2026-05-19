import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type VehicleImageRecord = Pick<Tables<"vehicle_images">, "image_url" | "is_main" | "sort_order"> & {
  showroom_url?: string;
  showroom_applied_at?: string | null;
};
export type DbVehicle = Tables<"vehicles"> & { vehicle_images?: VehicleImageRecord[] };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Lean column set for list views — drops heavy fields like description/lpg_description/carfax_url
// that are only needed on the detail page. Cuts JSON payload by ~70%.
const LIST_COLUMNS =
  "id,name,year,price_with_vat,mileage,vin,fuel,status,show_vat,warranty_enabled,lpg_enabled,image_url,inventory_number,showroom_mode,updated_at,created_at,vehicle_images!inner(image_url,is_main,sort_order,showroom_url,showroom_applied_at)";

// Fallback when a vehicle has no rows in vehicle_images yet — left join variant.
const LIST_COLUMNS_LEFT =
  "id,name,year,price_with_vat,mileage,vin,fuel,status,show_vat,warranty_enabled,lpg_enabled,image_url,inventory_number,showroom_mode,updated_at,created_at,vehicle_images(image_url,is_main,sort_order,showroom_url,showroom_applied_at)";

// Admin needs FULL row data (description, engine, transmission, power, color,
// lpg_description, carfax_url, video_id, etc.) so the edit form is pre-filled.
// The lean LIST_COLUMNS_LEFT drops those for performance — fine for the public
// catalog, but breaks admin editing.
const ADMIN_COLUMNS_FULL =
  "*,vehicle_images(image_url,is_main,sort_order,showroom_url,showroom_applied_at)";

// Dedupe by VIN (fallback to id). When duplicates exist, prefer the row that
// actually has gallery images. Avoids picking a stale duplicate whose only
// image is a dead legacy URL (chrysler-pardubice.cz).
const dedupeVehicles = (rows: DbVehicle[]): DbVehicle[] => {
  const byKey = new Map<string, DbVehicle>();
  for (const v of rows) {
    const key = (v.vin && v.vin.trim()) || v.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, v);
      continue;
    }
    const existingHasImages = (existing.vehicle_images?.length ?? 0) > 0;
    const candidateHasImages = (v.vehicle_images?.length ?? 0) > 0;
    if (!existingHasImages && candidateHasImages) {
      byKey.set(key, v);
    }
  }
  return Array.from(byKey.values());
};

/**
 * Fetch vehicles for list views.
 * - Uses a lean column projection (no description, lpg_description, etc.)
 * - Only requests gallery rows where is_main=true → 1 image per vehicle instead of 15-20
 * - Server-side ordering by created_at DESC
 *
 * For Admin (includeHidden=true) we still fetch all images so the admin grid
 * can show a thumbnail when there's no main flag set yet.
 */
export const useVehicles = (includeHidden = false) => {
  return useQuery({
    queryKey: ["vehicles", includeHidden],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      // List view: only main image per vehicle (huge payload reduction).
      // Admin view: keep full gallery so management UI works.
      let query = supabase
        .from("vehicles")
        .select(includeHidden ? ADMIN_COLUMNS_FULL : LIST_COLUMNS_LEFT)
        .order("created_at", { ascending: false });

      if (!includeHidden) {
        query = query.neq("status", "prodano");
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = ((data as unknown) as DbVehicle[]) ?? [];

      // For the public list, keep only the main image per vehicle to minimise client-side work.
      // (Admin still gets the full gallery — used by the management table.)
      const trimmed = includeHidden
        ? rows
        : rows.map((v) => {
            const main = v.vehicle_images?.find((i) => i.is_main) ?? v.vehicle_images?.[0];
            return { ...v, vehicle_images: main ? [main] : [] };
          });

      return dedupeVehicles(trimmed);
    },
  });
};

/**
 * Paginated variant for the public /vozidla page.
 * Loads PAGE_SIZE vehicles per request via Supabase .range() so we don't
 * download all 30+ vehicles upfront. Used together with infinite scroll.
 */
export const useInfiniteVehicles = (pageSize = 12) => {
  return useInfiniteQuery({
    queryKey: ["vehicles-infinite", pageSize],
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("vehicles")
        .select(LIST_COLUMNS_LEFT)
        .neq("status", "prodano")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      const rows = (data as DbVehicle[]) ?? [];
      const trimmed = rows.map((v) => {
        const main = v.vehicle_images?.find((i) => i.is_main) ?? v.vehicle_images?.[0];
        return { ...v, vehicle_images: main ? [main] : [] };
      });
      // Safety net: dedupe by VIN in case DB still has duplicates from legacy data
      return { rows: dedupeVehicles(trimmed), page: pageParam as number };
    },
    getNextPageParam: (last, all) => (last.rows.length < pageSize ? undefined : (last.page as number) + 1),
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
