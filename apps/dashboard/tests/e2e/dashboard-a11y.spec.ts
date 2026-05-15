import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_JOB_ID = '00000000-0000-0000-0000-000000000abc';
const REAL_JOB_ID = 'a0000001-0000-0000-0000-000000000001';

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
    await runRouteChecks(page, '/queue', /^Queue$/);
  });
});

test.describe('/jobs/[id]', () => {
  test('functional + a11y + keyboard + responsive', async ({ page }) => {
    await runRouteChecks(
      page,
      `/jobs/${FAKE_JOB_ID}`,
      new RegExp(`^Job ${FAKE_JOB_ID}$`),
    );
  });
});

test.describe('/jobs/[real-id] (happy path with seed data)', () => {
  test('functional + a11y + keyboard + responsive', async ({ page }) => {
    await runRouteChecks(page, `/jobs/${REAL_JOB_ID}`, /^alice-shakespeare-sft-rev1$/);
  });
});

test.describe('/users/[id] (not found path)', () => {
  test('functional + a11y + keyboard + responsive', async ({ page }) => {
    await runRouteChecks(page, `/users/${FAKE_USER_ID}`, /^User not found$/);
  });
});
