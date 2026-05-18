import { createClient } from '@supabase/supabase-js';

const BROWSER_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';

const BROWSER_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'local-anon-key-placeholder';

export function createBrowserClient() {
  return createClient(BROWSER_URL, BROWSER_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
