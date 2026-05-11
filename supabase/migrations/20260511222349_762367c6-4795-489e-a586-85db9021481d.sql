ALTER TABLE public.tipcars_settings 
  ADD COLUMN IF NOT EXISTS cron_schedule text NOT NULL DEFAULT '0 2 * * *',
  ADD COLUMN IF NOT EXISTS cron_timezone text NOT NULL DEFAULT 'Europe/Prague';

CREATE OR REPLACE FUNCTION public.set_tipcars_cron_schedule(p_schedule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'tipcars-auto-export-daily';
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Cron job tipcars-auto-export-daily not found';
  END IF;
  PERFORM cron.alter_job(job_id := v_job_id, schedule := p_schedule);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_tipcars_cron_schedule(text) TO authenticated;