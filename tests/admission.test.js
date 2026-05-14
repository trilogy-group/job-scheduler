// Unit tests for the admission loop.
//
// These lock in the spec's bucketed per-user cap + big-headroom semantics
// without needing Postgres or a live Fireworks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runAdmission,
  MAX_SMALL_JOBS_PER_USER,
  MAX_BIG_JOBS_PER_USER,
  BIG_JOB_HEADROOM_RESERVE,
} from '../supabase/functions/scheduler-tick/admission.ts';
import { mkJob } from './fixtures/jobs.js';

function alwaysOk(namePrefix = 'fw-') {
  return async (job) => ({ ok: true, fireworks_job_name: namePrefix + job.id });
}

const M = (entries = []) => new Map(entries);

test('expected constants', () => {
  assert.equal(MAX_SMALL_JOBS_PER_USER, 2);
  assert.equal(MAX_BIG_JOBS_PER_USER, 1);
  assert.equal(BIG_JOB_HEADROOM_RESERVE, 4);
});

test('FIFO: simple queue with budget to spare', async () => {
  const queue = [mkJob(1, 'alice'), mkJob(2, 'bob')];
  const steps = await runAdmission(queue, M(), M(), 8, alwaysOk());
  assert.deepEqual(steps.map((s) => s.outcome.status), ['admit', 'admit']);
});

test('per-user small cap: 3 small from same user → admit 2, skip 3rd', async () => {
  const queue = [
    mkJob(1, 'praveen'), mkJob(2, 'praveen'), mkJob(3, 'praveen'),
  ];
  const steps = await runAdmission(queue, M(), M(), 16, alwaysOk());
  assert.deepEqual(steps.map((s) => s.outcome.status), [
    'admit', 'admit', 'skip_user_small_cap',
  ]);
});

test('per-user small cap: prior active counts toward cap', async () => {
  // alice already has 1 small running; she can admit 1 more, then capped.
  const queue = [mkJob(1, 'alice'), mkJob(2, 'alice')];
  const steps = await runAdmission(queue, M([['alice', 1]]), M(), 16, alwaysOk());
  assert.deepEqual(steps.map((s) => s.outcome.status), ['admit', 'skip_user_small_cap']);
});

test('per-user small cap is per-user: bob unaffected when alice is capped', async () => {
  // alice already at small cap. bob can still admit. alice's queued small is skipped (continue-style).
  const queue = [mkJob(1, 'alice'), mkJob(2, 'bob')];
  const steps = await runAdmission(queue, M([['alice', 2]]), M(), 8, alwaysOk());
  assert.equal(steps[0].outcome.status, 'skip_user_small_cap');
  assert.equal(steps[1].outcome.status, 'admit');
});

test('per-user big cap: 2 bigs from same user → admit 1, skip 2nd', async () => {
  const queue = [mkJob(1, 'alice', 'SFT', 8), mkJob(2, 'alice', 'SFT', 8)];
  const steps = await runAdmission(queue, M(), M(), 32, alwaysOk());
  assert.deepEqual(steps.map((s) => s.outcome.status), ['admit', 'skip_user_big_cap']);
});

test('per-user big cap: prior big active blocks user', async () => {
  const queue = [mkJob(1, 'alice', 'SFT', 8)];
  const steps = await runAdmission(queue, M(), M([['alice', 1]]), 32, alwaysOk());
  assert.equal(steps[0].outcome.status, 'skip_user_big_cap');
});

test('big-headroom rule: big job with insufficient post-admit headroom is skipped', async () => {
  // budget=10, big job wants 8. 10-8=2 < 4 → skip_big_headroom.
  const queue = [mkJob(1, 'alice', 'SFT', 8)];
  const steps = await runAdmission(queue, M(), M(), 10, alwaysOk());
  assert.equal(steps[0].outcome.status, 'skip_big_headroom');
});

test('big-headroom rule: at the boundary (post-admit headroom = 4) admits', async () => {
  // budget=12, big wants 8. 12-8=4 → 4 >= 4 → admit.
  const queue = [mkJob(1, 'alice', 'SFT', 8)];
  const steps = await runAdmission(queue, M(), M(), 12, alwaysOk());
  assert.equal(steps[0].outcome.status, 'admit');
});

