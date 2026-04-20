#!/usr/bin/env node
// Usage: node scripts/dump_state.js [--state QUEUED] [--kind SFT] [--limit 100]
//
// Dumps the jobs table for oncall debugging.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const out = { limit: 50 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--state') out.state = argv[++i];
    else if (a === '--kind') out.kind = argv[++i];
    else if (a === '--limit') out.limit = parseInt(argv[++i], 10);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(2);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let q = sb
  .from('jobs')
  .select('id, user_id, kind, state, display_name, gpu_count, created_at, started_at, completed_at, fireworks_job_name, error')
  .order('created_at', { ascending: false })
  .limit(args.limit);
if (args.state) q = q.eq('state', args.state);
if (args.kind) q = q.eq('kind', args.kind);

const { data, error } = await q;
if (error) { console.error('query failed:', error.message); process.exit(1); }

// Tab-separated for easy piping into cut/awk.
const cols = ['id', 'kind', 'state', 'user_id', 'gpu_count', 'created_at', 'started_at', 'completed_at', 'display_name', 'fireworks_job_name'];
console.log(cols.join('\t'));
for (const r of data) {
  console.log(cols.map((c) => (r[c] ?? '')).join('\t'));
}
