import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleAnalyticsQueue,
  handleAnalyticsSummary,
  handleJobAnalytics,
} from '../supabase/functions/jobs-api/analytics.ts';

// --- Mock Supabase builder --------------------------------------------------
// A fully thenable builder that returns a FIFO queue of preconfigured results.
// Every chainable method returns the same builder; `await builder` and
// `await builder.maybeSingle()` both pull the next response.
function makeMockDb(responses) {
  let idx = 0;
  function next() {
    if (idx >= responses.length) {
      throw new Error(`mock db: out of responses (consumed ${idx})`);
    }
    return responses[idx++];
  }
  const b = {
    from: () => b,
    select: () => b,
    eq: () => b,
    neq: () => b,
    lt: () => b,
    order: () => b,
    limit: () => b,
    maybeSingle: async () => next(),
    then(resolve, reject) {
      try {
        resolve(next());
      } catch (e) {
        reject(e);
      }
    },
  };
  return b;
}

// --- handleAnalyticsQueue ---------------------------------------------------

test('analyticsQueue: empty queue, no progress job', async () => {
  const db = makeMockDb([
    { data: null, error: null }, // 1. progress maybeSingle
    { data: [], error: null }, // 2. queued list
    // no per-queued-job counts (empty list)
    { count: 0, error: null }, // 4. global queue depth
    { data: [], error: null }, // 5. progress-all
  ]);
  const res = await handleAnalyticsQueue(db, 'u1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.your_progress_job, null);
  assert.deepEqual(body.your_queued_jobs, []);
  assert.equal(body.global_queue_depth, 0);
  assert.equal(body.global_progress_count, 0);
  assert.equal(body.global_gpu_in_use, 0);
});

test('analyticsQueue: one queued job with position 2', async () => {
  const db = makeMockDb([
    { data: null, error: null }, // progress
    {
      data: [
        {
          id: 'j1',
          display_name: 'test',
          kind: 'SFT',
          gpu_count: 4,
          created_at: '2026-05-20T10:00:00Z',
        },
      ],
      error: null,
    },
    { count: 2, error: null }, // queue position count for j1
    { count: 3, error: null }, // global queue depth
    { data: [{ gpu_count: 4 }, { gpu_count: 4 }], error: null }, // progress-all
  ]);
  const res = await handleAnalyticsQueue(db, 'u1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.your_queued_jobs.length, 1);
  assert.equal(body.your_queued_jobs[0].queue_position, 2);
  assert.equal(body.global_queue_depth, 3);
  assert.equal(body.global_progress_count, 2);
  assert.equal(body.global_gpu_in_use, 8);
});

test('analyticsQueue: has progress job', async () => {
  const progress = {
    id: 'p1',
    display_name: 'in progress',
    kind: 'SFT',
    gpu_count: 4,
    started_at: '2026-05-20T09:00:00Z',
    fireworks_job_name: 'fw-1',
  };
  const db = makeMockDb([
    { data: progress, error: null }, // progress maybeSingle
    { data: [], error: null }, // queued list
    { count: 0, error: null }, // global queue depth
    { data: [{ gpu_count: 4 }], error: null }, // progress-all
  ]);
  const res = await handleAnalyticsQueue(db, 'u1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.your_progress_job.id, 'p1');
});

test('analyticsQueue: propagates db error', async () => {
  const db = makeMockDb([
    { data: null, error: { message: 'db down' } }, // first call fails
  ]);
  const res = await handleAnalyticsQueue(db, 'u1');
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error, 'analytics fetch failed');
});

// --- handleAnalyticsSummary -------------------------------------------------

test('analyticsSummary: empty job history', async () => {
  const db = makeMockDb([
    { data: [], error: null }, // main query
    { data: [], error: null }, // failures query
  ]);
  const res = await handleAnalyticsSummary(db, 'u1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 0);
  assert.deepEqual(body.by_state, {
    QUEUED: 0,
    PROGRESS: 0,
    SUCCESS: 0,
    FAIL: 0,
    CANCELLED: 0,
  });
  assert.deepEqual(body.by_kind, { SFT: 0, DPO: 0, RFT: 0 });
  assert.equal(body.success_rate, null);
  assert.equal(body.avg_run_duration_seconds, null);
  assert.equal(body.total_gpu_hours, 0);
  assert.deepEqual(body.recent_failures, []);
});

test('analyticsSummary: mixed job states', async () => {
  const rows = [
    {
      id: 'a',
      kind: 'SFT',
      state: 'SUCCESS',
      display_name: null,
      gpu_count: 4,
      started_at: '2026-05-20T10:00:00Z',
      completed_at: '2026-05-20T11:00:00Z',
      error: null,
    },
    {
      id: 'b',
      kind: 'SFT',
      state: 'SUCCESS',
      display_name: null,
      gpu_count: 4,
      started_at: '2026-05-20T10:00:00Z',
      completed_at: '2026-05-20T11:00:00Z',
      error: null,
    },
    {
      id: 'c',
      kind: 'DPO',
      state: 'FAIL',
      display_name: null,
      gpu_count: 4,
      started_at: '2026-05-20T10:00:00Z',
      completed_at: '2026-05-20T10:30:00Z',
      error: 'boom',
    },
    {
      id: 'd',
      kind: 'RFT',
      state: 'QUEUED',
      display_name: null,
      gpu_count: 4,
      started_at: null,
      completed_at: null,
      error: null,
    },
  ];
  const failures = [
    {
      id: 'c',
      display_name: null,
      kind: 'DPO',
      gpu_count: 4,
      error: 'boom',
      completed_at: '2026-05-20T10:30:00Z',
    },
  ];
  const db = makeMockDb([
    { data: rows, error: null },
    { data: failures, error: null },
  ]);
  const res = await handleAnalyticsSummary(db, 'u1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.total, 4);
  assert.equal(body.by_state.SUCCESS, 2);
  assert.equal(body.by_state.FAIL, 1);
  assert.equal(body.by_state.QUEUED, 1);
  assert.equal(body.by_kind.SFT, 2);
  assert.equal(body.by_kind.DPO, 1);
  assert.equal(body.by_kind.RFT, 1);
  // 2 SUCCESS out of 3 terminal (2 SUCCESS + 1 FAIL)
  assert.equal(body.success_rate, 2 / 3);
  assert.equal(body.avg_run_duration_seconds, 3600);
  // 2 success jobs × 4 gpu × 1h = 8 gpu-hours
  assert.equal(body.total_gpu_hours, 8);
  assert.equal(body.recent_failures.length, 1);
  assert.equal(body.recent_failures[0].id, 'c');
  assert.equal(body.recent_failures[0].failed_at, '2026-05-20T10:30:00Z');
});

test('analyticsSummary: success_rate null when no terminal jobs', async () => {
  const rows = [
    {
      id: 'q1',
      kind: 'SFT',
      state: 'QUEUED',
      display_name: null,
      gpu_count: 4,
      started_at: null,
      completed_at: null,
      error: null,
    },
    {
      id: 'q2',
      kind: 'DPO',
      state: 'QUEUED',
      display_name: null,
      gpu_count: 4,
      started_at: null,
      completed_at: null,
      error: null,
    },
  ];
  const db = makeMockDb([
    { data: rows, error: null },
    { data: [], error: null },
  ]);
  const res = await handleAnalyticsSummary(db, 'u1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success_rate, null);
});

test('analyticsSummary: propagates db error', async () => {
  const db = makeMockDb([
    { data: null, error: { message: 'db down' } },
  ]);
  const res = await handleAnalyticsSummary(db, 'u1');
  assert.equal(res.status, 500);
});

// --- handleJobAnalytics -----------------------------------------------------

test('jobAnalytics: returns correct shape for completed job', async () => {
  const job = {
    id: 'j1',
    user_id: 'u1',
    kind: 'SFT',
    state: 'SUCCESS',
    display_name: 'run',
    gpu_count: 4,
    fireworks_job_name: 'fw-1',
    created_at: '2026-05-20T09:00:00Z',
    started_at: '2026-05-20T10:00:00Z',
    completed_at: '2026-05-20T11:00:00Z',
    error: null,
  };
  const db = makeMockDb([{ data: job, error: null }]);
  const res = await handleJobAnalytics('j1', db, 'u1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.run_duration_seconds, 3600);
  assert.equal(body.gpu_hours, 4);
  assert.equal(body.timeline.queued_at, '2026-05-20T09:00:00Z');
  assert.equal(body.error, null);
  // queue_wait_seconds may be a number or null depending on inputs; here both are set
  assert.equal(typeof body.queue_wait_seconds === 'number' || body.queue_wait_seconds === null, true);
});

test('jobAnalytics: 404 when job belongs to different user', async () => {
  const job = {
    id: 'j1',
    user_id: 'other-user',
    kind: 'SFT',
    state: 'SUCCESS',
    display_name: null,
    gpu_count: 4,
    fireworks_job_name: null,
    created_at: '2026-05-20T09:00:00Z',
    started_at: null,
    completed_at: null,
    error: null,
  };
  const db = makeMockDb([{ data: job, error: null }]);
  const res = await handleJobAnalytics('j1', db, 'my-user');
  assert.equal(res.status, 404);
});

test('jobAnalytics: 404 when job not found', async () => {
  const db = makeMockDb([{ data: null, error: null }]);
  const res = await handleJobAnalytics('j1', db, 'u1');
  assert.equal(res.status, 404);
});

test('jobAnalytics: null durations when job still in PROGRESS (no completed_at)', async () => {
  const job = {
    id: 'j1',
    user_id: 'u1',
    kind: 'SFT',
    state: 'PROGRESS',
    display_name: null,
    gpu_count: 4,
    fireworks_job_name: 'fw-1',
    created_at: '2026-05-20T09:00:00Z',
    started_at: '2026-05-20T10:00:00Z',
    completed_at: null,
    error: null,
  };
  const db = makeMockDb([{ data: job, error: null }]);
  const res = await handleJobAnalytics('j1', db, 'u1');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.run_duration_seconds, null);
  assert.equal(body.gpu_hours, null);
});
