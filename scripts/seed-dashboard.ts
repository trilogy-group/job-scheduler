#!/usr/bin/env node
// scripts/seed-dashboard.ts
//
// Comprehensive seed script for local Supabase dev that populates the
// dashboard with realistic fixture data: 5 users and 30+ jobs spread
// across all states, kinds, and gpu counts, over the last 14 days.
//
// Idempotent: deletes all rows from public.jobs and public.users first.
//
// Constraints respected:
//   - Unique partial index "one_active_per_user" -> at most ONE PROGRESS
//     job per user. We give each user 0 or 1 PROGRESS jobs.
//   - FIFO violation: at least one job created AFTER an earlier job
//     starts before that earlier job's started_at, simulating a fairness
//     anomaly the dashboard should flag.
//
// Run: npm run seed-dashboard
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env (.env.local).

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(2);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Fixture catalogue
// ---------------------------------------------------------------------------

const USER_EMAILS = [
  'alice@trilogy.com',
  'bob@trilogy.com',
  'carol@trilogy.com',
  'dave@trilogy.com',
  'eve@trilogy.com',
];

const KINDS = ['SFT', 'DPO', 'RFT'] as const;
type Kind = (typeof KINDS)[number];

type State = 'QUEUED' | 'PROGRESS' | 'SUCCESS' | 'FAIL' | 'CANCELLED';

const GPU_CHOICES = [2, 4, 8];

const BASE_MODELS = [
  'accounts/fireworks/models/llama-v3-8b-instruct',
  'accounts/fireworks/models/llama-v3-70b-instruct',
  'accounts/fireworks/models/mixtral-8x7b-instruct',
  'accounts/fireworks/models/qwen2-7b-instruct',
];

const DATASETS_BY_KIND: Record<Kind, string[]> = {
  SFT: [
    'accounts/trilogy/datasets/sft-dataset-v1',
    'accounts/trilogy/datasets/sft-instruct-mix-v2',
    'accounts/trilogy/datasets/sft-code-v1',
  ],
  DPO: [
    'accounts/trilogy/datasets/dpo-pairs-v1',
    'accounts/trilogy/datasets/dpo-helpfulness-v2',
  ],
  RFT: [
    'accounts/trilogy/datasets/rft-math-v1',
    'accounts/trilogy/datasets/rft-reasoning-v3',
  ],
};

