-- 0005_scheduler_ticks.sql
--
-- (1) scheduler_ticks: per-tick GPU utilisation history for the dashboard
--     spark-line and scheduler health metrics.
-- (2) public.jobs_enriched: normalised view over public.jobs that extracts
--     kind-aware JSONB fields so callers don't need to know the per-kind
--     payload shape.

-- ---------------------------------------------------------------------------
-- 1.  scheduler_ticks
-- ---------------------------------------------------------------------------

create table if not exists public.scheduler_ticks (
  id          bigint generated always as identity primary key,
  ticked_at   timestamptz not null default now(),
  active_gpu_count   int not null default 0,
  queued_count       int not null default 0,
  in_progress_count  int not null default 0
);

-- Keep only the last ~2 days of tick rows (30s cadence ≈ 5 760 rows/day).
-- Older rows are pruned by the scheduler on every tick via:
--   DELETE FROM scheduler_ticks WHERE ticked_at < now() - interval '2 days';
-- The index accelerates both that DELETE and time-range queries.
create index if not exists scheduler_ticks_ticked_at_idx
  on public.scheduler_ticks (ticked_at desc);

-- ---------------------------------------------------------------------------
-- 2.  jobs_enriched view
-- ---------------------------------------------------------------------------
-- Exposes every column from public.jobs plus four normalised derived columns:
--
--   base_model      – the starting-point model for fine-tuning
--                     Paths tried (first non-null wins):
--                       fireworks_payload -> 'trainingConfig' ->> 'warmStartFrom'
--                       fireworks_payload ->> 'base_model'
--
--   output_model    – the resulting fine-tuned model artefact
--                     Paths tried:
--                       fireworks_payload ->> 'outputModel'
--                       fireworks_payload ->> 'model'
--
--   dataset         – training dataset reference (kind-aware)
--                     DPO: fireworks_payload ->> 'preferenceDataset'  (then 'dataset')
--                     SFT/RFT: fireworks_payload ->> 'dataset'
--
--   failure_class   – coarse bucket of the error (text before first ": ")
--                     NULL when error IS NULL.

create or replace view public.jobs_enriched as
select
  j.*,

  -- base_model: nested trainingConfig path first, flat fallback second
  coalesce(
    j.fireworks_payload -> 'trainingConfig' ->> 'warmStartFrom',
    j.fireworks_payload ->> 'base_model'
  ) as base_model,

  -- output_model: camelCase Fireworks field first, flat 'model' fallback
  coalesce(
    j.fireworks_payload ->> 'outputModel',
    j.fireworks_payload ->> 'model'
  ) as output_model,

  -- dataset: DPO uses preferenceDataset; SFT/RFT use dataset
  case
    when j.kind = 'DPO' then coalesce(
      j.fireworks_payload ->> 'preferenceDataset',
      j.fireworks_payload ->> 'dataset'
    )
    else j.fireworks_payload ->> 'dataset'
  end as dataset,

  -- failure_class: prefix of the error string up to the first ": "
  case
    when j.error is null then null
    when position(': ' in j.error) > 0
      then left(j.error, position(': ' in j.error) - 1)
    else j.error
  end as failure_class

from public.jobs j;
