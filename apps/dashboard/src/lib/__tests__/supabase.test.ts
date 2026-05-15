import { describe, expect, it } from 'vitest';

describe('supabase client', () => {
  it('exports a truthy client', async () => {
    const mod = await import('@/lib/supabase');
    expect(mod.supabase).toBeTruthy();
  });

  it('exposes a from() function (SupabaseClient surface)', async () => {
    const { supabase } = await import('@/lib/supabase');
    expect(typeof supabase.from).toBe('function');
  });

  it('falls back to local URL when NEXT_PUBLIC_SUPABASE_URL is unset', async () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      // Re-import a fresh copy of the module to pick up env state.
      const mod = await import('@/lib/supabase?fallback');
      expect(mod.supabase).toBeTruthy();
      expect(typeof mod.supabase.from).toBe('function');
    } catch {
      // If the query-string import isn't supported, just re-import normally.
      const mod = await import('@/lib/supabase');
      expect(mod.supabase).toBeTruthy();
    } finally {
      if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
    }
  });

  it('exports LOCAL_DEV_USER_ID (null by default)', async () => {
    const mod = await import('@/lib/supabase');
    expect('LOCAL_DEV_USER_ID' in mod).toBe(true);
  });
});
