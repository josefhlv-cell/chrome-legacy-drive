
-- Smart Capture isolated tables
CREATE TABLE public.smart_capture_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  vin text NOT NULL DEFAULT '',
  decoded_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score integer NOT NULL DEFAULT 0,
  has_360 boolean NOT NULL DEFAULT false,
  published_vehicle_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.smart_capture_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage smart_capture_sessions"
ON public.smart_capture_sessions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER smart_capture_sessions_updated_at
BEFORE UPDATE ON public.smart_capture_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.smart_capture_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.smart_capture_sessions(id) ON DELETE CASCADE,
  shot_type text NOT NULL DEFAULT 'unknown',
  shot_index integer NOT NULL DEFAULT 0,
  original_url text NOT NULL DEFAULT '',
  processed_url text NOT NULL DEFAULT '',
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score integer NOT NULL DEFAULT 0,
  ai_classification jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_main boolean NOT NULL DEFAULT false,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.smart_capture_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage smart_capture_photos"
ON public.smart_capture_photos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_smart_capture_photos_session ON public.smart_capture_photos(session_id, shot_index);

CREATE TABLE public.smart_capture_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  ai_quality_check text NOT NULL DEFAULT 'on',           -- on | suggest | off
  ai_realtime_hints text NOT NULL DEFAULT 'on',
  auto_image_processing text NOT NULL DEFAULT 'on',
  auto_brightness_normalize text NOT NULL DEFAULT 'on',
  auto_exposure_correction text NOT NULL DEFAULT 'on',
  auto_crop text NOT NULL DEFAULT 'suggest',
  auto_sort_gallery text NOT NULL DEFAULT 'on',
  auto_pick_main text NOT NULL DEFAULT 'on',
  ai_classify_shots text NOT NULL DEFAULT 'on',
  blur_detection text NOT NULL DEFAULT 'on',
  vin_scan_enabled text NOT NULL DEFAULT 'on',
  vin_ocr text NOT NULL DEFAULT 'on',
  vin_autofill text NOT NULL DEFAULT 'on',
  export_folders text NOT NULL DEFAULT 'on',
  generate_web_versions text NOT NULL DEFAULT 'on',
  generate_listing_versions text NOT NULL DEFAULT 'on',
  auto_naming text NOT NULL DEFAULT 'on',
  watermark text NOT NULL DEFAULT 'off',
  blur_license_plate text NOT NULL DEFAULT 'off',
  quality_score_enabled text NOT NULL DEFAULT 'on',
  auto_360_generation text NOT NULL DEFAULT 'suggest',
  background_video_capture text NOT NULL DEFAULT 'off',
  assistance_level text NOT NULL DEFAULT 'recommended', -- minimal | recommended | full
  safe_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.smart_capture_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read smart_capture_settings"
ON public.smart_capture_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage smart_capture_settings"
ON public.smart_capture_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER smart_capture_settings_updated_at
BEFORE UPDATE ON public.smart_capture_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.smart_capture_settings (singleton) VALUES (true);

-- Isolated storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('smart-capture', 'smart-capture', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Smart capture public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'smart-capture');

CREATE POLICY "Admins write smart-capture"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'smart-capture' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update smart-capture"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'smart-capture' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete smart-capture"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'smart-capture' AND public.has_role(auth.uid(), 'admin'::app_role));
