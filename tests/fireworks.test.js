// Node-side tests for the Fireworks provider adapter.
// Network is mocked via an injected fetchImpl.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isQuotaExhaustion,
  isFireworksError,
  FireworksProvider,
  mapFireworksTerminal,
} from '../supabase/functions/_shared/fireworks-provider.ts';
import { extractGpuCount, extractGpuCount as genericExtractGpuCount } from '../supabase/functions/_shared/providers.ts';

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
  assert.equal(extractGpuCount({ provider_job_id: 'x', state: 'RUNNING' }), 4);
  assert.equal(extractGpuCount({ provider_job_id: 'x', state: 'RUNNING', gpuCount: 8 }), 8);
  assert.equal(extractGpuCount({ provider_job_id: 'x', state: 'RUNNING', gpu_count: 2 }), 2);
});

test('generic extractGpuCount also works', () => {
  assert.equal(genericExtractGpuCount({ provider_job_id: 'x', state: 'RUNNING' }), 4);
  assert.equal(genericExtractGpuCount({ provider_job_id: 'x', state: 'RUNNING', gpuCount: 8 }), 8);
});

test('mapFireworksTerminal maps completed to SUCCESS', () => {
  const m = mapFireworksTerminal('JOB_STATE_COMPLETED');
  assert.equal(m.state, 'SUCCESS');
  assert.equal(m.errorText({}), null);
});

test('mapFireworksTerminal maps cancelled to CANCELLED', () => {
  const m = mapFireworksTerminal('JOB_STATE_CANCELLED');
  assert.equal(m.state, 'CANCELLED');
});

test('mapFireworksTerminal maps failed to FAIL', () => {
  const m = mapFireworksTerminal('JOB_STATE_FAILED');
  assert.equal(m.state, 'FAIL');
  assert.equal(m.errorText({ error: 'boom' }), 'boom');
  assert.equal(m.errorText({ message: 'msg' }), 'msg');
  assert.equal(m.errorText({}), null);
});

test('FireworksProvider routes SFT to /supervisedFineTuningJobs', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ name: 'j1', state: 'CREATED' }), { status: 200 });
  };
  const c = new FireworksProvider('KEY', fakeFetch);
  await c.submitJob('SFT', { displayName: 'foo' });
  assert.ok(calls[0].url.endsWith('/supervisedFineTuningJobs'));
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer KEY');
});

test('FireworksProvider routes DPO to /dpoJobs', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ name: 'j2', state: 'CREATED' }), { status: 200 });
  };
  const c = new FireworksProvider('KEY', fakeFetch);
  await c.submitJob('DPO', {});
  assert.ok(calls[0].endsWith('/dpoJobs'));
});

test('FireworksProvider routes RFT to /reinforcementFineTuningJobs', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ name: 'r1', state: 'JOB_STATE_CREATING' }), { status: 200 });
  };
  const c = new FireworksProvider('KEY', fakeFetch);
  await c.submitJob('RFT', { dataset: 'x', evaluator: 'y' });
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
  const c = new FireworksProvider('KEY', fakeFetch);
  const active = await c.listActiveJobs('SFT');
  assert.deepEqual(active.map((j) => j.provider_job_id), ['a', 'c']);
});

test('listActiveJobs reads DPO array under dpoJobs key', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ dpoJobs: [{ name: 'd1', state: 'JOB_STATE_RUNNING' }] }),
      { status: 200 },
    );
  const c = new FireworksProvider('KEY', fakeFetch);
  const active = await c.listActiveJobs('DPO');
  assert.deepEqual(active.map((j) => j.provider_job_id), ['d1']);
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
  const c = new FireworksProvider('KEY', fakeFetch);
  const active = await c.listActiveJobs('RFT');
  assert.deepEqual(active.map((j) => j.provider_job_id), ['r1']);
});

test('listActiveJobs falls back to body.jobs for forward compatibility', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ jobs: [{ name: 'fallback', state: 'JOB_STATE_RUNNING' }] }),
      { status: 200 },
    );
  const c = new FireworksProvider('KEY', fakeFetch);
  const active = await c.listActiveJobs('SFT');
  assert.deepEqual(active.map((j) => j.provider_job_id), ['fallback']);
});

test('submitJob surfaces quota errors with isQuotaError=true', async () => {
  const fakeFetch = async () =>
    new Response('in use: 8, quota: 8', { status: 429 });
  const c = new FireworksProvider('KEY', fakeFetch);
  try {
    await c.submitJob('SFT', {});
    assert.fail('expected throw');
  } catch (e) {
    assert.equal(e.status, 429);
    assert.equal(e.isQuotaError, true);
  }
});

test('submitJob surfaces non-quota 4xx with isQuotaError=false', async () => {
  const fakeFetch = async () =>
    new Response('missing baseModel', { status: 400 });
  const c = new FireworksProvider('KEY', fakeFetch);
  try {
    await c.submitJob('SFT', {});
    assert.fail('expected throw');
  } catch (e) {
    assert.equal(e.status, 400);
    assert.equal(e.isQuotaError, false);
  }
});

test('listActiveJobs fans out to all three endpoints when no kind given', async () => {
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
  const c = new FireworksProvider('KEY', fakeFetch);
  const all = await c.listActiveJobs();
  assert.equal(all.length, 3);
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
  const c = new FireworksProvider('KEY', fakeFetch);
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
  const c = new FireworksProvider('KEY', fakeFetch);
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
  const c = new FireworksProvider('KEY', fakeFetch);
  await c.cancelJob('RFT', 'accounts/trilogy/reinforcementFineTuningJobs/r1');
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].url.endsWith('/reinforcementFineTuningJobs/r1:cancel'));
});

test('getComputeCapacity finds matching quota by name pattern', async () => {
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
  const c = new FireworksProvider('KEY', fakeFetch);
  const q = await c.getComputeCapacity();
  assert.equal(q.totalGpus, 8);
  assert.equal(q.usedGpus, 0); // no active jobs in this mock
});

test('getComputeCapacity throws when no matching quota', async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ quotas: [{ name: 'unrelated' }] }), { status: 200 });
  const c = new FireworksProvider('KEY', fakeFetch);
  await assert.rejects(() => c.getComputeCapacity(), /no quota matching/);
});

test('isFireworksError type guard works', () => {
  assert.equal(isFireworksError({ status: 429, body: 'x', isQuotaError: true }), true);
  assert.equal(isFireworksError(null), false);
  assert.equal(isFireworksError('string'), false);
  assert.equal(isFireworksError({}), false);
});
