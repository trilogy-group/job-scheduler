// Run from apps/dashboard: npx playwright test --config playwright.config.mode-f.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/mode-f-1kq7.spec.ts',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'https://main.d2y6yvvlxvd81b.amplifyapp.com',
    screenshot: 'only-on-failure',
    headless: true,
  },
  timeout: 60_000,
});
