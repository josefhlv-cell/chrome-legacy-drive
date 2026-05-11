
-- Add TipCars-specific columns to vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS tipcars_karoserie_kod TEXT,
  ADD COLUMN IF NOT EXISTS tipcars_karoserie_popis TEXT,
  ADD COLUMN IF NOT EXISTS tipcars_pocet_mist INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tipcars_pocet_dveri INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tipcars_prvni_majitel BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipcars_servisni_knizka BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipcars_nebourane BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tipcars_stk_do DATE,
  ADD COLUMN IF NOT EXISTS tipcars_export_enabled BOOLEAN DEFAULT true;

-- Settings table for TipCars credentials (singleton row, admin-only)
CREATE TABLE IF NOT EXISTS public.tipcars_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kod_firmy TEXT NOT NULL DEFAULT 'import_1692',
  heslo TEXT NOT NULL DEFAULT '54NFP2tH',
  sftp_host TEXT NOT NULL DEFAULT 'www.ebm.cz',
  sftp_port INTEGER NOT NULL DEFAULT 2222,
  sftp_user TEXT NOT NULL DEFAULT 'import_1692',
  sftp_password TEXT NOT NULL DEFAULT 'mee8aLia9JoozaiBa9oKal',
  firma_nazev TEXT NOT NULL DEFAULT 'Chrysler Pardubice',
  firma_email TEXT DEFAULT 'obchod@chrysler.cz',
  firma_telefon TEXT DEFAULT '+420 603 559 767',
  firma_www TEXT DEFAULT 'www.chryslerpardubice.site',
  firma_mesto TEXT DEFAULT 'Pardubice',
  firma_psc TEXT DEFAULT '530 02',
  firma_ulice TEXT DEFAULT 'Hradecká 1116',
  test_mode BOOLEAN NOT NULL DEFAULT false,
  auto_export_enabled BOOLEAN NOT NULL DEFAULT true,
  last_auto_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipcars_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage tipcars settings" ON public.tipcars_settings;
CREATE POLICY "Admins manage tipcars settings"
  ON public.tipcars_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert single default row if none exists
INSERT INTO public.tipcars_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.tipcars_settings);

DROP TRIGGER IF EXISTS tipcars_settings_updated_at ON public.tipcars_settings;
CREATE TRIGGER tipcars_settings_updated_at
  BEFORE UPDATE ON public.tipcars_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron + pg_net for scheduled auto-export
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing schedule if present
DO $$
BEGIN
  PERFORM cron.unschedule('tipcars-auto-export-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Daily at 03:30 Europe/Prague (~01:30 UTC summer / 02:30 UTC winter — using 02:00 UTC as compromise)
SELECT cron.schedule(
  'tipcars-auto-export-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://thqyzghifwmwohgfvshf.supabase.co/functions/v1/tipcars-auto-export',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocXl6Z2hpZndtd29oZ2Z2c2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODA3NjMsImV4cCI6MjA5MDI1Njc2M30.1f56Tfyz4wEvAoQm22w4ZSLHU_zFuCue308AXaL2TO4'),
    body := '{}'::jsonb
  );
  $$
);
