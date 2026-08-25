CREATE POLICY "Admins manage vehicle photos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'vehicle-photos' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'vehicle-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage vehicle models"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'vehicle-models' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'vehicle-models' AND public.has_role(auth.uid(), 'admin'));