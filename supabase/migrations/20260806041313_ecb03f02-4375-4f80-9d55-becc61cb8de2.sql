ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS visitor_id text,
  ADD COLUMN IF NOT EXISTS is_new_visitor boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS page_views_visitor_id_idx ON public.page_views (visitor_id);

CREATE TABLE IF NOT EXISTS public.phone_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL CHECK (char_length(session_id) <= 64),
  visitor_id text CHECK (char_length(visitor_id) <= 64),
  is_new_visitor boolean NOT NULL DEFAULT false,
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 32),
  path text NOT NULL DEFAULT '' CHECK (char_length(path) <= 256),
  source text NOT NULL DEFAULT '' CHECK (char_length(source) <= 64),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.phone_clicks TO anon, authenticated;
GRANT SELECT ON public.phone_clicks TO authenticated;
GRANT ALL ON public.phone_clicks TO service_role;

ALTER TABLE public.phone_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert phone clicks"
  ON public.phone_clicks FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(session_id) BETWEEN 8 AND 64);

CREATE POLICY "Admins can read phone clicks"
  ON public.phone_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS phone_clicks_created_at_idx ON public.phone_clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS phone_clicks_visitor_id_idx ON public.phone_clicks (visitor_id);