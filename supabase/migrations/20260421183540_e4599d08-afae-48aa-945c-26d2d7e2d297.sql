-- Fix privilege escalation: replace permissive ALL policy with explicit per-command policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add missing UPDATE policy on vehicles storage bucket (only admins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='storage' AND tablename='objects' 
    AND policyname='Admins can update vehicle images'
  ) THEN
    CREATE POLICY "Admins can update vehicle images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'vehicles' AND public.has_role(auth.uid(), 'admin'))
    WITH CHECK (bucket_id = 'vehicles' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;