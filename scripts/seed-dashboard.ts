// scripts/seed-dashboard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent seeding script that mirrors supabase/seed.sql via the Supabase
// JS client. Useful when you cannot run `supabase db reset` (e.g. against a
// remote Supabase project) but still want the canonical 5 users + 30 jobs
// dashboard fixture set.
//
// Usage:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed-dashboard
//
// Requires Node ≥ 18 and `--experimental-strip-types` (configured via the
// npm script entry).
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.',
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Fixed user UUIDs (must match supabase/seed.sql) ────────────────────────
const USERS = {
  alice: '11111111-1111-1111-1111-111111111111',
  bob:   '22222222-2222-2222-2222-222222222222',
  carol: '33333333-3333-3333-3333-333333333333',
  dave:  '44444444-4444-4444-4444-444444444444',
  eve:   '55555555-5555-5555-5555-555555555555',
} as const;

const USER_ROWS = [
  { id: USERS.alice, email: 'alice.chen@trilogy.com' },
  { id: USERS.bob,   email: 'bob.garcia@trilogy.com' },
  { id: USERS.carol, email: 'carol.smith@trilogy.com' },
  { id: USERS.dave,  email: 'dave.jones@trilogy.com' },
  { id: USERS.eve,   email: 'eve.taylor@trilogy.com' },
];

const USER_IDS = USER_ROWS.map((u) => u.id);

// ─── Time helpers ───────────────────────────────────────────────────────────
const NOW = Date.now();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const iso = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

