// scripts/dashboard-fixtures.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutating helpers for ui-tester rounds. These functions assume that
// `supabase db reset` has already been run (so the canonical fixtures from
// supabase/seed.sql exist) and layer additional, predictable state changes
// on top of the baseline.
//
// Each helper uses a fixed UUID range so `resetToBaseline()` can scrub them
// without disturbing the seed:
//   simulateFifoViolation     → f1000001-…
//   simulateQuotaExhaustion   → f2000001-…
//   simulateRecentFailureBurst→ f3000001-…
//   (f4000001-… reserved for future helpers)
//
// Run with Node ≥ 22 plus `--experimental-strip-types`, e.g.:
//   SUPABASE_SERVICE_ROLE_KEY=… node --experimental-strip-types scripts/dashboard-fixtures.ts
//
// Requires `@supabase/supabase-js` (already declared in package.json).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Fixed user UUIDs — must match supabase/seed.sql.
const USERS = {
  alice: '11111111-1111-1111-1111-111111111111',
  bob:   '22222222-2222-2222-2222-222222222222',
  carol: '33333333-3333-3333-3333-333333333333',
  dave:  '44444444-4444-4444-4444-444444444444',
  eve:   '55555555-5555-5555-5555-555555555555',
} as const;

// Fixture UUIDs (deterministic, so the reset path knows exactly what to remove).
const FIXTURE_IDS = {
  fifo: [
    'f1000001-0000-0000-0000-000000000001',
    'f1000001-0000-0000-0000-000000000002',
  ],
  quota: [
    'f2000001-0000-0000-0000-000000000001',
    'f2000001-0000-0000-0000-000000000002',
  ],
  burst: [
    'f3000001-0000-0000-0000-000000000001',
    'f3000001-0000-0000-0000-000000000002',
    'f3000001-0000-0000-0000-000000000003',
    'f3000001-0000-0000-0000-000000000004',
    'f3000001-0000-0000-0000-000000000005',
  ],
} as const;

