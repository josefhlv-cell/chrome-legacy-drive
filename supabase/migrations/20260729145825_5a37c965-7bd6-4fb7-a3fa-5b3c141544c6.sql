ALTER TABLE public.smart_capture_settings
  ADD COLUMN IF NOT EXISTS landscape_capture text NOT NULL DEFAULT 'on',
  ADD COLUMN IF NOT EXISTS grid_overlay text NOT NULL DEFAULT 'on';

ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS entry_referrer text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;