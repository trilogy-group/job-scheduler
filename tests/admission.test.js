// Unit tests for the admission loop.
//
// These lock in the spec's FIFO + per-user-cap + GPU-budget semantics
// without needing Postgres or a live Fireworks instance.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAdmission } from '../supabase/functions/scheduler-tick/admission.ts';

function mkJob(id, user, kind = 'SFT', gpu = 4, created_at = `2026-04-20T00:00:0${id}Z`) {
  return { id, user_id: user, kind, gpu_count: gpu, created_at };
}

function alwaysOk(namePrefix = 'fw-') {
  return async (job) => ({ ok: true, fireworks_job_name: namePrefix + job.id });
}

test('FIFO: simple queue with budget to spare', async () => {
  // 2 users, 1 job each, budget 2 slots (8 GPU / 4 per job)
  const queue = [mkJob(1, 'alice'), mkJob(2, 'bob')];
  const steps = await runAdmission(queue, new Set(), 8, alwaysOk());
  assert.deepEqual(steps.map((s) => s.outcome.status), ['admit', 'admit']);
  assert.equal(steps[0].outcome.fireworks_job_name, 'fw-1');
});

test("per-user cap: praveen's 3 jobs + samkit + anirudh scenario", async () => {
  // User's original walk-through from the spec discussion:
  //   praveen enqueues at t=0,1,2; samkit at t=3; anirudh at t=4.
  //   budget = 2 slots (8 GPUs / 4 per job, each job uses 4).
  //
  // Expected over three ticks:
  //   Tick 1: admit P1 + S1    (P2, P3 skipped — praveen already active)
  //   Tick 2: admit P2 + A1    (praveen + anirudh free again)
  //   Tick 3: admit P3         (only job left)

  const mkFq = (id, user) => ({
    id, user_id: user, kind: 'SFT', gpu_count: 4,
    created_at: `2026-04-20T00:00:0${id}Z`,
  });
  const initial = [
    mkFq(1, 'praveen'), mkFq(2, 'praveen'), mkFq(3, 'praveen'),
    mkFq(4, 'samkit'),  mkFq(5, 'anirudh'),
  ];

  // --- Tick 1 ---
  let steps = await runAdmission(initial, new Set(), 8, alwaysOk());
  const admitted1 = steps.filter((s) => s.outcome.status === 'admit').map((s) => s.job.id);
  assert.deepEqual(admitted1, [1, 4]);
  // P2 and P3 must be "skip_user_active"; A1 is blocked by GPU budget → stop.
  assert.equal(steps.find((s) => s.job.id === 2).outcome.status, 'skip_user_active');
  assert.equal(steps.find((s) => s.job.id === 3).outcome.status, 'skip_user_active');
  assert.equal(steps.find((s) => s.job.id === 5).outcome.status, 'stop_insufficient_gpu');

  // --- Tick 2 (P1, S1 finished → remove; praveen + samkit free) ---
  const afterTick1 = initial.filter((j) => ![1, 4].includes(j.id));
  steps = await runAdmission(afterTick1, new Set(), 8, alwaysOk());
  const admitted2 = steps.filter((s) => s.outcome.status === 'admit').map((s) => s.job.id);
  assert.deepEqual(admitted2, [2, 5]); // P2 (praveen), then P3 skipped, then A1

  // --- Tick 3 (P2, A1 finished) ---
  const afterTick2 = afterTick1.filter((j) => ![2, 5].includes(j.id));
  steps = await runAdmission(afterTick2, new Set(), 8, alwaysOk());
  const admitted3 = steps.filter((s) => s.outcome.status === 'admit').map((s) => s.job.id);
  assert.deepEqual(admitted3, [3]);
});

test('GPU budget: earliest eligible that does not fit stops the tick', async () => {
  // queue: job(8) for alice, job(4) for bob. budget = 4.
  // alice's job is FIFO-first AND eligible (alice is free) AND doesn't fit →
  // we must stop. bob must NOT be admitted even though his job would fit.
  const queue = [mkJob(1, 'alice', 'SFT', 8), mkJob(2, 'bob', 'SFT', 4)];
  const steps = await runAdmission(queue, new Set(), 4, alwaysOk());
  assert.equal(steps[0].outcome.status, 'stop_insufficient_gpu');
  assert.equal(steps.length, 1, 'should stop after first ineligible-by-GPU candidate');
});

test('already-active user is skipped, smaller job behind them can admit', async () => {
  // alice is already PROGRESS. Her queued job is skipped; bob's follows.
  const queue = [mkJob(1, 'alice', 'SFT', 4), mkJob(2, 'bob', 'SFT', 4)];
  const steps = await runAdmission(queue, new Set(['alice']), 8, alwaysOk());
  assert.equal(steps[0].outcome.status, 'skip_user_active');
  assert.equal(steps[1].outcome.status, 'admit');
});

test('quota error stops admission for the rest of the tick', async () => {
  const queue = [mkJob(1, 'alice'), mkJob(2, 'bob'), mkJob(3, 'carol')];
  let call = 0;
  const submit = async (job) => {
    call++;
    if (call === 1) return { ok: true, fireworks_job_name: 'fw-1' };
    if (call === 2) return { ok: false, kind: 'quota' };
    throw new Error('should not be called after quota error');
  };
  const steps = await runAdmission(queue, new Set(), 12, submit);
  assert.equal(steps[0].outcome.status, 'admit');
  assert.equal(steps[1].outcome.status, 'submit_quota_error');
  assert.equal(steps.length, 2);
});

test('non-quota 4xx marks FAIL and continues', async () => {
  const queue = [mkJob(1, 'alice'), mkJob(2, 'bob')];
  const submit = async (job) => {
    if (job.id === 1) return { ok: false, kind: 'client_error', status: 400, body: 'bad payload' };
    return { ok: true, fireworks_job_name: 'fw-2' };
  };
  const steps = await runAdmission(queue, new Set(), 8, submit);
  assert.equal(steps[0].outcome.status, 'submit_failed');
  assert.equal(steps[0].outcome.status_code, 400);
  assert.equal(steps[1].outcome.status, 'admit');
});

test('FIFO is kind-agnostic: DPO submitted before SFT if earlier created_at', async () => {
  const queue = [
    mkJob(1, 'alice', 'DPO', 4, '2026-04-20T00:00:00Z'),
    mkJob(2, 'alice', 'SFT', 4, '2026-04-20T00:00:01Z'),
  ];
  // alice's DPO is first; her SFT should be skipped (user-active after DPO admits)
  const steps = await runAdmission(queue, new Set(), 8, alwaysOk());
  assert.equal(steps[0].job.kind, 'DPO');
  assert.equal(steps[0].outcome.status, 'admit');
  assert.equal(steps[1].job.kind, 'SFT');
  assert.equal(steps[1].outcome.status, 'skip_user_active');
});

test('per-user cap spans kinds: alice active with DPO blocks her SFT', async () => {
  const queue = [mkJob(1, 'alice', 'SFT', 4)];
  const steps = await runAdmission(queue, new Set(['alice']), 8, alwaysOk());
  assert.equal(steps[0].outcome.status, 'skip_user_active');
});

test('empty queue returns empty steps', async () => {
  const steps = await runAdmission([], new Set(), 8, alwaysOk());
  assert.deepEqual(steps, []);
});
