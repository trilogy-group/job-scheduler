import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase as anonClient } from './supabase';

/**
 * Server-side Supabase client.
 *
 * Prefers a service-role client built from SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Falls back to the anon
 * client exported from ./supabase if those env vars are not set.
 */
export function getServerSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anonClient;
}
