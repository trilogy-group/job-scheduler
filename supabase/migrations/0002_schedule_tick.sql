-- 0002_schedule_tick.sql
--
-- Register a pg_cron job that pings scheduler-tick every 30 seconds,
-- passing the shared secret in the X-Scheduler-Secret header. URL and
-- secret live in private.scheduler_config (populated out-of-band at
-- deploy time).

-- Re-runnable: drop any prior schedule of the same name first.
select cron.unschedule('scheduler-tick')
where exists (select 1 from cron.job where jobname = 'scheduler-tick');

select cron.schedule(
  'scheduler-tick',
  '30 seconds',
  $$
    select net.http_post(
      url     := (select value from private.scheduler_config where key = 'scheduler_url'),
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'X-Scheduler-Secret', (select value from private.scheduler_config where key = 'scheduler_secret')
      ),
      body    := '{}'::jsonb
    );
  $$
);
