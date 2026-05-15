-- 0005_scheduler_ticks.sql
-- (1) Historical tick snapshots for GPU-utilisation time-series panels.
--     One row per scheduler-tick invocation. Append-only; ~2880 rows/day.
-- (2) jobs_enriched view: kind-aware JSONB extraction of base_model,
--     output_model, dataset, failure_class for dashboard queries.

-- ────────────────────────────────────────────────────────────────────
-- TABLE: public.scheduler_ticks
-- ────────────────────────────────────────────────────────────────────
create table if not exists public.scheduler_ticks (
  id             uuid        primary key default gen_random_uuid(),
  tick_at        timestamptz not null default now(),
  fw_available   int         not null,   -- GPU slots free on Fireworks at tick time
  fw_total_cap   int         not null,   -- total quota (fw_available + in-use)
  big_jobs_active int        not null,   -- PROGRESS jobs with gpu_count >= 8
  queued_remaining int       not null,   -- QUEUED jobs waiting at tick end
  admitted       int         not null,   -- jobs admitted in this tick
  by_kind        jsonb       not null default '{}'::jsonb  -- admitted per kind
);

create index if not exists scheduler_ticks_tick_at_idx
  on public.scheduler_ticks (tick_at desc);

-- ────────────────────────────────────────────────────────────────────
-- VIEW: public.jobs_enriched
-- Exposes kind-aware JSONB fields alongside all base job columns.
-- ────────────────────────────────────────────────────────────────────
create or replace view public.jobs_enriched as
select
  j.id,
  j.user_id,
  j.kind,
  j.state,
  j.display_name,
  j.gpu_count,
  j.fireworks_job_name,
  j.error,
  j.created_at,
  j.started_at,
  j.completed_at,
  -- base_model: the model being fine-tuned (kind-aware)
  case j.kind
    when 'SFT' then j.fireworks_payload->>'baseModel'
    when 'DPO' then j.fireworks_payload->'trainingConfig'->>'warmStartFrom'
    when 'RFT' then j.fireworks_payload->'trainingConfig'->>'baseModel'
    else null
  end as base_model,
  -- output_model: the artifact produced (kind-aware)
  case j.kind
    when 'SFT' then j.fireworks_payload->>'outputModel'
    when 'DPO' then j.fireworks_payload->'trainingConfig'->>'outputModel'
    when 'RFT' then j.fireworks_payload->'trainingConfig'->>'outputModel'
    else null
  end as output_model,
  -- dataset: top-level for all kinds
  j.fireworks_payload->>'dataset' as dataset,
  -- failure_class: parse prefix of error text (NULL for non-FAIL rows)
  case
    when j.state <> 'FAIL' then null
    when j.error like 'Fireworks 4%' then 'client_error'
    when j.error like 'Fireworks 5%' then 'server_error'
    when j.error like 'cancelled externally%' then 'external_cancel'
    when j.error is not null then 'other'
    else null
  end as failure_class,
  -- raw payload for pass-through access
  j.fireworks_payload
from public.jobs j;
