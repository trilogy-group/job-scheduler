-- ===========================================================================
-- LOCAL DEV ONLY. THIS FILE MUST NEVER BE APPLIED TO PRODUCTION.
-- The dashboard fixtures defined here are 5 synthetic users (alice/bob/carol/
-- dave/eve) and 30 synthetic jobs. They will pollute the prod jobs/users
-- tables if pushed. On 2026-05-15 this file leaked into prod via
-- `supabase db push --linked --include-seed` against the prod project ref.
-- Cleanup transaction is logged in drafts/prod-cleanup-full-backup.sql.
-- ===========================================================================
DO $$ BEGIN
  IF inet_server_addr() IS NOT NULL AND
     NOT (
       inet_server_addr() <<= '127.0.0.0/8'::inet OR
       inet_server_addr() <<= '10.0.0.0/8'::inet OR
       inet_server_addr() <<= '172.16.0.0/12'::inet OR
       inet_server_addr() <<= '192.168.0.0/16'::inet OR
       inet_server_addr() = '::1'::inet
     ) THEN
    RAISE EXCEPTION 'seed.sql attempted on non-local host (%). Refusing. This file is LOCAL DEV ONLY.',
      inet_server_addr()::text;
  END IF;
END $$;
-- supabase/seed.sql
-- ────────────────────────────────────────────────────────────────────
-- Canonical local seed for the job-scheduler dashboard test fixtures.
-- Applied automatically by `supabase db reset` (see supabase/config.toml).
--
-- Goals:
--   * 5 synthetic users with deterministic UUIDs
--   * ≥30 jobs spanning every state (QUEUED/PROGRESS/SUCCESS/FAIL/CANCELLED)
--   * ≥2 FIFO violation pairs (B.created_at > A.created_at but B.started_at < A.started_at)
--   * GPU-quota-pressure scenario (PROGRESS jobs sum well into the 8-GPU window)
--   * Multi-day spread (jobs span ~14 days back)
--   * Varied error strings so failure_class buckets populate
--   * All three kinds (SFT, DPO, RFT) represented
--   * 100% synthetic data — no real keys, emails, or prod model names
--
-- The file is idempotent: every insert uses ON CONFLICT DO NOTHING with
-- fixed UUIDs so re-running `supabase db reset` (or invoking this file
-- manually) is safe and stable.
-- ────────────────────────────────────────────────────────────────────

-- Silence the scheduler-tick cron locally (prevents noisy pg_net errors
-- when no Edge Function is running).
select cron.unschedule('scheduler-tick')
  where exists (select 1 from cron.job where jobname = 'scheduler-tick');

-- Stub the private config schema so anything that references it doesn't
-- crash when the seed is replayed on a fresh database.
create schema if not exists private;
create table if not exists private.scheduler_config (
  key   text primary key,
  value text
);

-- ────────────────────────────────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────────────────────────────────
insert into public.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice.chen@trilogy.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob.garcia@trilogy.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol.smith@trilogy.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave.jones@trilogy.com'),
  ('55555555-5555-5555-5555-555555555555', 'eve.taylor@trilogy.com')
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────
-- JOBS
-- UUID prefix convention:
--   a000000x → alice, b000000x → bob, c000000x → carol,
--   d000000x → dave,  e000000x → eve
-- ────────────────────────────────────────────────────────────────────

