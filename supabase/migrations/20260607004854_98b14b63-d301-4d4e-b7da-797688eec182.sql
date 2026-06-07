ALTER TABLE public.smart_capture_settings
  ADD COLUMN IF NOT EXISTS voice_control text NOT NULL DEFAULT 'on',
  ADD COLUMN IF NOT EXISTS horizon_auto_level text NOT NULL DEFAULT 'on';