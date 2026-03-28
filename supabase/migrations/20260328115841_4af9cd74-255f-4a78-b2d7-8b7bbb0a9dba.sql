INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicles', 'vehicles', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for vehicle images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vehicles');

CREATE POLICY "Admins can upload vehicle images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vehicles' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete vehicle images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vehicles' AND public.has_role(auth.uid(), 'admin'));