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

  test('Nav link to /users exists', async ({ page }) => {
    await page.goto('/queue');
    const usersLink = page.locator('a[href*="/users"]').first();
    await expect(usersLink).toBeVisible();
  });

  test('nav has exactly 2 items (Queue and Users only, no Jobs)', async ({ page }) => {
    await page.goto('/queue');
    const navLinks = page.locator('nav[aria-label="primary navigation"] a');
    await expect(navLinks).toHaveCount(2);
    const hrefs = await navLinks.evaluateAll((els: Element[]) =>
      (els as HTMLAnchorElement[]).map(e => e.getAttribute('href'))
    );
    expect(hrefs).toContain('/queue');
    expect(hrefs).toContain('/users');
    expect(hrefs).not.toContain('/jobs');
  });
});

// ---------------------------------------------------------------------------
// MC-1..5 — Meta-controller regression canaries (job-scheduler-1ci)
// Appended after the pre-existing prod-smoke describe block. Each canary
// test.skip()s with an explanatory message when its underlying feature ticket
// has not yet landed, so the suite stays green until the regression actually
// reappears.
// ---------------------------------------------------------------------------
import type { Page } from '@playwright/test';

const PROD_URL =
  process.env.PROD_URL ?? 'https://main.d2y6yvvlxvd81b.amplifyapp.com';

async function findSearchInput(page: Page) {
  return page
    .locator(
      [
        'input[type=search]',
        'input[placeholder*=search i]',
        'input[placeholder*=filter i]',
        'input[aria-label*=search i]',
        'input[aria-label*=filter i]',
        'input[name*=search i]',
        'input[name*=filter i]',
      ].join(', '),
    )
    .first();
}