-- ── SUCCESS (8) ────────────────────────────────────────────────────
-- Alice FIFO-violation pair (created_at order: A older, B newer; but
-- B.started_at < A.started_at → fairness violation).
insert into public.jobs (
  id, user_id, kind, state, display_name, gpu_count,
  fireworks_payload, fireworks_job_name, error,
  created_at, started_at, completed_at
) values
  ('a0000001-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'SFT', 'SUCCESS', 'alice-shakespeare-sft-rev1', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-shakespeare-v3","outputModel":"accounts/trilogy/models/qwen3-14b-shakespeare-r1","epochs":3,"learningRate":0.0001}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-alice-001', null,
   now() - interval '2 hours',
   now() - interval '80 minutes',
   now() - interval '30 minutes'),
  ('a0000002-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   'SFT', 'SUCCESS', 'alice-shakespeare-sft-rev2', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-shakespeare-v3","outputModel":"accounts/trilogy/models/qwen3-14b-shakespeare-r2","epochs":3,"learningRate":0.0001}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-alice-002', null,
   now() - interval '90 minutes',
   now() - interval '85 minutes',
   now() - interval '40 minutes'),

-- Bob FIFO-violation pair (multi-day-old).
  ('b0000001-0000-0000-0000-000000000003',
   '22222222-2222-2222-2222-222222222222',
   'DPO', 'SUCCESS', 'bob-preferences-dpo-rev1', 4,
   '{"dataset":"accounts/trilogy/datasets/dpo-preferences-v1","trainingConfig":{"warmStartFrom":"accounts/trilogy/models/qwen3-14b-shakespeare-r1","outputModel":"accounts/trilogy/models/qwen3-14b-dpo-aligned-r1","epochs":2,"learningRate":0.00005},"lossConfig":{"method":"DPO","beta":0.1}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-bob-001', null,
   now() - interval '5 days',
   now() - interval '4 days 20 hours',
   now() - interval '4 days 12 hours'),
  ('b0000002-0000-0000-0000-000000000004',
   '22222222-2222-2222-2222-222222222222',
   'DPO', 'SUCCESS', 'bob-preferences-dpo-rev2', 4,
   '{"dataset":"accounts/trilogy/datasets/dpo-preferences-v1","trainingConfig":{"warmStartFrom":"accounts/trilogy/models/qwen3-14b-shakespeare-r1","outputModel":"accounts/trilogy/models/qwen3-14b-dpo-aligned-r2","epochs":2,"learningRate":0.00005},"lossConfig":{"method":"DPO","beta":0.1}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-bob-002', null,
   now() - interval '4 days 22 hours',
   now() - interval '4 days 21 hours',
   now() - interval '4 days 15 hours'),

-- Remaining SUCCESS rows — varied users + kinds, multi-day spread.
  ('c0000001-0000-0000-0000-000000000005',
   '33333333-3333-3333-3333-333333333333',
   'RFT', 'SUCCESS', 'carol-math-grpo-r1', 4,
   '{"dataset":"accounts/trilogy/datasets/rft-math-v2","evaluator":"accounts/trilogy/evaluators/math-correctness","trainingConfig":{"baseModel":"accounts/fireworks/models/llama-3-8b-instruct","outputModel":"accounts/trilogy/models/llama-3-8b-grpo-math-r1","epochs":1,"learningRate":0.00003},"lossConfig":{"method":"GRPO"}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-carol-001', null,
   now() - interval '7 days',
   now() - interval '6 days 22 hours',
   now() - interval '6 days 10 hours'),
  ('d0000001-0000-0000-0000-000000000006',
   '44444444-4444-4444-4444-444444444444',
   'SFT', 'SUCCESS', 'dave-summarizer-sft-big', 8,
   '{"baseModel":"accounts/fireworks/models/qwen3-32b","dataset":"accounts/trilogy/datasets/sft-summarizer-v4","outputModel":"accounts/trilogy/models/qwen3-32b-summarizer-r1","epochs":2,"learningRate":0.00008}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-dave-001', null,
   now() - interval '10 days',
   now() - interval '9 days 23 hours',
   now() - interval '9 days 6 hours'),
  ('e0000001-0000-0000-0000-000000000007',
   '55555555-5555-5555-5555-555555555555',
   'DPO', 'SUCCESS', 'eve-tone-dpo-r1', 4,
   '{"dataset":"accounts/trilogy/datasets/dpo-tone-v2","trainingConfig":{"warmStartFrom":"accounts/trilogy/models/qwen3-14b-tone-base","outputModel":"accounts/trilogy/models/qwen3-14b-tone-dpo-r1","epochs":2,"learningRate":0.00005},"lossConfig":{"method":"DPO","beta":0.15}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-eve-001', null,
   now() - interval '3 days',
   now() - interval '2 days 23 hours',
   now() - interval '2 days 12 hours'),
  ('a0000003-0000-0000-0000-000000000008',
   '11111111-1111-1111-1111-111111111111',
   'RFT', 'SUCCESS', 'alice-reasoning-grpo-r1', 4,
   '{"dataset":"accounts/trilogy/datasets/rft-reasoning-v1","evaluator":"accounts/trilogy/evaluators/reasoning-judge","trainingConfig":{"baseModel":"accounts/fireworks/models/llama-3-8b-instruct","outputModel":"accounts/trilogy/models/llama-3-8b-reasoning-r1","epochs":1,"learningRate":0.00003},"lossConfig":{"method":"GRPO"}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-alice-003', null,
   now() - interval '12 days',
   now() - interval '11 days 22 hours',
   now() - interval '11 days 14 hours')
