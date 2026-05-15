import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SERVER_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'http://localhost:54321';

const SERVER_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'public-anon-key-placeholder';

export function createServerClient(): SupabaseClient {
  return createClient(SERVER_URL, SERVER_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
