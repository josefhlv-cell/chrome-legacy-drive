CREATE TABLE public.tour_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text NOT NULL,
  visitor_id text,
  is_new_visitor boolean,
  event text NOT NULL,
  step text,
  color text,
  meta jsonb,
  path text
);

CREATE INDEX tour_events_created_at_idx ON public.tour_events (created_at DESC);
CREATE INDEX tour_events_event_idx ON public.tour_events (event);

GRANT INSERT ON public.tour_events TO anon;
GRANT INSERT, SELECT ON public.tour_events TO authenticated;
GRANT ALL ON public.tour_events TO service_role;

ALTER TABLE public.tour_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log tour events"
  ON public.tour_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read tour events"
  ON public.tour_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));