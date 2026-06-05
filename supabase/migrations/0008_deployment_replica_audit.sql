-- 0008_deployment_replica_audit.sql
-- Audit log for the deployment-guard cron: every time it resets a
-- deployment's min_replica_count from > 0 back to 0, it writes a row here.

create table if not exists public.deployment_replica_audit (
  id               uuid        primary key default gen_random_uuid(),
  checked_at       timestamptz not null default now(),
  deployment_name  text        not null,   -- full resource name, e.g. accounts/trilogy/deployments/abc123
  old_min          int         not null,   -- min_replica_count before reset
  new_min          int         not null default 0,  -- always 0 after reset
  max_replica_count int        not null,   -- max left untouched
  state            text        not null    -- deployment state at time of correction
);

create index if not exists deployment_replica_audit_checked_at_idx
  on public.deployment_replica_audit (checked_at desc);

-- ────────────────────────────────────────────────────────────────────
-- Schedule the deployment-guard Edge Function every 30 minutes via pg_cron.
--
-- This mirrors the scheduler-tick schedule in 0002_schedule_tick.sql: the
-- target URL and the shared secret live in private.scheduler_config (a
-- key/value table populated out-of-band at deploy time), and the cron job
-- pings the Edge Function with net.http_post, passing the secret in the
-- X-Scheduler-Secret header (which the function verifies against its
-- SCHEDULER_SECRET env var).
--
-- OPERATOR SETUP (run once, out-of-band, after deploying the function):
--   insert into private.scheduler_config (key, value)
--   values ('deployment_guard_url',
--           'https://<project-ref>.supabase.co/functions/v1/deployment-guard')
--   on conflict (key) do update set value = excluded.value;
-- The 'scheduler_secret' row is reused from the scheduler-tick setup.
-- ────────────────────────────────────────────────────────────────────

-- Re-runnable: drop any prior schedule of the same name first.
select cron.unschedule('deployment-guard-30m')
where exists (select 1 from cron.job where jobname = 'deployment-guard-30m');

select cron.schedule(
  'deployment-guard-30m',
  '*/30 * * * *',
  $$
    select net.http_post(
      url     := (select value from private.scheduler_config where key = 'deployment_guard_url'),
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'X-Scheduler-Secret', (select value from private.scheduler_config where key = 'scheduler_secret')
      ),
      body    := '{}'::jsonb
    );
  $$
);
