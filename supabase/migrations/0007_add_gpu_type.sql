-- 0007_add_gpu_type.sql
--
-- Add a `gpu_type` column to the jobs table so the scheduler knows which
-- Fireworks GPU quota bucket a job draws from (training-h200-count,
-- training-b200-count, training-h100-count, ...).
--
-- Rationale: admission previously gated on the AGGREGATE GPU headroom across
-- all training-* quotas. A B200 job could pass that aggregate check (because
-- H200 slots were still free) even though the B200-specific quota was
-- exhausted, so submit() fired and Fireworks returned a 429 quota error
-- AFTER the call. Knowing each job's gpu_type lets the scheduler gate on the
-- per-type available count BEFORE calling submit(). (GitHub #77)
--
-- Backfill: every existing row predates per-type targeting and ran against
-- H200, so default + backfill to 'h200'.

alter table public.jobs
  add column if not exists gpu_type text not null default 'h200';

-- Explicit backfill for any pre-existing rows (default covers new inserts;
-- this is belt-and-suspenders for rows added before the default took effect).
update public.jobs set gpu_type = 'h200' where gpu_type is null;

-- Constrain to the GPU families the scheduler understands.
alter table public.jobs
  drop constraint if exists jobs_gpu_type_check;
alter table public.jobs
  add constraint jobs_gpu_type_check
  check (gpu_type in ('h200', 'b200', 'h100'));
