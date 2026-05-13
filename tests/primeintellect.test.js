// Node-side tests for the Prime Intellect provider adapter.
// Network is mocked via an injected fetchImpl.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PrimeIntellectProvider,
  PrimeIntellectError,
  isPrimeIntellectError,
  mapPrimeIntellectTerminal,
} from '../supabase/functions/_shared/primeintellect-provider.ts';

function makeFakeFetch(responses) {
  return async (url, init) => {
    const method = init?.method ?? 'GET';
    const keyWithMethod = `${method} ${url}`;
    let body = responses[keyWithMethod] ?? responses[url] ?? null;
    if (body === null) {
      for (const [key, value] of Object.entries(responses)) {
        if (url.endsWith(key) || keyWithMethod.endsWith(key)) {
          body = value;
          break;
        }
      }
    }
    if (body !== null) {
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status: 200,
      });
    }
    return new Response(JSON.stringify({ detail: 'not found' }), { status: 404 });
  };
}

test('submitJob rejects SFT', async () => {
  const c = new PrimeIntellectProvider('KEY', undefined, makeFakeFetch({}));
  await assert.rejects(() => c.submitJob('SFT', {}), /only supports RFT/);
});

test('submitJob rejects DPO', async () => {
  const c = new PrimeIntellectProvider('KEY', undefined, makeFakeFetch({}));
  await assert.rejects(() => c.submitJob('DPO', {}), /only supports RFT/);
});

test('submitJob requires base_model for RFT', async () => {
  const c = new PrimeIntellectProvider('KEY', undefined, makeFakeFetch({}));
  await assert.rejects(
    () => c.submitJob('RFT', { dataset: 'stelioszach/tool-calling-single' }),
    /base_model is required/,
  );
});

test('submitJob requires dataset for RFT', async () => {
  const c = new PrimeIntellectProvider('KEY', undefined, makeFakeFetch({}));
  await assert.rejects(
    () => c.submitJob('RFT', { base_model: 'Qwen/Qwen3.5-0.8B' }),
    /dataset is required/,
  );
});

test('submitJob POSTs to /rft/runs with mapped payload', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        run: {
          id: 'run-123',
          status: 'PENDING',
          baseModel: 'Qwen/Qwen3.5-0.8B',
          environments: [{ id: 'stelioszach/tool-calling-single' }],
        },
      }),
      { status: 200 },
    );
  };
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const job = await c.submitJob('RFT', {
    base_model: 'Qwen/Qwen3.5-0.8B',
    dataset: 'stelioszach/tool-calling-single',
    hyperparameters: { learning_rate: 3e-5, lora_alpha: 16, batch_size: 64, max_steps: 200 },
    provider_overrides: { max_tokens: 1024 },
  });
  assert.equal(job.provider_job_id, 'run-123');
  assert.equal(job.state, 'PENDING');
  assert.equal(job.gpuCount, 1);
  assert.ok(calls[0].url.endsWith('/rft/runs'));
  assert.equal(calls[0].init.method, 'POST');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model.name, 'Qwen/Qwen3.5-0.8B');
  assert.deepEqual(body.environments, [{ id: 'stelioszach/tool-calling-single' }]);
  assert.equal(body.learning_rate, 3e-5);
  assert.equal(body.lora_alpha, 16);
  assert.equal(body.batch_size, 64);
  assert.equal(body.max_steps, 200);
  assert.equal(body.max_tokens, 1024);
  assert.equal(body.rollouts_per_example, 8);
});

test('getJobStatus maps PENDING to PROGRESS', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ run: { id: 'run-1', status: 'PENDING', errorMessage: null } }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const job = await c.getJobStatus('RFT', 'run-1');
  assert.equal(job.provider_job_id, 'run-1');
  assert.equal(job.state, 'PROGRESS');
});

test('getJobStatus maps RUNNING to PROGRESS', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ run: { id: 'run-2', status: 'RUNNING', errorMessage: null } }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const job = await c.getJobStatus('RFT', 'run-2');
  assert.equal(job.state, 'PROGRESS');
});

test('getJobStatus maps COMPLETED to SUCCESS', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ run: { id: 'run-3', status: 'COMPLETED', errorMessage: null } }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const job = await c.getJobStatus('RFT', 'run-3');
  assert.equal(job.state, 'SUCCESS');
});

test('getJobStatus maps FAILED to FAIL', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ run: { id: 'run-4', status: 'FAILED', errorMessage: 'oom' } }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const job = await c.getJobStatus('RFT', 'run-4');
  assert.equal(job.state, 'FAIL');
  assert.equal(job.error, 'oom');
});

test('getJobStatus maps ERROR to FAIL', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ run: { id: 'run-5', status: 'ERROR', errorMessage: 'timeout' } }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const job = await c.getJobStatus('RFT', 'run-5');
  assert.equal(job.state, 'FAIL');
  assert.equal(job.error, 'timeout');
});

