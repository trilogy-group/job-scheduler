-- 0009_deployment_guard_config.sql
-- One-time config: register the deployment-guard Edge Function URL in
-- private.scheduler_config so the pg_cron job (installed by 0008) can
-- construct the HTTP call at runtime.
--
-- The URL is the standard Supabase Edge Function URL for this project.
-- The scheduler_secret row is assumed to already exist (set up for scheduler-tick).

insert into private.scheduler_config (key, value)
values (
  'deployment_guard_url',
  'https://mteiejqiocldpdaxjmra.supabase.co/functions/v1/deployment-guard'
)
on conflict (key) do update set value = excluded.value;
