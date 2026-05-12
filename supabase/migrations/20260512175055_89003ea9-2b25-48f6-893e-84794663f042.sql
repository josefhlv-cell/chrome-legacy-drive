ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS tipcars_znacka_kod text DEFAULT 'AW',
  ADD COLUMN IF NOT EXISTS tipcars_model_kod text DEFAULT 'AWM',
  ADD COLUMN IF NOT EXISTS tipcars_emisni_norma text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipcars_pohon text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipcars_prevodovka_pocet integer,
  ADD COLUMN IF NOT EXISTS tipcars_garantovany_najezd boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS tipcars_klimatizace text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipcars_airbagy integer;