export interface FixtureResult {
  ok: boolean;
  message: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function getClient(): Promise<SupabaseClient> {
  if (!supabaseKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — refusing to create a Supabase client.',
    );
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// ─── exported functions ─────────────────────────────────────────────────────

/**
 * Insert a deterministic FIFO-violation pair for alice. Both rows are
 * SFT/SUCCESS so they show up in the "completed" view; B was created
 * after A but started before A → fairness violation.
 */
export async function simulateFifoViolation(): Promise<FixtureResult> {
  try {
    const supabase = await getClient();
    const payload = {
      baseModel: 'accounts/fireworks/models/qwen3-14b',
      dataset: 'accounts/trilogy/datasets/fixture-fifo-v1',
      outputModel: 'accounts/trilogy/models/qwen3-14b-fixture-fifo',
      epochs: 3,
      learningRate: 0.0001,
    };
    const rows = [
      {
        id: FIXTURE_IDS.fifo[0],
        user_id: USERS.alice,
        kind: 'SFT',
        state: 'SUCCESS',
        display_name: 'fixture-fifo-job-A',
        gpu_count: 4,
        fireworks_payload: payload,
        fireworks_job_name: 'accounts/trilogy/fineTuningJobs/fixture-fifo-A',
        error: null,
        created_at: isoMinutesAgo(30),
        started_at: isoMinutesAgo(20),
        completed_at: isoMinutesAgo(5),
      },
      {
        id: FIXTURE_IDS.fifo[1],
        user_id: USERS.alice,
        kind: 'SFT',
        state: 'SUCCESS',
        display_name: 'fixture-fifo-job-B',
        gpu_count: 4,
        fireworks_payload: payload,
        fireworks_job_name: 'accounts/trilogy/fineTuningJobs/fixture-fifo-B',
        error: null,
        created_at: isoMinutesAgo(25),
        started_at: isoMinutesAgo(22),
        completed_at: isoMinutesAgo(10),
      },
    ];
    const { error } = await supabase.from('jobs').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    const result: FixtureResult = {
      ok: true,
      message: `simulateFifoViolation: inserted ${rows.length} jobs for alice (FIFO pair).`,
    };
    console.log(result);
    return result;
  } catch (err) {
    const result: FixtureResult = {
      ok: false,
      message: `simulateFifoViolation failed: ${(err as Error).message}`,
    };
    console.log(result);
    return result;
  }
}

/**
 * Insert two small PROGRESS jobs (4 + 3 = 7 GPUs) so the live GPU usage
 * climbs toward the 8-GPU quota wall.
 */
export async function simulateQuotaExhaustion(): Promise<FixtureResult> {
  try {
    const supabase = await getClient();
    const carolPayload = {
      baseModel: 'accounts/fireworks/models/qwen3-14b',
      dataset: 'accounts/trilogy/datasets/fixture-quota-v1',
      outputModel: 'accounts/trilogy/models/qwen3-14b-fixture-quota-carol',
      epochs: 3,
      learningRate: 0.0001,
    };
    const davePayload = {
      baseModel: 'accounts/fireworks/models/qwen3-14b',
      dataset: 'accounts/trilogy/datasets/fixture-quota-v1',
      outputModel: 'accounts/trilogy/models/qwen3-14b-fixture-quota-dave',
      epochs: 3,
      learningRate: 0.0001,
    };
    const rows = [
      {
        id: FIXTURE_IDS.quota[0],
        user_id: USERS.carol,
        kind: 'SFT',
        state: 'PROGRESS',
        display_name: 'fixture-quota-carol-4gpu',
        gpu_count: 4,
        fireworks_payload: carolPayload,
        fireworks_job_name: 'accounts/trilogy/fineTuningJobs/fixture-quota-carol',
        error: null,
        created_at: isoMinutesAgo(8),
        started_at: isoMinutesAgo(5),
        completed_at: null,
      },
      {
        id: FIXTURE_IDS.quota[1],
        user_id: USERS.dave,
        kind: 'SFT',
        state: 'PROGRESS',
        display_name: 'fixture-quota-dave-3gpu',
        gpu_count: 3,
        fireworks_payload: davePayload,
        fireworks_job_name: 'accounts/trilogy/fineTuningJobs/fixture-quota-dave',
        error: null,
        created_at: isoMinutesAgo(6),
        started_at: isoMinutesAgo(3),
        completed_at: null,
      },
    ];
    const { error } = await supabase.from('jobs').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    const result: FixtureResult = {
      ok: true,
      message:
        'simulateQuotaExhaustion: inserted PROGRESS jobs totalling 7 GPUs (carol 4 + dave 3).',
    };
    console.log(result);
    return result;
  } catch (err) {
    const result: FixtureResult = {
      ok: false,
      message: `simulateQuotaExhaustion failed: ${(err as Error).message}`,
    };
    console.log(result);
    return result;
  }
}

/**
 * Insert 5 FAIL jobs for eve in the last ~10 minutes, each with a
 * distinct error string so failure_class buckets exercise every branch.
 */
export async function simulateRecentFailureBurst(): Promise<FixtureResult> {
  try {
    const supabase = await getClient();
    const sftPayload = {
      baseModel: 'accounts/fireworks/models/qwen3-14b',
      dataset: 'accounts/trilogy/datasets/fixture-burst-v1',
      outputModel: 'accounts/trilogy/models/qwen3-14b-fixture-burst',
      epochs: 3,
      learningRate: 0.0001,
    };
    const errors = [
      'Fireworks 400 Bad Request: malformed jsonl line at row 42',
      'Fireworks 500 Internal Server Error: trainer crashed during eval',
      'cancelled externally by operator: emergency rollback',
      'quota exceeded: GPU budget consumed for the hour',
      'network timeout while uploading dataset shard',
    ];
    const rows = FIXTURE_IDS.burst.map((id, idx) => ({
      id,
      user_id: USERS.eve,
      kind: 'SFT' as const,
      state: 'FAIL' as const,
      display_name: `fixture-burst-${idx + 1}`,
      gpu_count: 4,
      fireworks_payload: sftPayload,
      fireworks_job_name: `accounts/trilogy/fineTuningJobs/fixture-burst-${idx + 1}`,
      error: errors[idx],
      created_at: isoMinutesAgo(10 - idx),
      started_at: isoMinutesAgo(9 - idx),
      completed_at: isoMinutesAgo(8 - idx),
    }));
    const { error } = await supabase.from('jobs').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    const result: FixtureResult = {
      ok: true,
      message: `simulateRecentFailureBurst: inserted ${rows.length} FAIL jobs for eve.`,
    };
    console.log(result);
    return result;
  } catch (err) {
    const result: FixtureResult = {
      ok: false,
      message: `simulateRecentFailureBurst failed: ${(err as Error).message}`,
    };
    console.log(result);
    return result;
  }
}

/**
 * Remove every row inserted by the simulate* helpers, restoring the
 * canonical baseline from supabase/seed.sql.
 */
export async function resetToBaseline(): Promise<FixtureResult> {
  try {
    const supabase = await getClient();
    const ids = [
      ...FIXTURE_IDS.fifo,
      ...FIXTURE_IDS.quota,
      ...FIXTURE_IDS.burst,
    ];
    const { error, count } = await supabase
      .from('jobs')
      .delete({ count: 'exact' })
      .in('id', ids);
    if (error) throw error;
    const result: FixtureResult = {
      ok: true,
      message: `resetToBaseline: removed ${count ?? 0} fixture rows.`,
    };
    console.log(result);
    return result;
  } catch (err) {
    const result: FixtureResult = {
      ok: false,
      message: `resetToBaseline failed: ${(err as Error).message}`,
    };
    console.log(result);
    return result;
  }
}
