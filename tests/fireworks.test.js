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

test('FireworksClient routes RFT to /reinforcementFineTuningJobs', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ name: 'r1', state: 'JOB_STATE_CREATING' }), { status: 200 });
  };
  const c = new FireworksClient('KEY', fakeFetch);
  await c.createJob('RFT', { dataset: 'x', evaluator: 'y' });
  assert.ok(calls[0].endsWith('/reinforcementFineTuningJobs'));
});

test('listActiveJobs reads SFT array under supervisedFineTuningJobs key', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        supervisedFineTuningJobs: [
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

test('listActiveJobs reads DPO array under dpoJobs key', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ dpoJobs: [{ name: 'd1', state: 'JOB_STATE_RUNNING' }] }),
      { status: 200 },
    );
  const c = new FireworksClient('KEY', fakeFetch);
  const active = await c.listActiveJobs('DPO');
  assert.deepEqual(active.map((j) => j.name), ['d1']);
});

test('listActiveJobs reads RFT array under reinforcementFineTuningJobs key', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        reinforcementFineTuningJobs: [
          { name: 'r1', state: 'JOB_STATE_RUNNING' },
          { name: 'r2', state: 'JOB_STATE_COMPLETED' },
        ],
      }),
      { status: 200 },
    );
  const c = new FireworksClient('KEY', fakeFetch);
  const active = await c.listActiveJobs('RFT');
  assert.deepEqual(active.map((j) => j.name), ['r1']);
});

test('listActiveJobs falls back to body.jobs for forward compatibility', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ jobs: [{ name: 'fallback', state: 'JOB_STATE_RUNNING' }] }),
      { status: 200 },
    );
  const c = new FireworksClient('KEY', fakeFetch);
  const active = await c.listActiveJobs('SFT');
  assert.deepEqual(active.map((j) => j.name), ['fallback']);
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

test('listActiveJobsAllKinds fans out to all three endpoints (SFT+DPO+RFT)', async () => {
  const hits = [];
  const fakeFetch = async (url) => {
    hits.push(url);
    if (url.endsWith('/supervisedFineTuningJobs')) {
      return new Response(JSON.stringify({ supervisedFineTuningJobs: [{ name: 's1', state: 'JOB_STATE_RUNNING' }] }), { status: 200 });
    }
    if (url.endsWith('/dpoJobs')) {
      return new Response(JSON.stringify({ dpoJobs: [{ name: 'd1', state: 'JOB_STATE_RUNNING' }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ reinforcementFineTuningJobs: [{ name: 'r1', state: 'JOB_STATE_RUNNING' }] }), { status: 200 });
  };
  const c = new FireworksClient('KEY', fakeFetch);
  const all = await c.listActiveJobsAllKinds();
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((a) => a.kind).sort(), ['DPO', 'RFT', 'SFT']);
  assert.ok(hits.some((u) => u.endsWith('/supervisedFineTuningJobs')));
  assert.ok(hits.some((u) => u.endsWith('/dpoJobs')));
  assert.ok(hits.some((u) => u.endsWith('/reinforcementFineTuningJobs')));
});

test('cancelJob SFT sends DELETE (no :cancel endpoint exists)', async () => {
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

test('cancelJob DPO sends DELETE (no :cancel endpoint exists)', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, method: init?.method });
    return new Response('{}', { status: 200 });
  };
  const c = new FireworksClient('KEY', fakeFetch);
  await c.cancelJob('DPO', 'accounts/trilogy/dpoJobs/d1');
  assert.equal(calls[0].method, 'DELETE');
  assert.ok(!calls[0].url.includes(':cancel'));
});

test('cancelJob RFT sends POST :cancel (asymmetric — only RFT has :cancel)', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, method: init?.method });
    return new Response('{}', { status: 200 });
  };
  const c = new FireworksClient('KEY', fakeFetch);
  await c.cancelJob('RFT', 'accounts/trilogy/reinforcementFineTuningJobs/r1');
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].url.endsWith('/reinforcementFineTuningJobs/r1:cancel'));
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
