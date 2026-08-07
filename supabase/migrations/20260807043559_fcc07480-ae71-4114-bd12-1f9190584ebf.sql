ALTER TABLE public.smart_capture_settings
  ADD COLUMN IF NOT EXISTS dealer_mode boolean NOT NULL DEFAULT false;