test('big-headroom rule: skipped big does not block smaller queued job', async () => {
  // budget=10, big8 can't fit headroom, but small4 behind it can admit.
  const queue = [mkJob(1, 'alice', 'SFT', 8), mkJob(2, 'bob', 'SFT', 4)];
  const steps = await runAdmission(queue, M(), M(), 10, alwaysOk());
  assert.equal(steps[0].outcome.status, 'skip_big_headroom');
  assert.equal(steps[1].outcome.status, 'admit');
});

test('big admissions across multiple users: budget+headroom limits the count', async () => {
  // 32-GPU budget, three different-user 8-GPU bigs:
  //   admit a (24 left) → admit b (16 left) → admit c (8 left, 8-8=0 < 4 NEXT one would skip)
  // Actually for c: budget=16 before admit, 16-8=8 >= 4 → admit. After: budget=8.
  // A 4th big would fail headroom.
  const queue = [
    mkJob(1, 'alice', 'SFT', 8),
    mkJob(2, 'bob',   'SFT', 8),
    mkJob(3, 'carol', 'SFT', 8),
    mkJob(4, 'dave',  'SFT', 8),
  ];
  const steps = await runAdmission(queue, M(), M(), 32, alwaysOk());
  assert.deepEqual(steps.map((s) => s.outcome.status), [
    'admit', 'admit', 'admit', 'skip_big_headroom',
  ]);
});

test('mixed queue: bigs and smalls coexist under the new rules', async () => {
  // budget=24. Queue: alice_big8, bob_small4, alice_small4 (alice will be at her small cap=1+1=2 after 2nd).
  // step1: alice_big8: per-user big cap 0/1 OK; headroom 24-8=16>=4 → admit. budget=16. bigByUser[alice]=1.
  // step2: bob_small4: per-user small cap 0/2 OK; budget 16>=4 → admit. budget=12. smallByUser[bob]=1.
  // step3: alice_small4: per-user small cap 0/2 OK (different bucket from big); budget 12>=4 → admit. budget=8.
  const queue = [
    mkJob(1, 'alice', 'SFT', 8),
    mkJob(2, 'bob',   'SFT', 4),
    mkJob(3, 'alice', 'SFT', 4),
  ];
  const steps = await runAdmission(queue, M(), M(), 24, alwaysOk());
  assert.deepEqual(steps.map((s) => s.outcome.status), ['admit', 'admit', 'admit']);
});

test('FIFO across kinds: DPO before SFT if earlier created_at; both admit since per-user small cap is 2', async () => {
  const queue = [
    mkJob(1, 'alice', 'DPO', 4, '2026-04-20T00:00:00Z'),
    mkJob(2, 'alice', 'SFT', 4, '2026-04-20T00:00:01Z'),
  ];
  const steps = await runAdmission(queue, M(), M(), 8, alwaysOk());
  assert.equal(steps[0].outcome.status, 'admit');
  assert.equal(steps[0].job.kind, 'DPO');
  assert.equal(steps[1].outcome.status, 'admit');
  assert.equal(steps[1].job.kind, 'SFT');
});

test('insufficient_gpu still stops for small candidates', async () => {
  // budget=2, small wants 4: can't fit even though cap is fine. Per spec, stop.
  const queue = [mkJob(1, 'alice'), mkJob(2, 'bob')];
  const steps = await runAdmission(queue, M(), M(), 2, alwaysOk());
  assert.equal(steps[0].outcome.status, 'stop_insufficient_gpu');
  assert.equal(steps.length, 1);
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
  const steps = await runAdmission(queue, M(), M(), 12, submit);
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
  const steps = await runAdmission(queue, M(), M(), 8, submit);
  assert.equal(steps[0].outcome.status, 'submit_failed');
  assert.equal(steps[0].outcome.status_code, 400);
  assert.equal(steps[1].outcome.status, 'admit');
});

test('empty queue returns empty steps', async () => {
  const steps = await runAdmission([], M(), M(), 8, alwaysOk());
  assert.deepEqual(steps, []);
});
