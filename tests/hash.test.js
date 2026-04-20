// Round-trip: the token shape produced by issue_key.js hashes to a 64-char
// hex string, and hashing twice yields the same value (what the jobs-api
// middleware does at request time).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';

function issue() {
  const plaintext = 'sftq_' + randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

test('issued token starts with sftq_', () => {
  const { plaintext } = issue();
  assert.ok(plaintext.startsWith('sftq_'));
});

test('hash is deterministic 64-char hex', () => {
  const { plaintext, hash } = issue();
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  const again = createHash('sha256').update(plaintext).digest('hex');
  assert.equal(again, hash);
});

test('two distinct tokens produce distinct hashes', () => {
  const a = issue();
  const b = issue();
  assert.notEqual(a.plaintext, b.plaintext);
  assert.notEqual(a.hash, b.hash);
});
