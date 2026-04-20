#!/usr/bin/env node
// Usage:
//   node scripts/issue_key.js --email alice@trilogy.com [--label "alice-laptop"]
//   node scripts/issue_key.js --user-id <uuid>           [--label "..."]
//
// Generates a random sftq_* token, inserts sha256(token) as key_hash,
// and prints the plaintext token ONCE on stdout.

import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--user-id') out.userId = argv[++i];
    else if (a === '--label') out.label = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.email && !args.userId) {
  console.error('usage: node scripts/issue_key.js (--email <email> | --user-id <uuid>) [--label <label>]');
  process.exit(2);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(2);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let userId = args.userId;
if (!userId) {
  const { data, error } = await sb
    .from('users')
    .select('id')
    .eq('email', args.email.toLowerCase().trim())
    .maybeSingle();
  if (error) { console.error('lookup failed:', error.message); process.exit(1); }
  if (!data) { console.error(`no user with email ${args.email}`); process.exit(1); }
  userId = data.id;
}

const plaintext = 'sftq_' + randomBytes(32).toString('base64url');
const keyHash = createHash('sha256').update(plaintext).digest('hex');

const { data, error } = await sb
  .from('api_keys')
  .insert({ user_id: userId, key_hash: keyHash, label: args.label ?? null })
  .select('id, created_at')
  .single();

if (error) {
  console.error('insert failed:', error.message);
  process.exit(1);
}

console.log(`key id:     ${data.id}`);
console.log(`created at: ${data.created_at}`);
console.log(`user id:    ${userId}`);
console.log('');
console.log('=== API KEY (stored only as sha256; will not be shown again) ===');
console.log(plaintext);
