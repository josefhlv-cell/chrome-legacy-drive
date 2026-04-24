-- Marketing banners table
CREATE TABLE public.marketing_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  content_type TEXT NOT NULL DEFAULT 'image' CHECK (content_type IN ('image','video')),
  media_url TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  subheadline TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT '',
  target_page TEXT NOT NULL DEFAULT 'home',
  target_position TEXT NOT NULL DEFAULT 'hero',
  layout_variant TEXT NOT NULL DEFAULT 'hero' CHECK (layout_variant IN ('hero','box','sticky')),
  show_desktop BOOLEAN NOT NULL DEFAULT true,
  show_tablet BOOLEAN NOT NULL DEFAULT true,
  show_mobile BOOLEAN NOT NULL DEFAULT true,
  styles JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  impression_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_banners_active ON public.marketing_banners(is_active, target_page, target_position);

ALTER TABLE public.marketing_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active banners are publicly readable"
ON public.marketing_banners FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can read all banners"
ON public.marketing_banners FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert banners"
ON public.marketing_banners FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update banners"
ON public.marketing_banners FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete banners"
ON public.marketing_banners FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public RPC functions to bump analytics counters (no auth required)
CREATE OR REPLACE FUNCTION public.increment_banner_impression(_banner_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marketing_banners SET impression_count = impression_count + 1 WHERE id = _banner_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_banner_click(_banner_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marketing_banners SET click_count = click_count + 1 WHERE id = _banner_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_banner_impression(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_banner_click(UUID) TO anon, authenticated;

-- Updated_at trigger
CREATE TRIGGER trg_marketing_banners_updated_at
BEFORE UPDATE ON public.marketing_banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for banner media
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Banner media publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

CREATE POLICY "Admins can upload banner media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banners' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update banner media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'banners' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete banner media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'banners' AND has_role(auth.uid(), 'admin'::app_role));