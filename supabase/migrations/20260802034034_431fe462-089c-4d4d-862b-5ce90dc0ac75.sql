-- Showroom V3: learned placement database + per-image placement/metadata/validation
CREATE TABLE IF NOT EXISTS public.showroom_model_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL UNIQUE,
  vehicle_class text NOT NULL DEFAULT 'SEDAN',
  scale numeric NOT NULL DEFAULT 0.62,
  offset_x integer NOT NULL DEFAULT 0,
  offset_y integer NOT NULL DEFAULT 0,
  rotation_deg numeric NOT NULL DEFAULT 0,
  shadow_opacity numeric NOT NULL DEFAULT 1,
  shadow_blur numeric NOT NULL DEFAULT 1,
  shadow_offset_y integer NOT NULL DEFAULT 0,
  sample_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.showroom_model_profiles TO authenticated;
GRANT ALL ON public.showroom_model_profiles TO service_role;

ALTER TABLE public.showroom_model_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage showroom model profiles" ON public.showroom_model_profiles;
CREATE POLICY "Admins manage showroom model profiles"
  ON public.showroom_model_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS showroom_model_profiles_updated_at ON public.showroom_model_profiles;
CREATE TRIGGER showroom_model_profiles_updated_at
  BEFORE UPDATE ON public.showroom_model_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vehicle_images
  ADD COLUMN IF NOT EXISTS showroom_placement jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS showroom_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS showroom_validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS showroom_mask_url text NOT NULL DEFAULT '';