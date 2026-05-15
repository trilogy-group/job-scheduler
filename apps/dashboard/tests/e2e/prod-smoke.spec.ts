import { test, expect } from '@playwright/test';

test('queue page renders h1 with "Active Queue"', async ({ page }) => {
  await page.goto('/queue');
  await expect(page.locator('h1')).toContainText('Active Queue');
});

test('queue page has a table element (QueueTable rendered)', async ({ page }) => {
  await page.goto('/queue');
  await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
});

test('jobs page renders h1 with "All Jobs"', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.locator('h1')).toContainText('All Jobs');
});

test('users page renders h1 with "Users"', async ({ page }) => {
  await page.goto('/users');
  await expect(page.locator('h1')).toContainText('Users');
});

test('queue page exposes search input (PR #29 feature)', async ({ page }) => {
  await page.goto('/queue');
  const searchInput = page
    .locator('input[type="text"], input[placeholder*="earch" i], [role="searchbox"]')
    .first();
  await expect(searchInput).toBeVisible({ timeout: 15000 });
});
