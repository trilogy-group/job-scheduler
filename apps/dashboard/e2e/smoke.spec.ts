import { test, expect } from '@playwright/test';
test('queue page loads', async ({ page }) => {
  await page.goto('/queue');
  await expect(page.locator('h2')).toContainText('Queue');
});
