// Supabase DB client for Edge Functions. Uses the service role key so
// we can bypass RLS — authorization is enforced in the request layer.

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function dbClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
