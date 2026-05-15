import { describe, it, expect, vi } from 'vitest';

/**
 * Touch the dashboard root config modules so coverage instrumentation
 * marks them as executed. These files are referenced by tooling
 * (next/playwright/postcss) but never imported by application code,
 * so without an explicit import here vitest-v8 reports them as 0%.
 */
describe('dashboard root configs', () => {
  it('next.config.ts exports a valid NextConfig', async () => {
    const mod = await import('../../next.config');
    expect(mod.default).toMatchObject({ reactStrictMode: true });
  });

  it('postcss.config.mjs exports plugins map', async () => {
    const mod = await import('../../postcss.config.mjs');
    expect(mod.default.plugins).toHaveProperty('@tailwindcss/postcss');
  });

  it('playwright.config.ts exports a valid config', async () => {
    // playwright.config imports @playwright/test which expects a real CLI
    // context. Stub the minimal API we use so the config evaluates cleanly.
    vi.doMock('@playwright/test', () => ({
      defineConfig: (cfg: unknown) => cfg,
      devices: new Proxy(
        {},
        { get: () => ({}) },
      ),
    }));
    const mod = await import('../../playwright.config');
    expect(mod.default).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = mod.default as any;
    expect(typeof cfg.testDir).toBe('string');
    vi.doUnmock('@playwright/test');
  });
});
