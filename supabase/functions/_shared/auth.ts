// API key authentication for the jobs-api.
// Bearer token -> sha256 hex -> lookup api_keys by key_hash.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface AuthContext {
  userId: string;
  keyId: string;
}

/** Extracts the bearer token; returns null if the header is absent/malformed. */
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(\S+)$/);
  return m ? m[1] : null;
}

/** Hex sha256 using the Web Crypto API (available in Deno & Node). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resolves a bearer token to an AuthContext or returns null if the token is
 * unknown, revoked, or the header was malformed. Side-effect: best-effort
 * `last_used_at` update on success (errors from that update are swallowed —
 * auth decisions must not depend on it).
 */
export async function authenticate(
  db: SupabaseClient,
  req: Request,
): Promise<AuthContext | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const hash = await sha256Hex(token);

  const { data, error } = await db
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;
  if (data.revoked_at) return null;

  await db
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then((r) => r, () => null);

  return { userId: data.user_id, keyId: data.id };
}