// ─── Payload constants (kept inline so the script is self-contained) ────────
const P = {
  aliceSft1: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-shakespeare-v3',
    outputModel: 'accounts/trilogy/models/qwen3-14b-shakespeare-r1',
    epochs: 3, learningRate: 0.0001,
  },
  aliceSft2: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-shakespeare-v3',
    outputModel: 'accounts/trilogy/models/qwen3-14b-shakespeare-r2',
    epochs: 3, learningRate: 0.0001,
  },
  bobDpo1: {
    dataset: 'accounts/trilogy/datasets/dpo-preferences-v1',
    trainingConfig: {
      warmStartFrom: 'accounts/trilogy/models/qwen3-14b-shakespeare-r1',
      outputModel: 'accounts/trilogy/models/qwen3-14b-dpo-aligned-r1',
      epochs: 2, learningRate: 0.00005,
    },
    lossConfig: { method: 'DPO', beta: 0.1 },
  },
  bobDpo2: {
    dataset: 'accounts/trilogy/datasets/dpo-preferences-v1',
    trainingConfig: {
      warmStartFrom: 'accounts/trilogy/models/qwen3-14b-shakespeare-r1',
      outputModel: 'accounts/trilogy/models/qwen3-14b-dpo-aligned-r2',
      epochs: 2, learningRate: 0.00005,
    },
    lossConfig: { method: 'DPO', beta: 0.1 },
  },
  carolRft1: {
    dataset: 'accounts/trilogy/datasets/rft-math-v2',
    evaluator: 'accounts/trilogy/evaluators/math-correctness',
    trainingConfig: {
      baseModel: 'accounts/fireworks/models/llama-3-8b-instruct',
      outputModel: 'accounts/trilogy/models/llama-3-8b-grpo-math-r1',
      epochs: 1, learningRate: 0.00003,
    },
    lossConfig: { method: 'GRPO' },
  },
  daveSftBig: {
    baseModel: 'accounts/fireworks/models/qwen3-32b',
    dataset: 'accounts/trilogy/datasets/sft-summarizer-v4',
    outputModel: 'accounts/trilogy/models/qwen3-32b-summarizer-r1',
    epochs: 2, learningRate: 0.00008,
  },
  eveDpo1: {
    dataset: 'accounts/trilogy/datasets/dpo-tone-v2',
    trainingConfig: {
      warmStartFrom: 'accounts/trilogy/models/qwen3-14b-tone-base',
      outputModel: 'accounts/trilogy/models/qwen3-14b-tone-dpo-r1',
      epochs: 2, learningRate: 0.00005,
    },
    lossConfig: { method: 'DPO', beta: 0.15 },
  },
  aliceRft1: {
    dataset: 'accounts/trilogy/datasets/rft-reasoning-v1',
    evaluator: 'accounts/trilogy/evaluators/reasoning-judge',
    trainingConfig: {
      baseModel: 'accounts/fireworks/models/llama-3-8b-instruct',
      outputModel: 'accounts/trilogy/models/llama-3-8b-reasoning-r1',
      epochs: 1, learningRate: 0.00003,
    },
    lossConfig: { method: 'GRPO' },
  },
  aliceBadPayload: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-broken-schema',
    outputModel: 'accounts/trilogy/models/qwen3-14b-broken',
    epochs: 3, learningRate: 0.0001,
  },
  bobFlaky: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-customer-tickets',
    outputModel: 'accounts/trilogy/models/qwen3-14b-tickets',
    epochs: 3, learningRate: 0.0001,
  },
  carolKilled: {
    dataset: 'accounts/trilogy/datasets/dpo-policy-v1',
    trainingConfig: {
      warmStartFrom: 'accounts/trilogy/models/qwen3-14b-policy-base',
      outputModel: 'accounts/trilogy/models/qwen3-14b-policy-dpo',
      epochs: 2, learningRate: 0.00005,
    },
    lossConfig: { method: 'DPO', beta: 0.1 },
  },
  daveQuotaBust: {
    dataset: 'accounts/trilogy/datasets/rft-code-v1',
    evaluator: 'accounts/trilogy/evaluators/code-tests',
    trainingConfig: {
      baseModel: 'accounts/fireworks/models/llama-3-8b-instruct',
      outputModel: 'accounts/trilogy/models/llama-3-8b-code-grpo',
      epochs: 1, learningRate: 0.00003,
    },
    lossConfig: { method: 'GRPO' },
  },
  eveRateLimited: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-rag-snippets',
    outputModel: 'accounts/trilogy/models/qwen3-14b-rag',
    epochs: 3, learningRate: 0.0001,
  },
  bobServerCrash: {
    dataset: 'accounts/trilogy/datasets/rft-search-v1',
    evaluator: 'accounts/trilogy/evaluators/search-judge',
    trainingConfig: {
      baseModel: 'accounts/fireworks/models/llama-3-8b-instruct',
      outputModel: 'accounts/trilogy/models/llama-3-8b-search-grpo',
      epochs: 1, learningRate: 0.00003,
    },
    lossConfig: { method: 'GRPO' },
  },
  aliceAborted: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-experiment-v9',
    outputModel: 'accounts/trilogy/models/qwen3-14b-experiment',
    epochs: 3, learningRate: 0.0001,
  },
  carolSuperseded: {
    dataset: 'accounts/trilogy/datasets/dpo-policy-v0',
    trainingConfig: {
      warmStartFrom: 'accounts/trilogy/models/qwen3-14b-policy-base',
      outputModel: 'accounts/trilogy/models/qwen3-14b-policy-old',
      epochs: 2, learningRate: 0.00005,
    },
    lossConfig: { method: 'DPO', beta: 0.1 },
  },
  daveWrongDataset: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-wrong-source',
    outputModel: 'accounts/trilogy/models/qwen3-14b-wrong',
    epochs: 3, learningRate: 0.0001,
  },
  eveRollback: {
    dataset: 'accounts/trilogy/datasets/rft-tone-v0',
    evaluator: 'accounts/trilogy/evaluators/tone-judge',
    trainingConfig: {
      baseModel: 'accounts/fireworks/models/llama-3-8b-instruct',
      outputModel: 'accounts/trilogy/models/llama-3-8b-tone-grpo-old',
      epochs: 1, learningRate: 0.00003,
    },
    lossConfig: { method: 'GRPO' },
  },
  aliceQueuedSft: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-newsroom-v1',
    outputModel: 'accounts/trilogy/models/qwen3-14b-newsroom',
    epochs: 3, learningRate: 0.0001,
  },
  aliceQueuedDpo: {
    dataset: 'accounts/trilogy/datasets/dpo-newsroom-v1',
    trainingConfig: {
      warmStartFrom: 'accounts/trilogy/models/qwen3-14b-newsroom',
      outputModel: 'accounts/trilogy/models/qwen3-14b-newsroom-dpo',
      epochs: 2, learningRate: 0.00005,
    },
    lossConfig: { method: 'DPO', beta: 0.1 },
  },
  bobQueuedSft: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-helpdesk-v2',
    outputModel: 'accounts/trilogy/models/qwen3-14b-helpdesk',
    epochs: 3, learningRate: 0.0001,
  },
  bobQueuedRft: {
    dataset: 'accounts/trilogy/datasets/rft-helpdesk-v1',
    evaluator: 'accounts/trilogy/evaluators/helpdesk-judge',
    trainingConfig: {
      baseModel: 'accounts/fireworks/models/llama-3-8b-instruct',
      outputModel: 'accounts/trilogy/models/llama-3-8b-helpdesk-grpo',
      epochs: 1, learningRate: 0.00003,
    },
    lossConfig: { method: 'GRPO' },
  },
  carolQueuedSft: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-legal-v1',
    outputModel: 'accounts/trilogy/models/qwen3-14b-legal',
    epochs: 3, learningRate: 0.0001,
  },
  carolQueuedDpo: {
    dataset: 'accounts/trilogy/datasets/dpo-legal-v1',
    trainingConfig: {
      warmStartFrom: 'accounts/trilogy/models/qwen3-14b-legal',
      outputModel: 'accounts/trilogy/models/qwen3-14b-legal-dpo',
      epochs: 2, learningRate: 0.00005,
    },
    lossConfig: { method: 'DPO', beta: 0.1 },
  },
  carolQueuedRft: {
    dataset: 'accounts/trilogy/datasets/rft-legal-v1',
    evaluator: 'accounts/trilogy/evaluators/legal-judge',
    trainingConfig: {
      baseModel: 'accounts/fireworks/models/llama-3-8b-instruct',
      outputModel: 'accounts/trilogy/models/llama-3-8b-legal-grpo',
      epochs: 1, learningRate: 0.00003,
    },
    lossConfig: { method: 'GRPO' },
  },
  aliceBigRunning: {
    baseModel: 'accounts/fireworks/models/qwen3-32b',
    dataset: 'accounts/trilogy/datasets/sft-bigcorp-v1',
    outputModel: 'accounts/trilogy/models/qwen3-32b-bigcorp',
    epochs: 2, learningRate: 0.00008,
  },
  bobSmallRunning: {
    dataset: 'accounts/trilogy/datasets/dpo-helpdesk-v1',
    trainingConfig: {
      warmStartFrom: 'accounts/trilogy/models/qwen3-14b-helpdesk',
      outputModel: 'accounts/trilogy/models/qwen3-14b-helpdesk-dpo',
      epochs: 2, learningRate: 0.00005,
    },
    lossConfig: { method: 'DPO', beta: 0.1 },
  },
  carolSmallRunning: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-finops-v1',
    outputModel: 'accounts/trilogy/models/qwen3-14b-finops',
    epochs: 3, learningRate: 0.0001,
  },
  daveTinyRunning: {
    dataset: 'accounts/trilogy/datasets/rft-mini-v1',
    evaluator: 'accounts/trilogy/evaluators/mini-judge',
    trainingConfig: {
      baseModel: 'accounts/fireworks/models/llama-3-8b-instruct',
      outputModel: 'accounts/trilogy/models/llama-3-8b-mini-grpo',
      epochs: 1, learningRate: 0.00003,
    },
    lossConfig: { method: 'GRPO' },
  },
  eveTinyRunning: {
    baseModel: 'accounts/fireworks/models/qwen3-14b',
    dataset: 'accounts/trilogy/datasets/sft-greeting-v1',
    outputModel: 'accounts/trilogy/models/qwen3-14b-greeting',
    epochs: 3, learningRate: 0.0001,
  },
};

