-- Enum for portals
DO $$ BEGIN
  CREATE TYPE public.export_portal AS ENUM ('tipcars', 'sauto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.export_status AS ENUM ('pending', 'online', 'error', 'removed', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-vehicle, per-portal export state
CREATE TABLE IF NOT EXISTS public.vehicle_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  portal public.export_portal NOT NULL,
  external_id text NOT NULL DEFAULT '',
  status public.export_status NOT NULL DEFAULT 'pending',
  last_export_at timestamptz,
  last_success_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  payload_hash text NOT NULL DEFAULT '',
  attempts int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, portal)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_exports_portal_status ON public.vehicle_exports(portal, status);
CREATE INDEX IF NOT EXISTS idx_vehicle_exports_vehicle ON public.vehicle_exports(vehicle_id);

ALTER TABLE public.vehicle_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vehicle_exports"
  ON public.vehicle_exports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access vehicle_exports"
  ON public.vehicle_exports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_vehicle_exports_updated
  BEFORE UPDATE ON public.vehicle_exports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Logs
CREATE TABLE IF NOT EXISTS public.export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  portal public.export_portal,
  operation text NOT NULL DEFAULT 'export',
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL DEFAULT '',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_logs_created ON public.export_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_logs_vehicle ON public.export_logs(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_logs_portal_level ON public.export_logs(portal, level, created_at DESC);

ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read export_logs"
  ON public.export_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert export_logs"
  ON public.export_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access export_logs"
  ON public.export_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);