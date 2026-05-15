import { defineConfig } from "@playwright/test";

const PROD_URL =
  process.env.PROD_URL ?? "https://main.d2y6yvvlxvd81b.amplifyapp.com";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/prod-smoke.spec.ts"],
  fullyParallel: false,
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: PROD_URL,
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  // No webServer — we hit the already-deployed prod URL directly.
});