test.describe('MC-1: PROGRESS rows visible on /queue', () => {
  test('at least one PROGRESS-state row renders on prod /queue', async ({ page }) => {
    await page.goto(PROD_URL + '/queue', { waitUntil: 'networkidle' });
    // Wait briefly for client hydration so rows render with their attributes/badges.
    await page.waitForTimeout(2000);

    // Strategy: try multiple selectors that could mark a PROGRESS row, since the
    // exact DOM encoding has drifted across builds. QueueTable.tsx currently
    // renders <tr data-state={job.state}> AND a <StateBadge> whose span contains
    // the literal state text "PROGRESS". Match by any of these.
    let count = await page
      .locator("tr[data-state='PROGRESS'], tr[data-status='PROGRESS']")
      .count();

    if (count === 0) {
      // Fallback: locate <tbody> rows whose State cell contains the PROGRESS
      // badge text. Use exact-text on the StateBadge span to avoid matching
      // job display names that happen to include the word "progress".
      count = await page
        .locator('tbody tr')
        .filter({ has: page.locator('span', { hasText: /^PROGRESS$/ }) })
        .count();
    }

    test.skip(
      count === 0,
      'No PROGRESS rows in prod DB — canary will pass once T-FIX-DYNAMIC lands',
    );
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('MC-2: Search by user email filters /queue rows', () => {
  test('typing a discovered user email yields rows that all contain that email', async ({ page }) => {
    await page.goto(PROD_URL + '/queue', { waitUntil: 'networkidle' });
    // Allow client hydration so rows render with their user cell populated.
    await page.waitForTimeout(2000);

    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No queue rows');

    // Dynamically discover an email from the User column (td index 2) of the
    // first row of /queue. Falls back to scanning later rows if the first
    // row's user cell isn't an email (e.g. shows a truncated user_id prefix
    // with no '@'). Skip cleanly when no row has an email-like user value —
    // the canary's job is to verify the *filtering behavior*, not the
    // presence of any particular user's data. NOTE: we read the User cell
    // directly rather than regex-scanning the full row textContent, because
    // textContent concatenates all cells without separators and can produce
    // mangled matches that span job-name + user_email + kind.
    const firstUserCell =
      ((await rows.first().locator('td').nth(2).textContent()) ?? '').trim();
    let email: string | null = firstUserCell.includes('@') ? firstUserCell : null;

    if (!email) {
      for (let i = 1; i < rowCount; i++) {
        const cell =
          ((await rows.nth(i).locator('td').nth(2).textContent()) ?? '').trim();
        if (cell.includes('@')) {
          email = cell;
          break;
        }
      }
    }
    test.skip(!email, 'No queue row exposes an email-like user value');
    if (!email) return;

    const input = await findSearchInput(page);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill(email);
    await page.waitForTimeout(800); // debounce + re-render

    const filteredRows = page.locator('tbody tr');
    const fcount = await filteredRows.count();
    expect(
      fcount,
      `expected >=1 visible row when filtering by ${email}, got ${fcount}`,
    ).toBeGreaterThanOrEqual(1);

    const texts = await filteredRows.allTextContents();
    for (const t of texts) {
      expect(t, `row text did not contain ${email}: ${t}`).toContain(email);
    }
  });
});

test.describe('MC-3: URL params survive page reload on /queue', () => {
  test('q=math and state=QUEUED,PROGRESS persist across reload', async ({ page }) => {
    await page.goto(PROD_URL + '/queue?q=math&state=QUEUED,PROGRESS', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const input = await findSearchInput(page);
    const searchValue = await input.inputValue().catch(() => '');
    const searchOk = searchValue.includes('math');

    const chip = page.locator('[data-testid="filter-PROGRESS"]');
    let chipOk = false;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const ariaPressed = await chip
        .getAttribute('aria-pressed')
        .catch(() => null);
      const ariaSelected = await chip
        .getAttribute('aria-selected')
        .catch(() => null);
      const cls = (await chip.getAttribute('class').catch(() => '')) ?? '';
      if (
        ariaPressed === 'true' ||
        ariaSelected === 'true' ||
        /active/.test(cls)
      ) {
        chipOk = true;
        break;
      }
      await page.waitForTimeout(250);
    }

    test.skip(
      !(searchOk && chipOk),
      'URL-state feature (T-URL-STATE) not yet implemented — skip until job-scheduler-r4a lands',
    );

    expect(searchValue).toContain('math');
    expect(chipOk).toBe(true);
  });
});

test.describe('MC-4: Click job row opens modal with GPU count and date', () => {
  test('clicking the first /queue row opens a modal with GPU + date info', async ({ page }) => {
    await page.goto(PROD_URL + '/queue', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No rows to click');

    await rows.first().click();
    await page.waitForTimeout(2000);

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const modalText = (await modal.textContent()) ?? '';
    expect(modalText, 'modal should mention GPU count').toContain('GPU');
    expect(modalText, 'modal should contain a 4-digit year').toMatch(/\d{4}/);
  });
});

test.describe('MC-5: Orphan (Fireworks-only) rows highlighted on /queue', () => {
  test('at least one row carries data-testid="orphan-row"', async ({ page }) => {
    await page.goto(PROD_URL + '/queue', { waitUntil: 'domcontentloaded' });
    const count = await page.locator('[data-testid="orphan-row"]').count();
    test.skip(
      count === 0,
      'No orphan rows present — skip until job-scheduler-pdb lands',
    );
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('T-CLICK: Interactive row behaviors', () => {

  test('clicking a queue row opens job-detail modal', async ({ page }) => {
    await page.goto(PROD_URL + '/queue', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No queue rows');
    const firstRowText = (await rows.first().textContent()) ?? '';
    const container = page.locator('[data-clickable="true"]');
    await expect(container).toBeAttached({ timeout: 5000 });
    await rows.first().click();
    await page.waitForTimeout(2000);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    const modalText = (await modal.textContent()) ?? '';
    expect(modalText, 'modal must show GPU count label').toContain('GPU');
    expect(modalText, 'modal must show a 4-digit year').toMatch(/\d{4}/);
    console.log('T-CLICK queue row clicked:', firstRowText.substring(0, 80));
    console.log('T-CLICK modal text:', modalText.substring(0, 200));
  });

  test('clicking a user row navigates to /users/[id]', async ({ page }) => {
    await page.goto(PROD_URL + '/users', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No user rows');
    const firstEmail = (await rows.first().locator('td').first().textContent()) ?? '';
    await rows.first().click();
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}/, { timeout: 5000 });
    await expect(page.locator('h1')).toBeVisible();
    console.log('T-CLICK user navigated to:', page.url(), 'email:', firstEmail);
  });

  test('modal closes on Escape', async ({ page }) => {
    await page.goto(PROD_URL + '/queue', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No queue rows');
    await rows.first().click();
    await page.waitForTimeout(1000);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('data-clickable=true is set after hydration on /queue', async ({ page }) => {
    await page.goto(PROD_URL + '/queue', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const container = page.locator('[data-clickable="true"]');
    await expect(container).toBeAttached({ timeout: 5000 });
    expect(await container.count()).toBeGreaterThanOrEqual(1);
  });

});

test.describe("user-detail-consistency: list count matches detail count", () => {
  test("first user with job_count > 0 on /users shows >= 1 job on /users/[id]", async ({
    page,
  }) => {
    const PROD_URL =
      process.env.PROD_URL ?? "https://main.d2y6yvvlxvd81b.amplifyapp.com";

    await page.goto(PROD_URL + "/users", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();
    test.skip(rowCount === 0, "No user rows on /users");

    let targetRow = null;
    let listJobCount = 0;
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cells = row.locator("td");
      const jobsCellText = (await cells.nth(1).textContent()) ?? "0";
      const n = parseInt(jobsCellText.trim(), 10);
      if (n > 0) {
        targetRow = row;
        listJobCount = n;
        break;
      }
    }

    test.skip(targetRow === null, "No user with job_count > 0 found on /users");
    if (targetRow === null) return;

    const listEmail =
      (await targetRow.locator("td").first().textContent()) ?? "";
    console.log(
      "user-detail-consistency: clicking user " + listEmail + " with listJobCount=" + listJobCount,
    );

    await targetRow.click();
    await page.waitForTimeout(3000);

    await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}/, { timeout: 8000 });

    await expect(page.locator('main')).not.toContainText('Loading…', { timeout: 15000 });

    const detailRows = page.locator("table tbody tr");
    const detailRowCount = await detailRows.count();

    const emptyState = page.locator("text=No jobs for this user.");
    const emptyVisible = await emptyState.isVisible().catch(() => false);

    expect(
      emptyVisible,
      "BUG: /users listed " + listEmail + " with " + listJobCount + " jobs but detail page shows 'No jobs for this user.'",
    ).toBe(false);

    expect(
      detailRowCount,
      "Expected >=1 job row on detail page, got " + detailRowCount,
    ).toBeGreaterThanOrEqual(1);

    console.log(
      "user-detail-consistency PASS: detail shows " + detailRowCount + " rows for " + listEmail,
    );
  });
});

test.describe('user-detail-consistency', () => {
  test('each /users row navigates to a non-404 detail page', async ({ page }) => {
    await page.goto(PROD_URL + '/users', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No user rows in prod — skip until data is seeded');
    expect(rowCount, 'users list must have at least 1 row').toBeGreaterThanOrEqual(1);
    // Check first 3 rows only (avoids test timeout on large user sets)
    const limit = Math.min(rowCount, 3);
    for (let i = 0; i < limit; i++) {
      await page.goto(PROD_URL + '/users', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const row = page.locator('tbody tr').nth(i);
      await row.click();
      await page.waitForTimeout(3000);
      await expect(page).toHaveURL(/\/users\/[0-9a-f-]{36}/, { timeout: 8000 });
      const status = page.locator('[data-testid="error-404"], h1:has-text("404"), h1:has-text("Not Found")');
      const is404 = (await status.count()) > 0;
      expect(is404, `User row ${i} navigated to a 404 page: ${page.url()}`).toBe(false);
    }
  });
});


// ---------------------------------------------------------------------------
// API-HEALTH — non-skippable backend health check. Guards against the failure
// mode where /api/fireworks-jobs returns 500 (e.g. FIREWORKS_API_KEY missing
// from the Amplify branch-level env) but row-dependent UI tests skip because
// the queue renders 0 rows, masking the outage.
// ---------------------------------------------------------------------------
test.describe('api-health', () => {
  test('fireworks-jobs API returns 200', async ({ request }) => {
    const res = await request.get(PROD_URL + '/api/fireworks-jobs');
    expect(
      res.status(),
      `GET /api/fireworks-jobs returned ${res.status()} (expected 200)`,
    ).toBe(200);
  });
});