const FAIL_ERRORS = [
  'cuda out of memory: tried to allocate 2.00 GiB',
  'fireworks api: 429 rate limit exceeded',
  'dataset validation failed: 12 malformed rows',
  'training diverged: loss=NaN at step 1840',
  'preemption: spot instance reclaimed by provider',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const NOW = Date.now();

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function rand(seed: number): number {
  // deterministic pseudo-random in [0,1)
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function jobName(slug: string): string {
  return `accounts/trilogy/fineTuningJobs/job-${slug}`;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function modelFor(kind: Kind, base: string): string {
  const tag = kind.toLowerCase();
  const short = base.split('/').pop() ?? 'model';
  return `accounts/trilogy/models/${short}-${tag}-ft`;
}

// ---------------------------------------------------------------------------
// 1) Wipe existing rows (jobs first to avoid FK violation)
// ---------------------------------------------------------------------------

console.log('[seed] deleting public.jobs ...');
{
  const { error } = await sb
    .from('jobs')
    .delete()
    .gte('created_at', '1970-01-01T00:00:00Z');
  if (error) {
    console.error('delete jobs failed:', error.message);
    process.exit(1);
  }
}

console.log('[seed] deleting public.users ...');
{
  const { error } = await sb
    .from('users')
    .delete()
    .gte('created_at', '1970-01-01T00:00:00Z');
  if (error) {
    console.error('delete users failed:', error.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 2) Insert users, capture UUIDs
// ---------------------------------------------------------------------------

console.log(`[seed] inserting ${USER_EMAILS.length} users ...`);
const userRows = USER_EMAILS.map((email) => ({ email }));
const { data: insertedUsers, error: usersErr } = await sb
  .from('users')
  .upsert(userRows, { onConflict: 'email' })
  .select('id, email');

if (usersErr || !insertedUsers) {
  console.error('insert users failed:', usersErr?.message);
  process.exit(1);
}

const userByEmail = new Map<string, string>();
for (const u of insertedUsers) userByEmail.set(u.email, u.id);
const userIds = USER_EMAILS.map((e) => {
  const id = userByEmail.get(e);
  if (!id) {
    console.error(`missing user id for ${e}`);
    process.exit(1);
  }
  return id;
});

// ---------------------------------------------------------------------------
// 3) Build job rows
// ---------------------------------------------------------------------------

type JobRow = {
  user_id: string;
  kind: Kind;
  state: State;
  display_name: string;
  gpu_count: number;
  fireworks_payload: Record<string, unknown>;
  fireworks_job_name: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const jobs: JobRow[] = [];

// Distribution plan (sums to 32 jobs):
//   - SUCCESS: 12 (the bulk; many completed)
//   - FAIL:     6
//   - CANCELLED:4
//   - QUEUED:   6
//   - PROGRESS: 4 (one each for 4 of the 5 users)
const PLAN: { state: State; count: number }[] = [
  { state: 'SUCCESS',   count: 12 },
  { state: 'FAIL',      count: 6 },
  { state: 'CANCELLED', count: 4 },
  { state: 'QUEUED',    count: 6 },
  { state: 'PROGRESS',  count: 4 },
];

let seed = 1;
let jobIdx = 0;

// PROGRESS jobs go to the first 4 users only (1 each) to satisfy the
// unique partial index on (user_id) where state='PROGRESS'.
const progressUsers = userIds.slice(0, 4);

for (const { state, count } of PLAN) {
  for (let i = 0; i < count; i++) {
    seed++;
    const kind = pick(KINDS, jobIdx + i);
    const base = pick(BASE_MODELS, seed);
    const dataset = pick(DATASETS_BY_KIND[kind], seed + 1);
    const gpu_count = pick(GPU_CHOICES, seed + 2);

    let user_id: string;
    if (state === 'PROGRESS') {
      user_id = progressUsers[i % progressUsers.length];
    } else {
      user_id = pick(userIds, seed + 3);
    }

    const daysAgo = 14 * rand(seed + 7);
    const createdMs = NOW - daysAgo * ONE_DAY;

    let startedMs: number | null = null;
    let completedMs: number | null = null;
    let fireworks_job_name: string | null = null;
    let errorMsg: string | null = null;

    const slug = `${kind.toLowerCase()}-${seed.toString(36)}${i.toString(36)}`;

    switch (state) {
      case 'QUEUED':
        break;
      case 'PROGRESS': {
        startedMs = createdMs + (1 + 4 * rand(seed + 11)) * ONE_HOUR;
        if (startedMs > NOW) startedMs = NOW - ONE_HOUR;
        fireworks_job_name = jobName(slug);
        break;
      }
      case 'SUCCESS': {
        const queueWait = (0.2 + 3 * rand(seed + 13)) * ONE_HOUR;
        const runtime = (0.5 + 6 * rand(seed + 17)) * ONE_HOUR;
        startedMs = createdMs + queueWait;
        completedMs = startedMs + runtime;
        if (completedMs > NOW) completedMs = NOW - 30 * 60 * 1000;
        fireworks_job_name = jobName(slug);
        break;
      }
      case 'FAIL': {
        const queueWait = (0.1 + 2 * rand(seed + 19)) * ONE_HOUR;
        const runtime = (0.1 + 3 * rand(seed + 23)) * ONE_HOUR;
        startedMs = createdMs + queueWait;
        completedMs = startedMs + runtime;
        if (completedMs > NOW) completedMs = NOW - ONE_HOUR;
        fireworks_job_name = jobName(slug);
        errorMsg = pick(FAIL_ERRORS, seed + 29);
        break;
      }
      case 'CANCELLED': {
        if (rand(seed + 31) < 0.5) {
          completedMs = createdMs + (0.05 + 0.5 * rand(seed + 37)) * ONE_HOUR;
        } else {
          startedMs = createdMs + (0.1 + 1 * rand(seed + 41)) * ONE_HOUR;
          completedMs = startedMs + (0.1 + 1 * rand(seed + 43)) * ONE_HOUR;
        }
        break;
      }
    }

    jobs.push({
      user_id,
      kind,
      state,
      display_name: `${kind.toLowerCase()}-run-${jobs.length + 1}`,
      gpu_count,
      fireworks_payload: {
        model: modelFor(kind, base),
        dataset,
        base_model: base,
      },
      fireworks_job_name,
      error: errorMsg,
      created_at: iso(createdMs),
      started_at: startedMs ? iso(startedMs) : null,
      completed_at: completedMs ? iso(completedMs) : null,
    });
  }
  jobIdx += count;
}

// ---------------------------------------------------------------------------
// 4) Inject at least one explicit FIFO violation
//
// Picks the earliest SUCCESS job (A), then crafts a new SUCCESS job B that
// is created AFTER A but started BEFORE A — i.e. the scheduler skipped
// ahead unfairly. Dashboards should flag this.
// ---------------------------------------------------------------------------

{
  const successJobs = jobs
    .filter((j) => j.state === 'SUCCESS' && j.started_at)
    .sort((a, b) =>
      a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
    );

  if (successJobs.length >= 1) {
    const a = successJobs[0];
    const aCreated = Date.parse(a.created_at);
    const aStarted = Date.parse(a.started_at as string);

    const bCreatedMs = aCreated + 5 * 60 * 1000;
    const bStartedMs = aStarted - 15 * 60 * 1000;
    const bCompletedMs = bStartedMs + 45 * 60 * 1000;

    const violatorUser = userIds[userIds.length - 1];
    jobs.push({
      user_id: violatorUser,
      kind: 'SFT',
      state: 'SUCCESS',
      display_name: 'sft-run-fifo-violator',
      gpu_count: 4,
      fireworks_payload: {
        model: 'accounts/trilogy/models/llama-3-8b-sft-ft',
        dataset: 'accounts/trilogy/datasets/sft-dataset-v1',
        base_model: 'accounts/fireworks/models/llama-v3-8b-instruct',
      },
      fireworks_job_name: jobName('fifo-violator-001'),
      error: null,
      created_at: iso(bCreatedMs),
      started_at: iso(bStartedMs),
      completed_at: iso(bCompletedMs),
    });
  }
}

// ---------------------------------------------------------------------------
// 5) Batch insert
// ---------------------------------------------------------------------------

console.log(`[seed] inserting ${jobs.length} jobs ...`);
const { error: jobsErr } = await sb.from('jobs').insert(jobs);
if (jobsErr) {
  console.error('insert jobs failed:', jobsErr.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 6) Summary
// ---------------------------------------------------------------------------

const stateCounts: Record<string, number> = {};
for (const j of jobs) stateCounts[j.state] = (stateCounts[j.state] ?? 0) + 1;

console.log('');
console.log('=== seed-dashboard summary ===');
console.log(`users: ${insertedUsers.length}`);
console.log(`jobs:  ${jobs.length}`);
for (const s of ['QUEUED', 'PROGRESS', 'SUCCESS', 'FAIL', 'CANCELLED']) {
  console.log(`  ${s.padEnd(10)} ${stateCounts[s] ?? 0}`);
}
console.log('FIFO violation: 1 synthetic record injected (fifo-violator-001)');
console.log('done.');

process.exit(0);
