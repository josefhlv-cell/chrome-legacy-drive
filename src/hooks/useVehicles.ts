import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type DbVehicle = Tables<"vehicles">;

export const useVehicles = (includeHidden = false) => {
  return useQuery({
    queryKey: ["vehicles", includeHidden],
    queryFn: async () => {
      let query = supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (!includeHidden) {
        query = query.neq("status", "prodano");
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as DbVehicle[];
    },
  });
};

export const useVehicle = (id: string | undefined) => {
  return useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).single();
      if (error) throw error;
      return data as DbVehicle;
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
