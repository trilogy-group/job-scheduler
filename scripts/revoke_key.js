#!/usr/bin/env node
// Usage: node scripts/revoke_key.js --id <key-id>

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--id') out.id = argv[++i];
  }
  return out;
}

const { id } = parseArgs(process.argv.slice(2));
if (!id) {
  console.error('usage: node scripts/revoke_key.js --id <key-id>');
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

const { data, error } = await sb
  .from('api_keys')
  .update({ revoked_at: new Date().toISOString() })
  .eq('id', id)
  .is('revoked_at', null)
  .select('id, user_id, revoked_at')
  .maybeSingle();

if (error) { console.error('revoke failed:', error.message); process.exit(1); }
if (!data) { console.error(`no active key with id ${id}`); process.exit(1); }

console.log(`revoked ${data.id} (user ${data.user_id}) at ${data.revoked_at}`);
