CREATE TABLE public.watchdog_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  keyword text,
  price_max numeric,
  year_min integer,
  notified_vehicle_ids uuid[] NOT NULL DEFAULT '{}',
  unsubscribe_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.watchdog_subscriptions TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.watchdog_subscriptions TO authenticated;
GRANT ALL ON public.watchdog_subscriptions TO service_role;

ALTER TABLE public.watchdog_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to watchdog"
  ON public.watchdog_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view watchdog subscriptions"
  ON public.watchdog_subscriptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update watchdog subscriptions"
  ON public.watchdog_subscriptions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete watchdog subscriptions"
  ON public.watchdog_subscriptions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_contacts (key, value)
VALUES
  ('feature_watchdog_enabled', 'true'),
  ('feature_live_chat_enabled', 'true'),
  ('feature_vehicle_compare_enabled', 'true')
ON CONFLICT DO NOTHING;

SELECT cron.schedule(
  'watchdog-check-new-vehicles',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://thqyzghifwmwohgfvshf.supabase.co/functions/v1/watchdog-check-new-vehicles',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocXl6Z2hpZndtd29oZ2Z2c2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODA3NjMsImV4cCI6MjA5MDI1Njc2M30.1f56Tfyz4wEvAoQm22w4ZSLHU_zFuCue308AXaL2TO4'),
    body := '{}'::jsonb
  );
  $$
);