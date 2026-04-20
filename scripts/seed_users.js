#!/usr/bin/env node
// Usage: node scripts/seed_users.js alice@trilogy.com bob@trilogy.com ...
//
// Inserts each email into public.users if not already present. Idempotent.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const emails = process.argv.slice(2).filter(Boolean);
if (emails.length === 0) {
  console.error('usage: node scripts/seed_users.js <email> [<email> ...]');
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

const rows = emails.map((email) => ({ email: email.toLowerCase().trim() }));

const { data, error } = await sb
  .from('users')
  .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
  .select('id, email');

if (error) {
  console.error('seed failed:', error.message);
  process.exit(1);
}

for (const row of data) {
  console.log(`${row.id}\t${row.email}`);
}
