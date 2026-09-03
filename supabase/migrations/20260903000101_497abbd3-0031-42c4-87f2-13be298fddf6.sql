ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS ar_model_dimensions jsonb,
  ADD COLUMN IF NOT EXISTS ar_model_config jsonb;