// T19-E prod smoke suite — 5 structural assertions against live prod URL
import { test, expect } from '@playwright/test';

test.describe('prod-smoke', () => {
  test('Active Queue heading is visible on /queue and contains no regression marker', async ({ page }) => {
    await page.goto('/queue');
    const heading = page.locator('h1', { hasText: 'Active Queue' });
    await expect(heading).toBeVisible();
    await expect(heading).not.toContainText('REGRESSION-MARKER');
  });

  test('/queue exposes a search input with aria-label="search jobs"', async ({ page }) => {
    await page.goto('/queue');
    const search = page.locator('input[aria-label="search jobs"]');
    await expect(search).toBeVisible();
  });

  test('/queue exposes a filter chip with data-testid="filter-QUEUED"', async ({ page }) => {
    await page.goto('/queue');
    const chip = page.locator('[data-testid="filter-QUEUED"]');
    await expect(chip).toBeVisible();
  });

  test('Nav link to /jobs exists', async ({ page }) => {
    await page.goto('/queue');
    const jobsLink = page.locator('a[href*="/jobs"]').first();
    await expect(jobsLink).toBeVisible();
  });

  test('Nav link to /users exists', async ({ page }) => {
    await page.goto('/queue');
    const usersLink = page.locator('a[href*="/users"]').first();
    await expect(usersLink).toBeVisible();
  });
});
