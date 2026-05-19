
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS showroom_mode text NOT NULL DEFAULT 'off'
    CHECK (showroom_mode IN ('off','main','exterior'));

ALTER TABLE public.vehicle_images
  ADD COLUMN IF NOT EXISTS showroom_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS original_backup_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS showroom_status text NOT NULL DEFAULT 'none'
    CHECK (showroom_status IN ('none','queued','processing','done','failed')),
  ADD COLUMN IF NOT EXISTS showroom_error text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS showroom_generated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_vehicle_images_showroom_status
  ON public.vehicle_images(showroom_status)
  WHERE showroom_status IN ('queued','processing');
