import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "smart-capture";

export const useSmartCaptureSettings = () => {
  return useQuery({
    queryKey: ["smart-capture-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smart_capture_settings")
        .select("*")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateSmartCaptureSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("smart_capture_settings")
        .update(updates as never)
        .eq("singleton", true)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smart-capture-settings"] }),
  });
};

export const useCreateSession = () => {
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášený uživatel");
      const { data, error } = await supabase
        .from("smart_capture_sessions")
        .insert({ user_id: user.id, status: "active" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
};

export const useSession = (sessionId: string | undefined) => {
  return useQuery({
    queryKey: ["smart-capture-session", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from("smart_capture_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });
};

export const useSessionPhotos = (sessionId: string | undefined) => {
  return useQuery({
    queryKey: ["smart-capture-photos", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from("smart_capture_photos" as never)
        .select("*")
        .eq("session_id", sessionId)
        .order("shot_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionId,
    refetchOnWindowFocus: false,
  });
};

export interface UploadPhotoInput {
  sessionId: string;
  shotType: string;
  shotIndex: number;
  originalBlob: Blob;
  processedBlob: Blob;
  width: number;
  height: number;
  quality: Record<string, unknown>;
  qualityScore: number;
  aiClassification: Record<string, unknown>;
  isMain?: boolean;
}

export const useUploadPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadPhotoInput) => {
      const stamp = Date.now();
      const basePath = `${input.sessionId}/${stamp}_${input.shotIndex}_${input.shotType}`;
      const origPath = `${basePath}_orig.jpg`;
      const procPath = `${basePath}_web.jpg`;

      const [o, p] = await Promise.all([
        supabase.storage.from(BUCKET).upload(origPath, input.originalBlob, { contentType: "image/jpeg", upsert: true }),
        supabase.storage.from(BUCKET).upload(procPath, input.processedBlob, { contentType: "image/jpeg", upsert: true }),
      ]);
      if (o.error) throw o.error;
      if (p.error) throw p.error;

      const base = (path: string) =>
        `https://thqyzghifwmwohgfvshf.supabase.co/storage/v1/object/public/${BUCKET}/${path}`;

      const { data, error } = await supabase
        .from("smart_capture_photos" as never)
        .insert({
          session_id: input.sessionId,
          shot_type: input.shotType,
          shot_index: input.shotIndex,
          original_url: base(origPath),
          processed_url: base(procPath),
          width: input.width,
          height: input.height,
          quality: input.quality,
          quality_score: input.qualityScore,
          ai_classification: input.aiClassification,
          is_main: input.isMain ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["smart-capture-photos", vars.sessionId] });
    },
  });
};

export const useDeleteSessionPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sessionId }: { id: string; sessionId: string }) => {
      const { error } = await supabase.from("smart_capture_photos").delete().eq("id", id);
      if (error) throw error;
      return sessionId;
    },
    onSuccess: (sessionId) => {
      qc.invalidateQueries({ queryKey: ["smart-capture-photos", sessionId] });
    },
  });
};

export const useUpdateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("smart_capture_sessions")
        .update(updates as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["smart-capture-session", vars.id] });
    },
  });
};

export const useSessions = () => {
  return useQuery({
    queryKey: ["smart-capture-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smart_capture_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
};
