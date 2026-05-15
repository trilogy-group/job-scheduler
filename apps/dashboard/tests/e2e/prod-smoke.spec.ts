import { test, expect } from '@playwright/test';

test('/queue loads and shows h1 Active Queue', async ({ page }) => {
  await page.goto('/queue');
  await expect(page.locator('h1')).toHaveText('Active Queue');
});

test('/queue shows a visible table', async ({ page }) => {
  await page.goto('/queue');
  await expect(page.locator('table')).toBeVisible();
});

test('/queue table has at least one row inside tbody', async ({ page }) => {
  await page.goto('/queue');
  await expect(page.locator('table tbody tr').first()).toBeVisible();
});

test('root / redirects and eventually shows Active Queue text', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL('**/queue');
  await expect(page.locator('body')).toContainText('Active Queue');
});

test('/queue shows at least one td cell containing an @ character', async ({ page }) => {
  await page.goto('/queue');
  await expect(page.locator('table tbody td', { hasText: '@' }).first()).toBeVisible();
});
