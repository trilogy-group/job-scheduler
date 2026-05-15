import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*prod-smoke*',
  timeout: 30000,
  use: {
    baseURL: 'https://main.d2y6yvvlxvd81b.amplifyapp.com',
  },
});