// ─── 30 jobs (mirrors supabase/seed.sql exactly) ────────────────────────────
const JOB_ROWS = [
  // ── SUCCESS (8) ──────────────────────────────────────────────────────────
  {
    id: 'a0000001-0000-0000-0000-000000000001', user_id: USERS.alice,
    kind: 'SFT', state: 'SUCCESS', display_name: 'alice-shakespeare-sft-rev1', gpu_count: 4,
    fireworks_payload: P.aliceSft1,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-alice-001', error: null,
    created_at: iso(2 * HOUR), started_at: iso(80 * MIN), completed_at: iso(30 * MIN),
  },
  {
    id: 'a0000002-0000-0000-0000-000000000002', user_id: USERS.alice,
    kind: 'SFT', state: 'SUCCESS', display_name: 'alice-shakespeare-sft-rev2', gpu_count: 4,
    fireworks_payload: P.aliceSft2,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-alice-002', error: null,
    created_at: iso(90 * MIN), started_at: iso(85 * MIN), completed_at: iso(40 * MIN),
  },
  {
    id: 'b0000001-0000-0000-0000-000000000003', user_id: USERS.bob,
    kind: 'DPO', state: 'SUCCESS', display_name: 'bob-preferences-dpo-rev1', gpu_count: 4,
    fireworks_payload: P.bobDpo1,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-bob-001', error: null,
    created_at: iso(5 * DAY),
    started_at: iso(4 * DAY + 20 * HOUR),
    completed_at: iso(4 * DAY + 12 * HOUR),
  },
  {
    id: 'b0000002-0000-0000-0000-000000000004', user_id: USERS.bob,
    kind: 'DPO', state: 'SUCCESS', display_name: 'bob-preferences-dpo-rev2', gpu_count: 4,
    fireworks_payload: P.bobDpo2,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-bob-002', error: null,
    created_at: iso(4 * DAY + 22 * HOUR),
    started_at: iso(4 * DAY + 21 * HOUR),
    completed_at: iso(4 * DAY + 15 * HOUR),
  },
  {
    id: 'c0000001-0000-0000-0000-000000000005', user_id: USERS.carol,
    kind: 'RFT', state: 'SUCCESS', display_name: 'carol-math-grpo-r1', gpu_count: 4,
    fireworks_payload: P.carolRft1,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-carol-001', error: null,
    created_at: iso(7 * DAY),
    started_at: iso(6 * DAY + 22 * HOUR),
    completed_at: iso(6 * DAY + 10 * HOUR),
  },
  {
    id: 'd0000001-0000-0000-0000-000000000006', user_id: USERS.dave,
    kind: 'SFT', state: 'SUCCESS', display_name: 'dave-summarizer-sft-big', gpu_count: 8,
    fireworks_payload: P.daveSftBig,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-dave-001', error: null,
    created_at: iso(10 * DAY),
    started_at: iso(9 * DAY + 23 * HOUR),
    completed_at: iso(9 * DAY + 6 * HOUR),
  },
  {
    id: 'e0000001-0000-0000-0000-000000000007', user_id: USERS.eve,
    kind: 'DPO', state: 'SUCCESS', display_name: 'eve-tone-dpo-r1', gpu_count: 4,
    fireworks_payload: P.eveDpo1,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-eve-001', error: null,
    created_at: iso(3 * DAY),
    started_at: iso(2 * DAY + 23 * HOUR),
    completed_at: iso(2 * DAY + 12 * HOUR),
  },
  {
    id: 'a0000003-0000-0000-0000-000000000008', user_id: USERS.alice,
    kind: 'RFT', state: 'SUCCESS', display_name: 'alice-reasoning-grpo-r1', gpu_count: 4,
    fireworks_payload: P.aliceRft1,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-alice-003', error: null,
    created_at: iso(12 * DAY),
    started_at: iso(11 * DAY + 22 * HOUR),
    completed_at: iso(11 * DAY + 14 * HOUR),
  },

  // ── FAIL (6) ─────────────────────────────────────────────────────────────
  {
    id: 'a0000004-0000-0000-0000-000000000009', user_id: USERS.alice,
    kind: 'SFT', state: 'FAIL', display_name: 'alice-bad-payload', gpu_count: 4,
    fireworks_payload: P.aliceBadPayload,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-alice-004',
    error: 'Fireworks 400 Bad Request: invalid dataset schema (missing prompt field)',
    created_at: iso(6 * DAY),
    started_at: iso(5 * DAY + 23 * HOUR),
    completed_at: iso(5 * DAY + 22 * HOUR),
  },
  {
    id: 'b0000003-0000-0000-0000-000000000010', user_id: USERS.bob,
    kind: 'SFT', state: 'FAIL', display_name: 'bob-flaky-upstream', gpu_count: 4,
    fireworks_payload: P.bobFlaky,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-bob-003',
    error: 'Fireworks 503 Service Unavailable: upstream timeout after 30s',
    created_at: iso(4 * DAY),
    started_at: iso(3 * DAY + 22 * HOUR),
    completed_at: iso(3 * DAY + 18 * HOUR),
  },
  {
    id: 'c0000002-0000-0000-0000-000000000011', user_id: USERS.carol,
    kind: 'DPO', state: 'FAIL', display_name: 'carol-killed-job', gpu_count: 4,
    fireworks_payload: P.carolKilled,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-carol-002',
    error: 'cancelled externally by operator: shutting down for capacity rebalance',
    created_at: iso(5 * DAY),
    started_at: iso(4 * DAY + 22 * HOUR),
    completed_at: iso(4 * DAY + 20 * HOUR),
  },
  {
    id: 'd0000002-0000-0000-0000-000000000012', user_id: USERS.dave,
    kind: 'RFT', state: 'FAIL', display_name: 'dave-quota-bust', gpu_count: 4,
    fireworks_payload: P.daveQuotaBust,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-dave-002',
    error: 'quota exceeded: tenant monthly RFT budget consumed (other-class)',
    created_at: iso(2 * DAY),
    started_at: iso(1 * DAY + 22 * HOUR),
    completed_at: iso(1 * DAY + 21 * HOUR),
  },
  {
    id: 'e0000002-0000-0000-0000-000000000013', user_id: USERS.eve,
    kind: 'SFT', state: 'FAIL', display_name: 'eve-rate-limited', gpu_count: 4,
    fireworks_payload: P.eveRateLimited,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-eve-002',
    error: 'Fireworks 429 Too Many Requests: per-tenant submission rate cap',
    created_at: iso(8 * DAY),
    started_at: iso(7 * DAY + 23 * HOUR),
    completed_at: iso(7 * DAY + 22 * HOUR),
  },
  {
    id: 'b0000004-0000-0000-0000-000000000014', user_id: USERS.bob,
    kind: 'RFT', state: 'FAIL', display_name: 'bob-server-crash', gpu_count: 4,
    fireworks_payload: P.bobServerCrash,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-bob-004',
    error: 'Fireworks 500 Internal Server Error: trainer pod OOM-killed',
    created_at: iso(11 * DAY),
    started_at: iso(10 * DAY + 22 * HOUR),
    completed_at: iso(10 * DAY + 18 * HOUR),
  },

  // ── CANCELLED (4) ────────────────────────────────────────────────────────
  {
    id: 'a0000005-0000-0000-0000-000000000015', user_id: USERS.alice,
    kind: 'SFT', state: 'CANCELLED', display_name: 'alice-aborted-experiment', gpu_count: 4,
    fireworks_payload: P.aliceAborted,
    fireworks_job_name: null, error: null,
    created_at: iso(1 * DAY), started_at: null, completed_at: iso(23 * HOUR),
  },
  {
    id: 'c0000003-0000-0000-0000-000000000016', user_id: USERS.carol,
    kind: 'DPO', state: 'CANCELLED', display_name: 'carol-superseded', gpu_count: 4,
    fireworks_payload: P.carolSuperseded,
    fireworks_job_name: null, error: null,
    created_at: iso(9 * DAY), started_at: null, completed_at: iso(8 * DAY + 23 * HOUR),
  },
  {
    id: 'd0000003-0000-0000-0000-000000000017', user_id: USERS.dave,
    kind: 'SFT', state: 'CANCELLED', display_name: 'dave-wrong-dataset', gpu_count: 4,
    fireworks_payload: P.daveWrongDataset,
    fireworks_job_name: null, error: null,
    created_at: iso(13 * DAY), started_at: null, completed_at: iso(12 * DAY + 23 * HOUR),
  },
  {
    id: 'e0000003-0000-0000-0000-000000000018', user_id: USERS.eve,
    kind: 'RFT', state: 'CANCELLED', display_name: 'eve-rollback', gpu_count: 4,
    fireworks_payload: P.eveRollback,
    fireworks_job_name: null, error: null,
    created_at: iso(6 * DAY), started_at: null, completed_at: iso(5 * DAY + 23 * HOUR),
  },

  // ── QUEUED (7) ───────────────────────────────────────────────────────────
  {
    id: 'a0000006-0000-0000-0000-000000000019', user_id: USERS.alice,
    kind: 'SFT', state: 'QUEUED', display_name: 'alice-queued-sft-1', gpu_count: 4,
    fireworks_payload: P.aliceQueuedSft,
    fireworks_job_name: null, error: null,
    created_at: iso(12 * MIN), started_at: null, completed_at: null,
  },
  {
    id: 'a0000007-0000-0000-0000-000000000020', user_id: USERS.alice,
    kind: 'DPO', state: 'QUEUED', display_name: 'alice-queued-dpo-1', gpu_count: 4,
    fireworks_payload: P.aliceQueuedDpo,
    fireworks_job_name: null, error: null,
    created_at: iso(9 * MIN), started_at: null, completed_at: null,
  },
  {
    id: 'b0000005-0000-0000-0000-000000000021', user_id: USERS.bob,
    kind: 'SFT', state: 'QUEUED', display_name: 'bob-queued-sft-1', gpu_count: 4,
    fireworks_payload: P.bobQueuedSft,
    fireworks_job_name: null, error: null,
    created_at: iso(8 * MIN), started_at: null, completed_at: null,
  },
  {
    id: 'b0000006-0000-0000-0000-000000000022', user_id: USERS.bob,
    kind: 'RFT', state: 'QUEUED', display_name: 'bob-queued-rft-1', gpu_count: 4,
    fireworks_payload: P.bobQueuedRft,
    fireworks_job_name: null, error: null,
    created_at: iso(7 * MIN), started_at: null, completed_at: null,
  },
  {
    id: 'c0000004-0000-0000-0000-000000000023', user_id: USERS.carol,
    kind: 'SFT', state: 'QUEUED', display_name: 'carol-queued-sft-1', gpu_count: 4,
    fireworks_payload: P.carolQueuedSft,
    fireworks_job_name: null, error: null,
    created_at: iso(6 * MIN), started_at: null, completed_at: null,
  },
  {
    id: 'c0000005-0000-0000-0000-000000000024', user_id: USERS.carol,
    kind: 'DPO', state: 'QUEUED', display_name: 'carol-queued-dpo-1', gpu_count: 4,
    fireworks_payload: P.carolQueuedDpo,
    fireworks_job_name: null, error: null,
    created_at: iso(5 * MIN), started_at: null, completed_at: null,
  },
  {
    id: 'c0000006-0000-0000-0000-000000000025', user_id: USERS.carol,
    kind: 'RFT', state: 'QUEUED', display_name: 'carol-queued-rft-1', gpu_count: 4,
    fireworks_payload: P.carolQueuedRft,
    fireworks_job_name: null, error: null,
    created_at: iso(3 * MIN), started_at: null, completed_at: null,
  },

  // ── PROGRESS (5) ─────────────────────────────────────────────────────────
  {
    id: 'a0000008-0000-0000-0000-000000000026', user_id: USERS.alice,
    kind: 'SFT', state: 'PROGRESS', display_name: 'alice-big-sft-running', gpu_count: 8,
    fireworks_payload: P.aliceBigRunning,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-alice-008', error: null,
    created_at: iso(45 * MIN), started_at: iso(30 * MIN), completed_at: null,
  },
  {
    id: 'b0000007-0000-0000-0000-000000000027', user_id: USERS.bob,
    kind: 'DPO', state: 'PROGRESS', display_name: 'bob-small-dpo-running', gpu_count: 2,
    fireworks_payload: P.bobSmallRunning,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-bob-007', error: null,
    created_at: iso(20 * MIN), started_at: iso(15 * MIN), completed_at: null,
  },
  {
    id: 'c0000007-0000-0000-0000-000000000028', user_id: USERS.carol,
    kind: 'SFT', state: 'PROGRESS', display_name: 'carol-small-sft-running', gpu_count: 2,
    fireworks_payload: P.carolSmallRunning,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-carol-007', error: null,
    created_at: iso(18 * MIN), started_at: iso(10 * MIN), completed_at: null,
  },
  {
    id: 'd0000004-0000-0000-0000-000000000029', user_id: USERS.dave,
    kind: 'RFT', state: 'PROGRESS', display_name: 'dave-tiny-rft-running', gpu_count: 1,
    fireworks_payload: P.daveTinyRunning,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-dave-004', error: null,
    created_at: iso(14 * MIN), started_at: iso(8 * MIN), completed_at: null,
  },
  {
    id: 'e0000004-0000-0000-0000-000000000030', user_id: USERS.eve,
    kind: 'SFT', state: 'PROGRESS', display_name: 'eve-tiny-sft-running', gpu_count: 1,
    fireworks_payload: P.eveTinyRunning,
    fireworks_job_name: 'accounts/trilogy/fineTuningJobs/job-eve-004', error: null,
    created_at: iso(11 * MIN), started_at: iso(5 * MIN), completed_at: null,
  },
];

function die(stage: string, err: unknown): never {
  console.error(`[seed-dashboard] ${stage} failed:`, err);
  process.exit(1);
}

async function main() {
  // 1. Idempotent cleanup — jobs first (FK on user_id), then seed users.
  const delJobs = await sb
    .from('jobs')
    .delete()
    .in('user_id', USER_IDS);
  if (delJobs.error) die('delete jobs', delJobs.error);

  const delUsers = await sb
    .from('users')
    .delete()
    .in('id', USER_IDS);
  if (delUsers.error) die('delete users', delUsers.error);

  // 2. Insert 5 users.
  const insUsers = await sb
    .from('users')
    .insert(USER_ROWS, { ignoreDuplicates: true });
  if (insUsers.error) die('insert users', insUsers.error);

  // 3. Insert 30 jobs.
  const insJobs = await sb
    .from('jobs')
    .insert(JOB_ROWS, { ignoreDuplicates: true });
  if (insJobs.error) die('insert jobs', insJobs.error);

  console.log(`Seeded ${USER_ROWS.length} users, ${JOB_ROWS.length} jobs`);
  process.exit(0);
}

main().catch((err) => die('main', err));
