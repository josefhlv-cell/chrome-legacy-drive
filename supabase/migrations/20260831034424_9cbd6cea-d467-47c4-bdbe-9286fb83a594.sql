ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS model_3d_glb TEXT,
  ADD COLUMN IF NOT EXISTS model_3d_usdz TEXT;