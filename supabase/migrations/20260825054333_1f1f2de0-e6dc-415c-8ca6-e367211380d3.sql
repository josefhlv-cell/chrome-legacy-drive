-- 1) vehicles: odkaz na vlastní model
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS ar_model_url text,
  ADD COLUMN IF NOT EXISTS ar_model_ready boolean NOT NULL DEFAULT false;

-- 2) appearance profily
CREATE TABLE IF NOT EXISTS public.vehicle_appearance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  body_color_hex text,
  paint_finish text NOT NULL DEFAULT 'metallic',
  clearcoat numeric NOT NULL DEFAULT 1,
  roughness numeric NOT NULL DEFAULT 0.2,
  glass_opacity numeric NOT NULL DEFAULT 0.55,
  trim_style text NOT NULL DEFAULT 'chrome',
  wheel_style text NOT NULL DEFAULT 'default',
  wheel_condition text,
  damages jsonb NOT NULL DEFAULT '[]'::jsonb,
  interior_color_hex text,
  photos jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_appearance_profiles TO authenticated;
GRANT ALL ON public.vehicle_appearance_profiles TO service_role;

ALTER TABLE public.vehicle_appearance_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage appearance profiles"
ON public.vehicle_appearance_profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_vehicle_appearance_profiles_updated_at
BEFORE UPDATE ON public.vehicle_appearance_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();