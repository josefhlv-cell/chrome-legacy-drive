ALTER TABLE public.tipcars_settings
ADD COLUMN IF NOT EXISTS test_mode_locked boolean NOT NULL DEFAULT true;