on conflict (id) do nothing;

-- ── FAIL (6) — populate every failure_class bucket ────────────────
insert into public.jobs (
  id, user_id, kind, state, display_name, gpu_count,
  fireworks_payload, fireworks_job_name, error,
  created_at, started_at, completed_at
) values
  ('a0000004-0000-0000-0000-000000000009',
   '11111111-1111-1111-1111-111111111111',
   'SFT', 'FAIL', 'alice-bad-payload', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-broken-schema","outputModel":"accounts/trilogy/models/qwen3-14b-broken","epochs":3,"learningRate":0.0001}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-alice-004',
   'Fireworks 400 Bad Request: invalid dataset schema (missing prompt field)',
   now() - interval '6 days',
   now() - interval '5 days 23 hours',
   now() - interval '5 days 22 hours'),
  ('b0000003-0000-0000-0000-000000000010',
   '22222222-2222-2222-2222-222222222222',
   'SFT', 'FAIL', 'bob-flaky-upstream', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-customer-tickets","outputModel":"accounts/trilogy/models/qwen3-14b-tickets","epochs":3,"learningRate":0.0001}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-bob-003',
   'Fireworks 503 Service Unavailable: upstream timeout after 30s',
   now() - interval '4 days',
   now() - interval '3 days 22 hours',
   now() - interval '3 days 18 hours'),
  ('c0000002-0000-0000-0000-000000000011',
   '33333333-3333-3333-3333-333333333333',
   'DPO', 'FAIL', 'carol-killed-job', 4,
   '{"dataset":"accounts/trilogy/datasets/dpo-policy-v1","trainingConfig":{"warmStartFrom":"accounts/trilogy/models/qwen3-14b-policy-base","outputModel":"accounts/trilogy/models/qwen3-14b-policy-dpo","epochs":2,"learningRate":0.00005},"lossConfig":{"method":"DPO","beta":0.1}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-carol-002',
   'cancelled externally by operator: shutting down for capacity rebalance',
   now() - interval '5 days',
   now() - interval '4 days 22 hours',
   now() - interval '4 days 20 hours'),
  ('d0000002-0000-0000-0000-000000000012',
   '44444444-4444-4444-4444-444444444444',
   'RFT', 'FAIL', 'dave-quota-bust', 4,
   '{"dataset":"accounts/trilogy/datasets/rft-code-v1","evaluator":"accounts/trilogy/evaluators/code-tests","trainingConfig":{"baseModel":"accounts/fireworks/models/llama-3-8b-instruct","outputModel":"accounts/trilogy/models/llama-3-8b-code-grpo","epochs":1,"learningRate":0.00003},"lossConfig":{"method":"GRPO"}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-dave-002',
   'quota exceeded: tenant monthly RFT budget consumed (other-class)',
   now() - interval '2 days',
   now() - interval '1 day 22 hours',
   now() - interval '1 day 21 hours'),
  ('e0000002-0000-0000-0000-000000000013',
   '55555555-5555-5555-5555-555555555555',
   'SFT', 'FAIL', 'eve-rate-limited', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-rag-snippets","outputModel":"accounts/trilogy/models/qwen3-14b-rag","epochs":3,"learningRate":0.0001}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-eve-002',
   'Fireworks 429 Too Many Requests: per-tenant submission rate cap',
   now() - interval '8 days',
   now() - interval '7 days 23 hours',
   now() - interval '7 days 22 hours'),
  ('b0000004-0000-0000-0000-000000000014',
   '22222222-2222-2222-2222-222222222222',
   'RFT', 'FAIL', 'bob-server-crash', 4,
   '{"dataset":"accounts/trilogy/datasets/rft-search-v1","evaluator":"accounts/trilogy/evaluators/search-judge","trainingConfig":{"baseModel":"accounts/fireworks/models/llama-3-8b-instruct","outputModel":"accounts/trilogy/models/llama-3-8b-search-grpo","epochs":1,"learningRate":0.00003},"lossConfig":{"method":"GRPO"}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-bob-004',
   'Fireworks 500 Internal Server Error: trainer pod OOM-killed',
   now() - interval '11 days',
   now() - interval '10 days 22 hours',
   now() - interval '10 days 18 hours')
