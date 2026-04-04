
-- Site contacts (editable from admin)
CREATE TABLE public.site_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site contacts are publicly readable"
  ON public.site_contacts FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage site contacts"
  ON public.site_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default contacts
INSERT INTO public.site_contacts (key, value) VALUES
  ('phone', '+420 603 559 767'),
  ('email', 'obchod@chrysler.cz'),
  ('address', 'Lukovna 11, 533 04 Sezemice u Pardubic'),
  ('hours_weekday', 'Po–Pá: 8:00 – 17:00'),
  ('hours_weekend', 'So–Ne: Pouze po domluvě');

-- Ticker items (editable from admin)
CREATE TABLE public.ticker_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticker_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticker items are publicly readable"
  ON public.ticker_items FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage ticker items"
  ON public.ticker_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default ticker items
INSERT INTO public.ticker_items (text, sort_order) VALUES
  ('Nově na skladě: Chrysler Pacifica Hybrid (dovoz Florida)', 0),
  ('Na cestě: 2x Chrysler Grand Caravan z USA', 1),
  ('Prodáno: Dodge Challenger GT AWD (klient Praha)', 2),
  ('Nově na skladě: Chrysler Town - Country 3.6 LPG', 3),
  ('Rezervováno: Chrysler Pacifica Limited (klient Olomouc)', 4);

-- Facility photos (editable from admin)
CREATE TABLE public.facility_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  alt_text text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.facility_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility photos are publicly readable"
  ON public.facility_photos FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage facility photos"
  ON public.facility_photos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Scrape log for tracking scraping runs
CREATE TABLE public.scrape_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  vehicles_found integer DEFAULT 0,
  vehicles_updated integer DEFAULT 0,
  images_downloaded integer DEFAULT 0,
  error_message text,
  triggered_by text DEFAULT 'manual'
);
ALTER TABLE public.scrape_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read scrape logs"
  ON public.scrape_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert scrape logs"
  ON public.scrape_log FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update scrape logs"
  ON public.scrape_log FOR UPDATE TO public
  USING (true);
