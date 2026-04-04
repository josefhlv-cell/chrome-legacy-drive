import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Site Contacts ──
export const useSiteContacts = () =>
  useQuery({
    queryKey: ["site_contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_contacts").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((row: any) => { map[row.key] = row.value; });
      return map;
    },
  });

export const useUpdateContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("site_contacts")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_contacts"] }),
  });
};

// ── Ticker Items ──
export const useTickerItems = () =>
  useQuery({
    queryKey: ["ticker_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticker_items")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Array<{
        id: string;
        text: string;
        sort_order: number;
        is_active: boolean;
        created_at: string;
      }>;
    },
  });

export const useCreateTickerItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("ticker_items").insert({ text });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticker_items"] }),
  });
};

export const useUpdateTickerItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text, is_active }: { id: string; text?: string; is_active?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (text !== undefined) updates.text = text;
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await supabase.from("ticker_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticker_items"] }),
  });
};

export const useDeleteTickerItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticker_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticker_items"] }),
  });
};

// ── Facility Photos ──
export const useFacilityPhotos = () =>
  useQuery({
    queryKey: ["facility_photos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facility_photos")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Array<{
        id: string;
        image_url: string;
        caption: string;
        alt_text: string;
        sort_order: number;
        created_at: string;
      }>;
    },
  });

export const useAddFacilityPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `facility/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("vehicles")
        .upload(path, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("vehicles").getPublicUrl(path);
      const { error } = await supabase.from("facility_photos").insert({
        image_url: urlData.publicUrl,
        caption,
        alt_text: caption,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facility_photos"] }),
  });
};

export const useDeleteFacilityPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("facility_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["facility_photos"] }),
  });
};

// ── Scrape Log ──
export const useScrapeLog = () =>
  useQuery({
    queryKey: ["scrape_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrape_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Array<{
        id: string;
        started_at: string;
        finished_at: string | null;
        status: string;
        vehicles_found: number;
        vehicles_updated: number;
        images_downloaded: number;
        error_message: string | null;
        triggered_by: string;
      }>;
    },
    refetchInterval: 5000,
  });
