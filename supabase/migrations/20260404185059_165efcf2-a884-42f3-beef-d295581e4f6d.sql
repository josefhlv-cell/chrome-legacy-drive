
-- Create api_cache table for sync job state tracking
CREATE TABLE public.api_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_type text NOT NULL DEFAULT '',
  cache_key text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ttl_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (edge functions use service role)
-- Admins can read
CREATE POLICY "Admins can read api_cache"
  ON public.api_cache FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert
CREATE POLICY "Admins can insert api_cache"
  ON public.api_cache FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role bypass RLS by default, but add policy for edge function updates
CREATE POLICY "Service role full access"
  ON public.api_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);
