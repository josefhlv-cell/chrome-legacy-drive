create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('showroom-auto-refresh') where exists (select 1 from cron.job where jobname = 'showroom-auto-refresh');

select cron.schedule(
  'showroom-auto-refresh',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://thqyzghifwmwohgfvshf.supabase.co/functions/v1/showroom-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-showroom-cron', '3f3d93f26b06bb432f7c0fbc74a11b6d9414658ccd3f7ecf'
    ),
    body := jsonb_build_object('mode', 'stale', 'limit', 2)
  );
  $$
);