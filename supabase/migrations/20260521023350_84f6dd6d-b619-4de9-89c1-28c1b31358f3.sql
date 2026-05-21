
-- AI Smart Price Check + Mára features
CREATE TABLE public.ai_price_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid,
  vin text NOT NULL DEFAULT '',
  make text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  year integer,
  mileage integer,
  listed_price integer,
  sold_price integer,
  days_to_sell integer,
  contacts_count integer NOT NULL DEFAULT 0,
  ctr numeric,
  gallery_score integer,
  showroom_mode boolean NOT NULL DEFAULT false,
  sold_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_price_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ai_price_memory" ON public.ai_price_memory FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.ai_price_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid,
  vin text NOT NULL DEFAULT '',
  recommended integer,
  market_avg integer,
  market_low integer,
  market_high integer,
  sell_speed text NOT NULL DEFAULT 'medium',
  confidence integer NOT NULL DEFAULT 0,
  reasons_up jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasons_down jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_price_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ai_price_suggestions" ON public.ai_price_suggestions FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.weekly_hit_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL DEFAULT (date_trunc('week', now())::date),
  title text NOT NULL DEFAULT '',
  lyrics text NOT NULL DEFAULT '',
  vibe text NOT NULL DEFAULT 'chinaski',
  is_special boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_hit_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage weekly_hit_songs" ON public.weekly_hit_songs FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_welcome_seen (
  user_id uuid PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_welcome_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage own welcome flag" ON public.admin_welcome_seen FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
