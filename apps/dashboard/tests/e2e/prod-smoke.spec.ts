/**
 * Prod smoke suite — runs against the deployed Amplify URL.
 * These tests intentionally FAIL when features are missing (stubs/redirects).
 * Run locally: npx playwright test --config apps/dashboard/playwright.config.prod.ts
 *
 * Covered assertions:
 *   A. Nav uniqueness — /queue, /jobs, /users must each resolve to a distinct
 *      final URL and render a distinct <h1>.  Catches the redirect-to-queue stub.
 *   B. Search/filter — each list page (/queue, /jobs, /users) must expose a
 *      visible search or filter <input> that is interactive.
 *   C. Filter effect — typing into the search input on /queue must visibly
 *      change the row count (at least one row present before, fewer / zero after
 *      an unmatchable query).
 */
import { test, expect, type Page } from "@playwright/test";

const PROD_URL =
  process.env.PROD_URL ?? "https://main.d2y6yvvlxvd81b.amplifyapp.com";

const LIST_ROUTES = ["/queue", "/jobs", "/users"] as const;

// ---------------------------------------------------------------------------
// A. Nav uniqueness
// ---------------------------------------------------------------------------
test.describe("Nav uniqueness — each route must render distinct content", () => {
  test("all three nav destinations are distinct (no redirect-to-queue stub)", async ({
    page,
  }) => {
    const results: { route: string; finalUrl: string; h1: string | null }[] =
      [];

    for (const route of LIST_ROUTES) {
      await page.goto(PROD_URL + route, { waitUntil: "domcontentloaded" });
      // Wait up to 8 s for any redirect to settle
      await page.waitForTimeout(1000);
      const finalUrl = page.url();
      const h1 = await page
        .locator("h1")
        .first()
        .textContent({ timeout: 8_000 })
        .catch(() => null);
      results.push({ route, finalUrl, h1: h1?.trim() ?? null });
    }

    const finalUrls = results.map((r) => r.finalUrl);
    const h1s = results.map((r) => r.h1);

    // /jobs must not end up at /queue
    const jobsResult = results.find((r) => r.route === "/jobs")!;
    expect(
      jobsResult.finalUrl,
      "/jobs must not redirect to /queue",
    ).not.toMatch(/\/queue$/);

    // /users must not end up at /queue
    const usersResult = results.find((r) => r.route === "/users")!;
    expect(
      usersResult.finalUrl,
      "/users must not redirect to /queue",
    ).not.toMatch(/\/queue$/);

    // All three final URLs must be distinct
    const uniqueUrls = new Set(finalUrls);
    expect(
      uniqueUrls.size,
      `Expected 3 distinct final URLs, got: ${JSON.stringify(finalUrls)}`,
    ).toBe(3);

    // All three h1s must be present and distinct
    for (const { route, h1 } of results) {
      expect(h1, `<h1> missing on ${route}`).not.toBeNull();
    }
    const uniqueH1s = new Set(h1s.filter(Boolean));
    expect(
      uniqueH1s.size,
      `Expected 3 distinct <h1> headings, got: ${JSON.stringify(h1s)}`,
    ).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// B. Search / filter input presence
// ---------------------------------------------------------------------------
async function findSearchInput(page: Page) {
  return page
    .locator(
      [
        "input[type=search]",
        "input[placeholder*=search" + " i]",
        "input[placeholder*=filter" + " i]",
        "input[aria-label*=search" + " i]",
        "input[aria-label*=filter" + " i]",
        "input[name*=search" + " i]",
        "input[name*=filter" + " i]",
      ].join(", "),
    )
    .first();
}

test.describe("Search / filter input presence", () => {
  for (const route of LIST_ROUTES) {
    test(`${route} exposes a visible search/filter input`, async ({ page }) => {
      await page.goto(PROD_URL + route, { waitUntil: "domcontentloaded" });
      const input = await findSearchInput(page);
      await expect(
        input,
        `No search/filter <input> found on ${route}`,
      ).toBeVisible({ timeout: 10_000 });
      // Confirm it is enabled (not disabled / readonly)
      await expect(input).toBeEnabled();
    });
  }
});

// ---------------------------------------------------------------------------
// C. Filter effect — typing filters the /queue row list
// ---------------------------------------------------------------------------
test.describe("Filter effect on /queue", () => {
  test("typing an unmatchable string into the search input empties or reduces the row list", async ({
    page,
  }) => {
    await page.goto(PROD_URL + "/queue", { waitUntil: "domcontentloaded" });

    // Count visible data rows before filtering (tbody tr)
    const rowsBefore = await page.locator("tbody tr").count();
    // If there are no rows to begin with, skip the effect check (empty DB is acceptable)
    test.skip(
      rowsBefore === 0,
      "No data rows to filter — skipping filter-effect check",
    );

    const input = await findSearchInput(page);
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Type something guaranteed not to match any real job/user name
    await input.fill("zzzzzzzz_no_match_xyzzy");
    await page.waitForTimeout(500); // debounce

    const rowsAfter = await page.locator("tbody tr").count();
    expect(
      rowsAfter,
      `Filter had no effect: before=${rowsBefore} after=${rowsAfter}`,
    ).toBeLessThan(rowsBefore);
  });
});
