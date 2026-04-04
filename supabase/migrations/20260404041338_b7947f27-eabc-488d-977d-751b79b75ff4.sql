
DROP POLICY "Anyone can insert scrape logs" ON public.scrape_log;
DROP POLICY "Anyone can update scrape logs" ON public.scrape_log;

CREATE POLICY "Admins can insert scrape logs"
  ON public.scrape_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update scrape logs"
  ON public.scrape_log FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