on conflict (id) do nothing;

-- ── CANCELLED (4) ──────────────────────────────────────────────────
insert into public.jobs (
  id, user_id, kind, state, display_name, gpu_count,
  fireworks_payload, fireworks_job_name, error,
  created_at, started_at, completed_at
) values
  ('a0000005-0000-0000-0000-000000000015',
   '11111111-1111-1111-1111-111111111111',
   'SFT', 'CANCELLED', 'alice-aborted-experiment', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-experiment-v9","outputModel":"accounts/trilogy/models/qwen3-14b-experiment","epochs":3,"learningRate":0.0001}'::jsonb,
   null, null,
   now() - interval '1 day',
   null,
   now() - interval '23 hours'),
  ('c0000003-0000-0000-0000-000000000016',
   '33333333-3333-3333-3333-333333333333',
   'DPO', 'CANCELLED', 'carol-superseded', 4,
   '{"dataset":"accounts/trilogy/datasets/dpo-policy-v0","trainingConfig":{"warmStartFrom":"accounts/trilogy/models/qwen3-14b-policy-base","outputModel":"accounts/trilogy/models/qwen3-14b-policy-old","epochs":2,"learningRate":0.00005},"lossConfig":{"method":"DPO","beta":0.1}}'::jsonb,
   null, null,
   now() - interval '9 days',
   null,
   now() - interval '8 days 23 hours'),
  ('d0000003-0000-0000-0000-000000000017',
   '44444444-4444-4444-4444-444444444444',
   'SFT', 'CANCELLED', 'dave-wrong-dataset', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-wrong-source","outputModel":"accounts/trilogy/models/qwen3-14b-wrong","epochs":3,"learningRate":0.0001}'::jsonb,
   null, null,
   now() - interval '13 days',
   null,
   now() - interval '12 days 23 hours'),
  ('e0000003-0000-0000-0000-000000000018',
   '55555555-5555-5555-5555-555555555555',
   'RFT', 'CANCELLED', 'eve-rollback', 4,
   '{"dataset":"accounts/trilogy/datasets/rft-tone-v0","evaluator":"accounts/trilogy/evaluators/tone-judge","trainingConfig":{"baseModel":"accounts/fireworks/models/llama-3-8b-instruct","outputModel":"accounts/trilogy/models/llama-3-8b-tone-grpo-old","epochs":1,"learningRate":0.00003},"lossConfig":{"method":"GRPO"}}'::jsonb,
   null, null,
   now() - interval '6 days',
   null,
   now() - interval '5 days 23 hours')
