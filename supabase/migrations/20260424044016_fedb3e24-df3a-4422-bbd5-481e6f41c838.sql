
ALTER TABLE public.marketing_banners
  ADD COLUMN IF NOT EXISTS style_preset text NOT NULL DEFAULT 'hero',
  ADD COLUMN IF NOT EXISTS content_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS link_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS position_matrix jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_marketing_banners_page_position_active
  ON public.marketing_banners (target_page, target_position, is_active);
