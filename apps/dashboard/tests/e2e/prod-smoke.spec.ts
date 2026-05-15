import { test, expect } from '@playwright/test';

test.describe('Production smoke tests (/queue)', () => {
  test('A: /queue returns 200 and shows Active Queue heading', async ({ page }) => {
    const response = await page.goto('/queue');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Active Queue', level: 1 })).toBeVisible();
  });

  test('B: table has at least one data row from prod data', async ({ page }) => {
    await page.goto('/queue');
    await page.locator('tbody tr').first().waitFor();
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('C: at least one User cell contains an @ email', async ({ page }) => {
    await page.goto('/queue');
    await page.locator('tbody td').filter({ hasText: '@' }).first().waitFor();
    const emailCellCount = await page.locator('tbody td').filter({ hasText: '@' }).count();
    expect(emailCellCount).toBeGreaterThanOrEqual(1);
  });

  test('D: search input is present and accepts text', async ({ page }) => {
    await page.goto('/queue');
    const searchInput = page.locator('input[aria-label="search jobs"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test-input');
    await expect(searchInput).toHaveValue('test-input');
  });

  test('E: typing "qwen" filters the visible row count', async ({ page }) => {
    await page.goto('/queue');
    await page.locator('tbody tr').first().waitFor();

    const countLocator = page.locator('span', { hasText: /\d+ jobs/ }).first();
    await countLocator.waitFor();

    const parseCount = (text: string | null): number => {
      if (!text) return NaN;
      const m = text.match(/(\d+)\s+jobs/);
      return m ? parseInt(m[1], 10) : NaN;
    };

    const beforeText = await countLocator.textContent();
    const beforeCount = parseCount(beforeText);
    expect(Number.isFinite(beforeCount)).toBe(true);

    const searchInput = page.locator('input[aria-label="search jobs"]');
    await searchInput.fill('qwen');

    await page.waitForFunction(
      (prev) => {
        const spans = Array.from(document.querySelectorAll('span'));
        const match = spans
          .map((s) => s.textContent?.match(/(\d+)\s+jobs/))
          .find((m) => m);
        if (!match) return false;
        const current = parseInt(match[1], 10);
        return current !== prev;
      },
      beforeCount,
      { timeout: 10_000 },
    );

    const afterText = await countLocator.textContent();
    const afterCount = parseCount(afterText);

    expect(afterCount).toBeLessThanOrEqual(beforeCount);
    expect(afterCount).toBeGreaterThanOrEqual(1);
  });
});
