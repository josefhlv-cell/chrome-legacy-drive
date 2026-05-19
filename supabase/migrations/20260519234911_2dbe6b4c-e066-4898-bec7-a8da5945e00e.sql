ALTER TABLE public.vehicle_images
  ADD COLUMN IF NOT EXISTS showroom_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS showroom_thumb_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS showroom_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS showroom_applied_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_vehicle_images_showroom_status
  ON public.vehicle_images (showroom_status);

CREATE INDEX IF NOT EXISTS idx_vehicle_images_showroom_vehicle
  ON public.vehicle_images (vehicle_id, is_main, sort_order);