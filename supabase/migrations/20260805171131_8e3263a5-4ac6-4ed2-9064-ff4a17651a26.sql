ALTER TABLE public.smart_capture_settings ADD COLUMN IF NOT EXISTS thumbnail_background text NOT NULL DEFAULT 'off';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS thumbnail_url text;