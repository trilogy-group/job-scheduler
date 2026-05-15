import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/prod-smoke.spec.ts',
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: 'https://main.d2y6yvvlxvd81b.amplifyapp.com',
    screenshot: 'only-on-failure',
    headless: true,
  },
  timeout: 30_000,
});
