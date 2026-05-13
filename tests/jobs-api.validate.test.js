import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnqueue } from '../supabase/functions/jobs-api/validate.ts';
import { bearerToken, sha256Hex } from '../supabase/functions/_shared/auth.ts';

// --- Legacy mode (fireworks_payload) ---

test('validateEnqueue accepts a minimal SFT body (legacy)', () => {
  const r = validateEnqueue({ kind: 'SFT', fireworks_payload: { baseModel: 'x' } });
  assert.equal(r.ok, true);
  assert.equal(r.value.kind, 'SFT');
  assert.equal(r.value.gpu_count, 4);
  assert.equal(r.value.display_name, null);
  assert.equal(r.value.fireworks_payload.baseModel, 'x');
});

test('validateEnqueue accepts DPO and preserves display_name + gpu_count (legacy)', () => {
  const r = validateEnqueue({
    kind: 'DPO',
    display_name: 'test run',
    gpu_count: 8,
    fireworks_payload: { trainingConfig: {} },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.kind, 'DPO');
  assert.equal(r.value.display_name, 'test run');
  assert.equal(r.value.gpu_count, 8);
});

test('validateEnqueue accepts RFT (legacy)', () => {
  const r = validateEnqueue({
    kind: 'RFT',
    display_name: 'rl run',
    fireworks_payload: {
      dataset: 'accounts/trilogy/datasets/foo',
      evaluator: 'accounts/trilogy/evaluators/foo-scorer',
      lossConfig: { method: 'GRPO' },
      inferenceParameters: { responseCandidatesCount: 4 },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.kind, 'RFT');
});

test('validateEnqueue rejects unknown kind', () => {
  const r = validateEnqueue({ kind: 'PPO', fireworks_payload: {} });
  assert.equal(r.ok, false);
  assert.match(r.err.message, /kind must be/);
});

test('validateEnqueue rejects non-object fireworks_payload', () => {
  const r = validateEnqueue({ kind: 'SFT', fireworks_payload: 'bad' });
  assert.equal(r.ok, false);
  assert.match(r.err.message, /fireworks_payload must be an object/);
});

test('validateEnqueue rejects non-integer gpu_count (legacy)', () => {
  assert.equal(validateEnqueue({ kind: 'SFT', gpu_count: 0, fireworks_payload: {} }).ok, false);
  assert.equal(validateEnqueue({ kind: 'SFT', gpu_count: -4, fireworks_payload: {} }).ok, false);
  assert.equal(validateEnqueue({ kind: 'SFT', gpu_count: 1.5, fireworks_payload: {} }).ok, false);
  assert.equal(validateEnqueue({ kind: 'SFT', gpu_count: 'four', fireworks_payload: {} }).ok, false);
});

test('validateEnqueue rejects non-string display_name', () => {
  const r = validateEnqueue({ kind: 'SFT', display_name: 123, fireworks_payload: {} });
  assert.equal(r.ok, false);
});

// --- Unified schema mode ---

test('validateEnqueue accepts unified schema (minimal)', () => {
  const r = validateEnqueue({
    kind: 'SFT',
    base_model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    dataset: 'https://example.com/dataset.jsonl',
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.kind, 'SFT');
  assert.equal(r.value.base_model, 'accounts/fireworks/models/llama-v3p1-8b-instruct');
  assert.equal(r.value.dataset, 'https://example.com/dataset.jsonl');
  assert.equal(r.value.gpu_count, 4);
  assert.equal(r.value.preferred_provider, 'fireworks');
  assert.equal(r.value.fireworks_payload, null);
});

test('validateEnqueue accepts unified schema with all fields', () => {
  const r = validateEnqueue({
    kind: 'DPO',
    base_model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    dataset: 'https://example.com/dataset.jsonl',
    display_name: 'my dpo run',
    gpu_count: 8,
    hyperparameters: { learning_rate: 1e-5, num_epochs: 3 },
    preferred_provider: 'primeintellect',
    provider_overrides: { foo: 'bar' },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.kind, 'DPO');
  assert.equal(r.value.display_name, 'my dpo run');
  assert.equal(r.value.gpu_count, 8);
  assert.equal(r.value.preferred_provider, 'primeintellect');
  assert.deepEqual(r.value.hyperparameters, { learning_rate: 1e-5, num_epochs: 3 });
  assert.deepEqual(r.value.provider_overrides, { foo: 'bar' });
});

test('validateEnqueue rejects missing base_model in unified mode', () => {
  const r = validateEnqueue({ kind: 'SFT', dataset: 'x' });
  assert.equal(r.ok, false);
  assert.match(r.err.message, /base_model is required/);
});

test('validateEnqueue rejects missing dataset in unified mode', () => {
  const r = validateEnqueue({ kind: 'SFT', base_model: 'x' });
  assert.equal(r.ok, false);
  assert.match(r.err.message, /dataset is required/);
});

test('validateEnqueue rejects invalid preferred_provider', () => {
  const r = validateEnqueue({
    kind: 'SFT',
    base_model: 'x',
    dataset: 'y',
    preferred_provider: 'aws',
  });
  assert.equal(r.ok, false);
  assert.match(r.err.message, /preferred_provider must be 'fireworks' or 'primeintellect'/);
});

test('validateEnqueue rejects non-object body', () => {
  assert.equal(validateEnqueue(null).ok, false);
  assert.equal(validateEnqueue('hi').ok, false);
  assert.equal(validateEnqueue(42).ok, false);
});

// --- Auth helpers ---

test('bearerToken extracts the token', () => {
  const req = new Request('http://x/', { headers: { Authorization: 'Bearer sftq_abc' } });
  assert.equal(bearerToken(req), 'sftq_abc');
});

test('bearerToken returns null for missing / malformed headers', () => {
  assert.equal(bearerToken(new Request('http://x/')), null);
  assert.equal(bearerToken(new Request('http://x/', { headers: { Authorization: 'Basic xyz' } })), null);
  assert.equal(bearerToken(new Request('http://x/', { headers: { Authorization: 'Bearer' } })), null);
  assert.equal(bearerToken(new Request('http://x/', { headers: { Authorization: 'Bearer ' } })), null);
});

test('sha256Hex is deterministic and matches a known vector', async () => {
  // sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
  const h = await sha256Hex('hello');
  assert.equal(h, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
});