test('getJobStatus maps STOPPED to CANCELLED', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ run: { id: 'run-6', status: 'STOPPED', errorMessage: null } }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const job = await c.getJobStatus('RFT', 'run-6');
  assert.equal(job.state, 'CANCELLED');
});

test('getJobStatus maps CANCELLED to CANCELLED', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({ run: { id: 'run-7', status: 'CANCELLED', errorMessage: null } }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const job = await c.getJobStatus('RFT', 'run-7');
  assert.equal(job.state, 'CANCELLED');
});

test('listActiveJobs filters out terminal runs', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        runs: [
          { id: 'a', status: 'PENDING' },
          { id: 'b', status: 'RUNNING' },
          { id: 'c', status: 'COMPLETED' },
          { id: 'd', status: 'FAILED' },
          { id: 'e', status: 'STOPPED' },
          { id: 'f', status: 'CANCELLED' },
          { id: 'g', status: 'ERROR' },
          { id: 'h', status: 'QUEUED' },
        ],
      }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const active = await c.listActiveJobs();
  const ids = active.map((j) => j.provider_job_id);
  assert.deepEqual(ids.sort(), ['a', 'b', 'h']);
});

test('cancelJob sends PUT to /rft/runs/{id}/stop', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, method: init?.method });
    return new Response('{}', { status: 200 });
  };
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  await c.cancelJob('RFT', 'run-123');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/rft/runs/run-123/stop'));
  assert.equal(calls[0].method, 'PUT');
});

test('cancelJob ignores 400 errors', async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ detail: 'Run already stopped' }), { status: 400 });
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  await assert.doesNotReject(() => c.cancelJob('RFT', 'run-123'));
});

test('getComputeCapacity returns zero when all models at capacity', async () => {
  const fakeFetch = async () =>
    new Response(
      JSON.stringify({
        models: [
          { name: 'Qwen/Qwen3.5-0.8B', atCapacity: true },
          { name: 'Qwen/Qwen3.5-2B', atCapacity: true },
        ],
      }),
      { status: 200 },
    );
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const cap = await c.getComputeCapacity();
  assert.equal(cap.totalGpus, 0);
  assert.equal(cap.usedGpus, 0);
});

test('getComputeCapacity returns positive capacity when any model is available', async () => {
  const responses = {
    '/rft/models': {
      models: [
        { name: 'Qwen/Qwen3.5-0.8B', atCapacity: true },
        { name: 'Qwen/Qwen3.5-2B', atCapacity: false },
      ],
    },
    '/rft/runs': { runs: [{ id: 'a', status: 'RUNNING' }] },
  };
  const fakeFetch = makeFakeFetch(responses);
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const cap = await c.getComputeCapacity();
  assert.equal(cap.totalGpus, 10);
  assert.equal(cap.usedGpus, 1);
});

test('getComputeCapacity gracefully returns zero on API failure', async () => {
  const fakeFetch = async () => new Response('{}', { status: 500 });
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  const cap = await c.getComputeCapacity();
  assert.equal(cap.totalGpus, 0);
  assert.equal(cap.usedGpus, 0);
});

test('mapPrimeIntellectTerminal maps COMPLETED to SUCCESS', () => {
  const m = mapPrimeIntellectTerminal('COMPLETED');
  assert.equal(m.state, 'SUCCESS');
  assert.equal(m.errorText({}), null);
});

test('mapPrimeIntellectTerminal maps FAILED to FAIL', () => {
  const m = mapPrimeIntellectTerminal('FAILED');
  assert.equal(m.state, 'FAIL');
  assert.equal(m.errorText({ error: 'oom' }), 'oom');
  assert.equal(m.errorText({ message: 'msg' }), 'msg');
  assert.equal(m.errorText({}), null);
});

test('mapPrimeIntellectTerminal maps CANCELLED to CANCELLED', () => {
  const m = mapPrimeIntellectTerminal('CANCELLED');
  assert.equal(m.state, 'CANCELLED');
});

test('mapPrimeIntellectTerminal returns null for non-terminal statuses', () => {
  assert.equal(mapPrimeIntellectTerminal('PENDING'), null);
  assert.equal(mapPrimeIntellectTerminal('RUNNING'), null);
  assert.equal(mapPrimeIntellectTerminal('QUEUED'), null);
});

test('isPrimeIntellectError type guard works', () => {
  assert.equal(isPrimeIntellectError(new PrimeIntellectError('x', 400, '{}')), true);
  assert.equal(isPrimeIntellectError(null), false);
  assert.equal(isPrimeIntellectError('string'), false);
  assert.equal(isPrimeIntellectError(new Error('generic')), false);
});

test('submitJob surfaces API errors as PrimeIntellectError', async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ detail: 'invalid model' }), { status: 422 });
  const c = new PrimeIntellectProvider('KEY', undefined, fakeFetch);
  try {
    await c.submitJob('RFT', {
      base_model: 'bad',
      dataset: 'stelioszach/tool-calling-single',
    });
    assert.fail('expected throw');
  } catch (e) {
    assert.equal(isPrimeIntellectError(e), true);
    assert.equal(e.status, 422);
  }
});
