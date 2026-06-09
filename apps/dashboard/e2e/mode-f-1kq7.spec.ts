import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

const SHOT_DIR = '/Users/anirudhsrikanth/Documents/Projects/job-scheduler/drafts/screenshots/1kq7-verify';
fs.mkdirSync(SHOT_DIR, { recursive: true });

test.describe('Mode F extra checks', () => {
  test('Nav uniqueness: /queue vs /users have distinct URLs and H1s', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    const queueUrl = page.url();
    const queueH1 = (await page.locator('h1').first().textContent())?.trim();

    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    const usersUrl = page.url();
    const usersH1 = (await page.locator('h1').first().textContent())?.trim();

    console.log(`NAV /queue url=${queueUrl} h1="${queueH1}"`);
    console.log(`NAV /users url=${usersUrl} h1="${usersH1}"`);

    expect(queueUrl).not.toBe(usersUrl);
    expect(queueH1).not.toBe(usersH1);
    expect(queueH1?.length).toBeGreaterThan(0);
    expect(usersH1?.length).toBeGreaterThan(0);
  });

  test('Search input visible+enabled on /queue and /users', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    const qInput = page.locator('input[type="search"], input[type="text"], input[aria-label*="search" i], input[placeholder*="search" i]').first();
    await expect(qInput).toBeVisible();
    await expect(qInput).toBeEnabled();
    console.log('SEARCH /queue: visible+enabled');

    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    const uInput = page.locator('input[type="search"], input[type="text"], input[aria-label*="search" i], input[placeholder*="search" i]').first();
    await expect(uInput).toBeVisible();
    await expect(uInput).toBeEnabled();
    console.log('SEARCH /users: visible+enabled');
  });

  test('Filter effect: unmatchable search drops row count on /queue', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const rowsBefore = await page.locator('table tbody tr').count();
    console.log(`FILTER rows before: ${rowsBefore}`);
    if (rowsBefore === 0) {
      console.log('FILTER skip: queue is empty (no active jobs) — benign empty-state, not a UI defect');
      test.skip(true, 'Queue is empty (no active jobs); filter-effect test requires at least 1 row');
    }

    const input = page.locator('input[aria-label="search jobs"]').first();
    await input.fill('ZZZUNMATCHABLE999');
    await page.waitForTimeout(1500);
    const rowsAfter = await page.locator('table tbody tr').count();
    console.log(`FILTER rows after: ${rowsAfter}`);
    expect(rowsAfter).toBeLessThan(rowsBefore);
  });

  test('Interactive UI gate: click first QueueTable row opens modal', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const rowCount = await page.locator('table tbody tr').count();
    if (rowCount === 0) {
      test.skip(true, 'Queue is empty; modal-open test requires at least 1 row');
    }
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const dialogText = (await dialog.textContent())?.slice(0, 200);
    console.log(`MODAL opened: ${dialogText}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'modal-opened.png'), fullPage: false });
  });

  test('axe-core a11y on /queue', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    console.log(`AXE /queue total violations=${results.violations.length} serious/critical=${seriousOrCritical.length}`);
    for (const v of seriousOrCritical) {
      console.log(`  [${v.impact}] ${v.id}: ${v.description} (nodes=${v.nodes.length})`);
      for (const n of v.nodes.slice(0, 3)) console.log(`    target=${n.target.join(',')}`);
    }
    expect(seriousOrCritical.length, JSON.stringify(seriousOrCritical.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })))).toBe(0);
  });

  test('axe-core a11y on /users', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    console.log(`AXE /users total violations=${results.violations.length} serious/critical=${seriousOrCritical.length}`);
    for (const v of seriousOrCritical) {
      console.log(`  [${v.impact}] ${v.id}: ${v.description} (nodes=${v.nodes.length})`);
      for (const n of v.nodes.slice(0, 3)) console.log(`    target=${n.target.join(',')}`);
    }
    expect(seriousOrCritical.length, JSON.stringify(seriousOrCritical.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })))).toBe(0);
  });

  test('Mobile 375x667 viewport /queue screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOT_DIR, 'mobile-375.png'), fullPage: true });
    // Check no horizontal scroll
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    console.log(`MOBILE 375 hasHorizontalOverflow=${hasOverflow}`);
    expect(hasOverflow).toBe(false);
  });

  test('Tablet 768x1024 viewport /queue screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOT_DIR, 'mobile-768.png'), fullPage: true });
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    console.log(`TABLET 768 hasHorizontalOverflow=${hasOverflow}`);
    expect(hasOverflow).toBe(false);
  });
});
