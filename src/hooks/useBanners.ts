import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Banner = Tables<"marketing_banners">;
export type BannerInsert = TablesInsert<"marketing_banners">;
export type BannerUpdate = TablesUpdate<"marketing_banners">;

const PREVIEW_KEY = "cms-preview-mode";
export const isPreviewMode = () =>
  typeof window !== "undefined" && window.sessionStorage.getItem(PREVIEW_KEY) === "1";
export const setPreviewMode = (on: boolean) => {
  if (typeof window === "undefined") return;
  if (on) window.sessionStorage.setItem(PREVIEW_KEY, "1");
  else window.sessionStorage.removeItem(PREVIEW_KEY);
  // Force consumers to refetch
  window.dispatchEvent(new Event("cms-preview-changed"));
};

// Public: fetch active banners (or ALL when preview mode is on, for admins)
export const useActiveBanners = (page: string, position: string) =>
  useQuery({
    queryKey: ["banners", "active", page, position, isPreviewMode() ? "preview" : "live"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const preview = isPreviewMode();
      let q = supabase
        .from("marketing_banners")
        .select("*")
        .eq("target_page", page)
        .eq("target_position", position)
        .order("sort_order", { ascending: true });
      if (!preview) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((b) => {
        if (preview) return true;
        if (b.start_date && b.start_date > nowIso) return false;
        if (b.end_date && b.end_date < nowIso) return false;
        return true;
      });
    },
    staleTime: 60_000,
  });

export const useAllBanners = () =>
  useQuery({
    queryKey: ["banners", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_banners")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCreateBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BannerInsert) => {
      const { data, error } = await supabase.from("marketing_banners").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banners"] }),
  });
};

export const useUpdateBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: BannerUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("marketing_banners")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banners"] }),
  });
};

export const useDeleteBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banners"] }),
  });
};

export const trackBannerImpression = (id: string) => {
  void supabase.rpc("increment_banner_impression" as any, { _banner_id: id });
};
export const trackBannerClick = (id: string) => {
  void supabase.rpc("increment_banner_click" as any, { _banner_id: id });
};
