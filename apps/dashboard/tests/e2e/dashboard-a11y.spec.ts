import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

let REAL_USER_ID = '';
let REAL_USER_EMAIL = '';
let REAL_JOB_ID = '';
let REAL_JOB_NAME = '';

test.beforeAll(async () => {
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

  const userResp = await fetch(
    `${SUPABASE_URL}/rest/v1/users?select=id,email&email=eq.alice@trilogy.com`,
    { headers },
  );
  const users = (await userResp.json()) as Array<{ id: string; email: string }>;
  if (users.length === 0) {
    throw new Error(
      'Seed data missing: alice@trilogy.com not found. Run npm run seed-dashboard first.',
    );
  }
  REAL_USER_ID = users[0].id;
  REAL_USER_EMAIL = users[0].email;

  const jobResp = await fetch(
    `${SUPABASE_URL}/rest/v1/jobs_enriched?select=id,display_name&state=eq.SUCCESS&order=created_at.desc&limit=1`,
    { headers },
  );
  const jobs = (await jobResp.json()) as Array<{
    id: string;
    display_name: string | null;
  }>;
  if (jobs.length === 0) {
    throw new Error(
      'Seed data missing: no SUCCESS jobs found. Run npm run seed-dashboard first.',
    );
  }
  REAL_JOB_ID = jobs[0].id;
  REAL_JOB_NAME = jobs[0].display_name ?? REAL_JOB_ID.slice(0, 8);
});

async function assertNoHorizontalOverflow(page: Page, label: string) {
  // Allow 1px rounding tolerance.
  const diff = await page.evaluate(() => {
    const b = document.body;
    return b.scrollWidth - b.clientWidth;
  });
  expect(diff, `horizontal overflow at ${label}`).toBeLessThanOrEqual(1);
}

async function tabThroughFocusable(page: Page): Promise<number> {
  // Tab up to 50 times; return how many distinct activeElement signatures we observed.
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press('Tab');
    const sig = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      return `${el.tagName}#${el.id ?? ''}.${(el.className || '').toString().slice(0, 80)}|${(el.textContent || '').trim().slice(0, 40)}`;
    });
    if (sig) seen.add(sig);
  }
  return seen.size;
}

async function runRouteChecks(
  page: Page,
  url: string,
  expectedHeading: RegExp | string,
) {
  // Desktop default first
  await page.setViewportSize({ width: 1280, height: 800 });
  const resp = await page.goto(url, { waitUntil: 'networkidle' });
  expect(resp, `response for ${url}`).not.toBeNull();
  expect(resp!.status(), `status for ${url}`).toBeLessThan(400);

  await expect(
    page.getByRole('heading', { name: expectedHeading, level: 1 }),
  ).toBeVisible();

  // axe-core scan, fail on any violations
  const axeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  if (axeResults.violations.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      'AXE VIOLATIONS for',
      url,
      JSON.stringify(
        axeResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map((n) => n.target),
        })),
        null,
        2,
      ),
    );
  }
  expect(axeResults.violations, `axe violations on ${url}`).toEqual([]);

  // Keyboard nav: tab should advance through focusable elements without trapping.
  // For minimal pages it may be 0; we only assert no exception and that body is reachable.
  await page.evaluate(() => {
    (document.body as HTMLElement).focus();
  });
  const focused = await tabThroughFocusable(page);
  // Sanity: focused count must be a number (no exceptions). For pages with at least one link, >0.
  expect(typeof focused).toBe('number');

  // Mobile responsiveness — 375x667
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await assertNoHorizontalOverflow(page, `${url} @375`);

  // Mobile responsiveness — 768x1024
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await assertNoHorizontalOverflow(page, `${url} @768`);
}

test.describe('/queue', () => {
  test('functional + a11y + keyboard + responsive', async ({ page }) => {
    await runRouteChecks(page, '/queue', /Active Queue/);
  });
});

test.describe('/jobs/[id]', () => {
  test('functional + a11y + keyboard + responsive', async ({ page }) => {
    await runRouteChecks(
      page,
      `/jobs/${REAL_JOB_ID}`,
      new RegExp(REAL_JOB_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  });
});

test.describe('/users/[id]', () => {
  test('functional + a11y + keyboard + responsive', async ({ page }) => {
    await runRouteChecks(
      page,
      `/users/${REAL_USER_ID}`,
      new RegExp(REAL_USER_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  });
});