on conflict (id) do nothing;

-- ── QUEUED (7) — queue depth for alice/bob/carol ───────────────────
insert into public.jobs (
  id, user_id, kind, state, display_name, gpu_count,
  fireworks_payload, fireworks_job_name, error,
  created_at
) values
  ('a0000006-0000-0000-0000-000000000019',
   '11111111-1111-1111-1111-111111111111',
   'SFT', 'QUEUED', 'alice-queued-sft-1', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-newsroom-v1","outputModel":"accounts/trilogy/models/qwen3-14b-newsroom","epochs":3,"learningRate":0.0001}'::jsonb,
   null, null,
   now() - interval '12 minutes'),
  ('a0000007-0000-0000-0000-000000000020',
   '11111111-1111-1111-1111-111111111111',
   'DPO', 'QUEUED', 'alice-queued-dpo-1', 4,
   '{"dataset":"accounts/trilogy/datasets/dpo-newsroom-v1","trainingConfig":{"warmStartFrom":"accounts/trilogy/models/qwen3-14b-newsroom","outputModel":"accounts/trilogy/models/qwen3-14b-newsroom-dpo","epochs":2,"learningRate":0.00005},"lossConfig":{"method":"DPO","beta":0.1}}'::jsonb,
   null, null,
   now() - interval '9 minutes'),
  ('b0000005-0000-0000-0000-000000000021',
   '22222222-2222-2222-2222-222222222222',
   'SFT', 'QUEUED', 'bob-queued-sft-1', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-helpdesk-v2","outputModel":"accounts/trilogy/models/qwen3-14b-helpdesk","epochs":3,"learningRate":0.0001}'::jsonb,
   null, null,
   now() - interval '8 minutes'),
  ('b0000006-0000-0000-0000-000000000022',
   '22222222-2222-2222-2222-222222222222',
   'RFT', 'QUEUED', 'bob-queued-rft-1', 4,
   '{"dataset":"accounts/trilogy/datasets/rft-helpdesk-v1","evaluator":"accounts/trilogy/evaluators/helpdesk-judge","trainingConfig":{"baseModel":"accounts/fireworks/models/llama-3-8b-instruct","outputModel":"accounts/trilogy/models/llama-3-8b-helpdesk-grpo","epochs":1,"learningRate":0.00003},"lossConfig":{"method":"GRPO"}}'::jsonb,
   null, null,
   now() - interval '7 minutes'),
  ('c0000004-0000-0000-0000-000000000023',
   '33333333-3333-3333-3333-333333333333',
   'SFT', 'QUEUED', 'carol-queued-sft-1', 4,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-legal-v1","outputModel":"accounts/trilogy/models/qwen3-14b-legal","epochs":3,"learningRate":0.0001}'::jsonb,
   null, null,
   now() - interval '6 minutes'),
  ('c0000005-0000-0000-0000-000000000024',
   '33333333-3333-3333-3333-333333333333',
   'DPO', 'QUEUED', 'carol-queued-dpo-1', 4,
   '{"dataset":"accounts/trilogy/datasets/dpo-legal-v1","trainingConfig":{"warmStartFrom":"accounts/trilogy/models/qwen3-14b-legal","outputModel":"accounts/trilogy/models/qwen3-14b-legal-dpo","epochs":2,"learningRate":0.00005},"lossConfig":{"method":"DPO","beta":0.1}}'::jsonb,
   null, null,
   now() - interval '5 minutes'),
  ('c0000006-0000-0000-0000-000000000025',
   '33333333-3333-3333-3333-333333333333',
   'RFT', 'QUEUED', 'carol-queued-rft-1', 4,
   '{"dataset":"accounts/trilogy/datasets/rft-legal-v1","evaluator":"accounts/trilogy/evaluators/legal-judge","trainingConfig":{"baseModel":"accounts/fireworks/models/llama-3-8b-instruct","outputModel":"accounts/trilogy/models/llama-3-8b-legal-grpo","epochs":1,"learningRate":0.00003},"lossConfig":{"method":"GRPO"}}'::jsonb,
   null, null,
   now() - interval '3 minutes')
