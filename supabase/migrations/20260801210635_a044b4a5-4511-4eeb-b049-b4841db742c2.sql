CREATE TABLE IF NOT EXISTS public.job_tokens (
  name TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.job_tokens TO service_role;
ALTER TABLE public.job_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.job_tokens (name, token) VALUES ('showroom_batch', '18ea874621fdd3efbc94eb593676e23191d11b6d62ab6e4d')
ON CONFLICT (name) DO UPDATE SET token = EXCLUDED.token;