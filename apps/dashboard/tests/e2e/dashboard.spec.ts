import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.UI_BASE_URL ?? 'http://localhost:3000';
const SCREEN_DIR = process.env.SCREEN_DIR ?? '/tmp/screenshots';
fs.mkdirSync(SCREEN_DIR, { recursive: true });

const ALICE_PROGRESS = 'a0000008-0000-0000-0000-000000000026';
const BOB_FAIL = 'b0000004-0000-0000-0000-000000000014';
const ALICE_USER = '11111111-1111-1111-1111-111111111111';
const DAVE_USER = '44444444-4444-4444-4444-444444444444';

async function runAxe(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockers = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  const summary = {
    label,
    total: results.violations.length,
    criticalSerious: blockers.length,
    violations: results.violations.map(v => ({
      id: v.id, impact: v.impact, count: v.nodes.length,
      help: v.help,
      sampleSelector: v.nodes[0]?.target?.[0] ?? null,
    })),
  };
  fs.writeFileSync(path.join(SCREEN_DIR, `axe-${label}.json`), JSON.stringify(summary, null, 2));
  return summary;
}

test.describe('Dashboard functional + a11y + visual', () => {
  test.setTimeout(60_000);

  test('/queue renders 5+ rows with badges and ages', async ({ page }) => {
    const resp = await page.goto(`${BASE}/queue`, { waitUntil: 'networkidle' });
    expect(resp?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('Active Queue');
    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    // Badges
    await expect(page.locator('text=PROGRESS').first()).toBeVisible();
    await expect(page.locator('text=QUEUED').first()).toBeVisible();
    // GPU column shows integers (column index 4)
    const gpuCell = rows.nth(0).locator('td').nth(4);
    const gpuText = await gpuCell.innerText();
    expect(gpuText.trim()).toMatch(/^\d+$/);
    // Age column shows '<n>m' or similar
    const ageCell = rows.nth(0).locator('td').nth(6);
    const ageText = await ageCell.innerText();
    expect(ageText.trim()).toMatch(/\d+\s*(m|h|d|s)/);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: path.join(SCREEN_DIR, 'queue-desktop.png'), fullPage: true });

    const axe = await runAxe(page, 'queue');
    expect(axe.criticalSerious, JSON.stringify(axe.violations)).toBe(0);
  });

  test('/jobs/[id] PROGRESS shows breadcrumb, h1, badge, timeline, payload', async ({ page }) => {
    const resp = await page.goto(`${BASE}/jobs/${ALICE_PROGRESS}`, { waitUntil: 'networkidle' });
    expect(resp?.status()).toBe(200);
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('alice-big-sft-running');
    await expect(page.locator('text=PROGRESS').first()).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Timeline' })).toBeVisible();
    await expect(page.getByText(/Queued/).first()).toBeVisible();
    await expect(page.getByText(/Started/).first()).toBeVisible();
    // Fireworks payload section + GPU 8 + baseModel text
    await expect(page.getByText('Fireworks payload')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/qwen3-32b/);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: path.join(SCREEN_DIR, 'job-progress-desktop.png'), fullPage: true });

    const axe = await runAxe(page, 'job-progress');
    expect(axe.criticalSerious, JSON.stringify(axe.violations)).toBe(0);
  });

  test('/jobs/[id] FAIL shows red badge and error text', async ({ page }) => {
    const resp = await page.goto(`${BASE}/jobs/${BOB_FAIL}`, { waitUntil: 'networkidle' });
    expect(resp?.status()).toBe(200);
    await expect(page.locator('text=FAIL').first()).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Internal Server Error|OOM|trainer/);

    await page.screenshot({ path: path.join(SCREEN_DIR, 'job-fail-desktop.png'), fullPage: true });
    const axe = await runAxe(page, 'job-fail');
    expect(axe.criticalSerious, JSON.stringify(axe.violations)).toBe(0);
  });

  test('/users/[id] alice shows job history', async ({ page }) => {
    const resp = await page.goto(`${BASE}/users/${ALICE_USER}`, { waitUntil: 'networkidle' });
    expect(resp?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('alice');
    await expect(page.locator('h2', { hasText: 'Job history' })).toBeVisible();
    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: path.join(SCREEN_DIR, 'user-alice-desktop.png'), fullPage: true });
    const axe = await runAxe(page, 'user-alice');
    expect(axe.criticalSerious, JSON.stringify(axe.violations)).toBe(0);
  });

  test('/users/[id] dave loads', async ({ page }) => {
    const resp = await page.goto(`${BASE}/users/${DAVE_USER}`, { waitUntil: 'networkidle' });
    expect(resp?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    const axe = await runAxe(page, 'user-dave');
    expect(axe.criticalSerious, JSON.stringify(axe.violations)).toBe(0);
  });

  test('keyboard nav on /queue + /jobs/[id]', async ({ page }) => {
    await page.goto(`${BASE}/queue`);
    // Tab a few times and capture focused element info
    const tabReport: Array<{ tag: string; text: string; hasOutline: boolean }> = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || '').slice(0, 40),
          hasOutline: s.outlineStyle !== 'none' || parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none',
        };
      });
      if (info) tabReport.push(info);
    }
    fs.writeFileSync(path.join(SCREEN_DIR, 'keyboard-queue.json'), JSON.stringify(tabReport, null, 2));

    // Jobs page breadcrumb keyboard activation
    await page.goto(`${BASE}/jobs/${ALICE_PROGRESS}`);
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      return { tag: el.tagName.toLowerCase(), text: el.innerText, href: (el as HTMLAnchorElement).href ?? null };
    });
    fs.writeFileSync(path.join(SCREEN_DIR, 'keyboard-job.json'), JSON.stringify(focus, null, 2));
  });

  test('mobile 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/queue`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
    }));
    fs.writeFileSync(path.join(SCREEN_DIR, 'mobile-375-overflow.json'), JSON.stringify(overflow, null, 2));
    await page.screenshot({ path: path.join(SCREEN_DIR, 'mobile-375.png'), fullPage: true });
  });

  test('mobile 768x1024', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE}/queue`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
    }));
    fs.writeFileSync(path.join(SCREEN_DIR, 'mobile-768-overflow.json'), JSON.stringify(overflow, null, 2));
    await page.screenshot({ path: path.join(SCREEN_DIR, 'mobile-768.png'), fullPage: true });
  });
});