on conflict (id) do nothing;

-- ── PROGRESS (5) — GPU pressure: 8 + 2 + 2 + 1 + 1 = 14 GPUs active ─
-- Each user has at most 1 big (gpu_count >= 8) PROGRESS job, satisfying
-- the one_active_big_per_user unique index from migration 0004.
insert into public.jobs (
  id, user_id, kind, state, display_name, gpu_count,
  fireworks_payload, fireworks_job_name, error,
  created_at, started_at
) values
  ('a0000008-0000-0000-0000-000000000026',
   '11111111-1111-1111-1111-111111111111',
   'SFT', 'PROGRESS', 'alice-big-sft-running', 8,
   '{"baseModel":"accounts/fireworks/models/qwen3-32b","dataset":"accounts/trilogy/datasets/sft-bigcorp-v1","outputModel":"accounts/trilogy/models/qwen3-32b-bigcorp","epochs":2,"learningRate":0.00008}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-alice-008', null,
   now() - interval '45 minutes',
   now() - interval '30 minutes'),
  ('b0000007-0000-0000-0000-000000000027',
   '22222222-2222-2222-2222-222222222222',
   'DPO', 'PROGRESS', 'bob-small-dpo-running', 2,
   '{"dataset":"accounts/trilogy/datasets/dpo-helpdesk-v1","trainingConfig":{"warmStartFrom":"accounts/trilogy/models/qwen3-14b-helpdesk","outputModel":"accounts/trilogy/models/qwen3-14b-helpdesk-dpo","epochs":2,"learningRate":0.00005},"lossConfig":{"method":"DPO","beta":0.1}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-bob-007', null,
   now() - interval '20 minutes',
   now() - interval '15 minutes'),
  ('c0000007-0000-0000-0000-000000000028',
   '33333333-3333-3333-3333-333333333333',
   'SFT', 'PROGRESS', 'carol-small-sft-running', 2,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-finops-v1","outputModel":"accounts/trilogy/models/qwen3-14b-finops","epochs":3,"learningRate":0.0001}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-carol-007', null,
   now() - interval '18 minutes',
   now() - interval '10 minutes'),
  ('d0000004-0000-0000-0000-000000000029',
   '44444444-4444-4444-4444-444444444444',
   'RFT', 'PROGRESS', 'dave-tiny-rft-running', 1,
   '{"dataset":"accounts/trilogy/datasets/rft-mini-v1","evaluator":"accounts/trilogy/evaluators/mini-judge","trainingConfig":{"baseModel":"accounts/fireworks/models/llama-3-8b-instruct","outputModel":"accounts/trilogy/models/llama-3-8b-mini-grpo","epochs":1,"learningRate":0.00003},"lossConfig":{"method":"GRPO"}}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-dave-004', null,
   now() - interval '14 minutes',
   now() - interval '8 minutes'),
  ('e0000004-0000-0000-0000-000000000030',
   '55555555-5555-5555-5555-555555555555',
   'SFT', 'PROGRESS', 'eve-tiny-sft-running', 1,
   '{"baseModel":"accounts/fireworks/models/qwen3-14b","dataset":"accounts/trilogy/datasets/sft-greeting-v1","outputModel":"accounts/trilogy/models/qwen3-14b-greeting","epochs":3,"learningRate":0.0001}'::jsonb,
   'accounts/trilogy/fineTuningJobs/job-eve-004', null,
   now() - interval '11 minutes',
   now() - interval '5 minutes')
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────
-- End of seed
-- ────────────────────────────────────────────────────────────────────
