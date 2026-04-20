// Node-side tests for the Fireworks helper. Node 23+ strips types from .ts
// imports natively, so we import the real module (no shim, no build step).
// Network is mocked via an injected fetchImpl.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isQuotaExhaustion, extractGpuCount, isTerminal, FireworksClient } from '../supabase/functions/_shared/fireworks.ts';

test('isQuotaExhaustion matches the canonical Fireworks error', () => {
  assert.equal(
    isQuotaExhaustion(429, 'training-h200-count for account trilogy, in use: 8, quota: 8'),
    true,
  );
  assert.equal(isQuotaExhaustion(400, 'in use: 8, quota: 8'), true);
});

test('isQuotaExhaustion rejects unrelated 4xx', () => {
  assert.equal(isQuotaExhaustion(400, 'invalid field foo'), false);
  assert.equal(isQuotaExhaustion(500, 'in use: 8, quota: 8'), false);
  assert.equal(isQuotaExhaustion(429, 'rate limited'), false);
});

test('isQuotaExhaustion ignores in-use < quota', () => {
  assert.equal(isQuotaExhaustion(429, 'in use: 4, quota: 8'), false);
});

test('extractGpuCount falls back when fields are absent', () => {
  assert.equal(extractGpuCount({ name: 'x', state: 'RUNNING' }), 4);
  assert.equal(extractGpuCount({ name: 'x', state: 'RUNNING', gpuCount: 8 }), 8);
  assert.equal(extractGpuCount({ name: 'x', state: 'RUNNING', gpu_count: 2 }), 2);
});

test('isTerminal detects JOB_STATE_* terminals', () => {
  assert.equal(isTerminal('JOB_STATE_COMPLETED'), true);
  assert.equal(isTerminal('JOB_STATE_FAILED'), true);
  assert.equal(isTerminal('JOB_STATE_CANCELLED'), true);
  assert.equal(isTerminal('JOB_STATE_EXPIRED'), true);
  assert.equal(isTerminal('JOB_STATE_EARLY_STOPPED'), true);
  assert.equal(isTerminal('JOB_STATE_RUNNING'), false);
  assert.equal(isTerminal('JOB_STATE_CANCELLING'), false);
  assert.equal(isTerminal('COMPLETED'), false); // unprefixed is NOT terminal — old bug
  assert.equal(isTerminal(undefined), false);
});

test('FireworksClient routes SFT to /supervisedFineTuningJobs', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ name: 'j1', state: 'CREATED' }), { status: 200 });
  };
  const c = new FireworksClient('KEY', fakeFetch);
  await c.createJob('SFT', { displayName: 'foo' });
  assert.ok(calls[0].url.endsWith('/supervisedFineTuningJobs'));
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer KEY');
});

test('FireworksClient routes DPO to /dpoJobs', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ name: 'j2', state: 'CREATED' }), { status: 200 });
  };
  const c = new FireworksClient('KEY', fakeFetch);
  await c.createJob('DPO', {});
  assert.ok(calls[0].endsWith('/dpoJobs'));
});

test('listActiveJobs filters out terminal states', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        jobs: [
          { name: 'a', state: 'JOB_STATE_RUNNING' },
          { name: 'b', state: 'JOB_STATE_COMPLETED' },
          { name: 'c', state: 'JOB_STATE_CREATING' },
          { name: 'd', state: 'JOB_STATE_FAILED' },
          { name: 'e', state: 'JOB_STATE_EXPIRED' },
        ],
      }),
      { status: 200 },
    );
  const c = new FireworksClient('KEY', fakeFetch);
  const active = await c.listActiveJobs('SFT');
  assert.deepEqual(active.map((j) => j.name), ['a', 'c']);
});

test('createJob surfaces quota errors with isQuotaError=true', async () => {
  const fakeFetch = async () =>
    new Response('in use: 8, quota: 8', { status: 429 });
  const c = new FireworksClient('KEY', fakeFetch);
  try {
    await c.createJob('SFT', {});
    assert.fail('expected throw');
  } catch (e) {
    assert.equal(e.status, 429);
    assert.equal(e.isQuotaError, true);
  }
});

test('createJob surfaces non-quota 4xx with isQuotaError=false', async () => {
  const fakeFetch = async () =>
    new Response('missing baseModel', { status: 400 });
  const c = new FireworksClient('KEY', fakeFetch);
  try {
    await c.createJob('SFT', {});
    assert.fail('expected throw');
  } catch (e) {
    assert.equal(e.status, 400);
    assert.equal(e.isQuotaError, false);
  }
});

test('listActiveJobsAllKinds fans out to both endpoints', async () => {
  const hits = [];
  const fakeFetch = async (url) => {
    hits.push(url);
    if (url.endsWith('/supervisedFineTuningJobs')) {
      return new Response(JSON.stringify({ jobs: [{ name: 's1', state: 'JOB_STATE_RUNNING' }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ jobs: [{ name: 'd1', state: 'JOB_STATE_RUNNING' }] }), { status: 200 });
  };
  const c = new FireworksClient('KEY', fakeFetch);
  const all = await c.listActiveJobsAllKinds();
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((a) => a.kind).sort(), ['DPO', 'SFT']);
  assert.ok(hits.some((u) => u.endsWith('/supervisedFineTuningJobs')));
  assert.ok(hits.some((u) => u.endsWith('/dpoJobs')));
});

test('cancelJob sends DELETE (not POST :cancel)', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, method: init?.method });
    return new Response('{}', { status: 200 });
  };
  const c = new FireworksClient('KEY', fakeFetch);
  await c.cancelJob('SFT', 'accounts/trilogy/supervisedFineTuningJobs/abc123');
  assert.equal(calls[0].method, 'DELETE');
  assert.ok(calls[0].url.endsWith('/supervisedFineTuningJobs/abc123'));
  assert.ok(!calls[0].url.includes(':cancel'));
});

test('getTrainingGpuQuota finds matching quota by name pattern', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        quotas: [
          { name: 'some-other-quota', value: '100', maxValue: '100', usage: 5 },
          { name: 'training-h200-count', value: '8', maxValue: '8', usage: 4 },
        ],
      }),
      { status: 200 },
    );
  const c = new FireworksClient('KEY', fakeFetch);
  const q = await c.getTrainingGpuQuota();
  assert.equal(q.name, 'training-h200-count');
  assert.equal(q.maxValue, 8);
  assert.equal(q.usage, 4);
});

test('getTrainingGpuQuota throws when no matching quota', async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ quotas: [{ name: 'unrelated' }] }), { status: 200 });
  const c = new FireworksClient('KEY', fakeFetch);
  await assert.rejects(() => c.getTrainingGpuQuota(), /no quota matching/);
});
