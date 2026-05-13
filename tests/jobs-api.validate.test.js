import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnqueue } from '../supabase/functions/jobs-api/validate.ts';
import { bearerToken, sha256Hex } from '../supabase/functions/_shared/auth.ts';

test('validateEnqueue accepts a minimal SFT body', () => {
  const r = validateEnqueue({ kind: 'SFT', fireworks_payload: { baseModel: 'x' } });
  assert.equal(r.ok, true);
  assert.equal(r.value.kind, 'SFT');
  assert.equal(r.value.gpu_count, 4);
  assert.equal(r.value.display_name, null);
});

test('validateEnqueue accepts DPO and preserves display_name + gpu_count', () => {
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

test('validateEnqueue accepts RFT', () => {
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

test('validateEnqueue rejects missing payload', () => {
  const r = validateEnqueue({ kind: 'SFT' });
  assert.equal(r.ok, false);
  assert.match(r.err.message, /fireworks_payload/);
});

test('validateEnqueue rejects non-integer gpu_count', () => {
  assert.equal(validateEnqueue({ kind: 'SFT', gpu_count: 0, fireworks_payload: {} }).ok, false);
  assert.equal(validateEnqueue({ kind: 'SFT', gpu_count: -4, fireworks_payload: {} }).ok, false);
  assert.equal(validateEnqueue({ kind: 'SFT', gpu_count: 1.5, fireworks_payload: {} }).ok, false);
  assert.equal(validateEnqueue({ kind: 'SFT', gpu_count: 'four', fireworks_payload: {} }).ok, false);
});

test('validateEnqueue rejects non-string display_name', () => {
  const r = validateEnqueue({ kind: 'SFT', display_name: 123, fireworks_payload: {} });
  assert.equal(r.ok, false);
});

test('validateEnqueue rejects non-object body', () => {
  assert.equal(validateEnqueue(null).ok, false);
  assert.equal(validateEnqueue('hi').ok, false);
  assert.equal(validateEnqueue(42).ok, false);
});

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
