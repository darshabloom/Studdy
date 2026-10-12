import { expect, test, type Page } from '@playwright/test';
import { clickUntilNavigated } from './helpers/navigation';
import { snap } from './helpers/screens';

/**
 * The Tutor workspace: its six destinations, the Calendar that requests and
 * availability now sit inside, and the edges it must not let anyone past.
 *
 * WHAT THIS PROVES: that a tutor reaches Home, Calendar, Students, Lessons,
 * Earnings and Resources from one top navigation with no sidebar; that the
 * existing request and availability screens are views of the Calendar rather
 * than separate places; that a tutor with no booked lessons is shown honest
 * empty states, not sample students or earnings; and that a student or lesson
 * reference that is not theirs is simply not found.
 *
 * The populated views — a booked lesson, a student, an amount earned — are
 * proved against a real database in `tutor-workspace.integration.test.ts` and in
 * unit tests: a booking needs a verified payment event this suite cannot produce
 * through the browser.
 *
 * READ-ONLY, as `tutor.a@`. It changes nothing and never signs out, so it can
 * share that account with the request journey that owns it.
 */

const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';
const TUTOR = 'tutor.a@local.studdy.test';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

const workspaceNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Workspace', exact: true });

test.describe('tutor workspace', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  /*
   * What the browser was still waiting on, and anything it complained about.
   * A navigation that silently does not happen leaves the page text unchanged,
   * so the text alone cannot say whether a request never came back or the page
   * had everything and did not move.
   */
  const pending = new Set<string>();
  const notes: string[] = [];
  test.beforeEach(({ page }) => {
    pending.clear();
    notes.length = 0;
    const key = (request: { method(): string; url(): string }) =>
      `${request.method()} ${request.url()}`;
    page.on('request', (request) => pending.add(key(request)));
    page.on('requestfinished', (request) => pending.delete(key(request)));
    page.on('requestfailed', (request) => {
      pending.delete(key(request));
      notes.push(`failed: ${request.url()} ${request.failure()?.errorText ?? ''}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        notes.push(`${message.type()}: ${message.text().slice(0, 300)}`);
      }
    });
    page.on('pageerror', (error) => notes.push(`pageerror: ${error.message.slice(0, 300)}`));
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '(page text unavailable)');
    console.log(`FAILED AT ${page.url()}\n${text.slice(0, 2000)}`);
    console.log(`STILL PENDING (${String(pending.size)})\n${[...pending].join('\n')}`);
    console.log(`BROWSER NOTES (${String(notes.length)})\n${notes.join('\n')}`);
  });

  test('top navigation reaches all six destinations, with no sidebar', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page, TUTOR);
    await page.goto('/tutor');

    const nav = workspaceNav(page);
    await expect(nav.getByRole('link')).toHaveText([
      'Home',
      'Calendar',
      'Students',
      'Lessons',
      'Earnings',
      'Resources',
    ]);
    await expect(page.getByRole('complementary')).toHaveCount(0);

    for (const [label, url, heading] of [
      ['Calendar', /\/tutor\/calendar$/, 'Calendar'],
      ['Students', /\/tutor\/students$/, 'Students'],
      ['Lessons', /\/tutor\/lessons$/, 'Lessons'],
      ['Earnings', /\/tutor\/earnings$/, 'Earnings'],
      ['Resources', /\/tutor\/resources$/, 'Resources'],
    ] as const) {
      await clickUntilNavigated(page, nav.getByRole('link', { name: label }));
      await expect(page).toHaveURL(url, { timeout: 15_000 });
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
      await snap(page, `tutor-${label.toLowerCase()}`);
    }

    // Setup is still one click away, beside the account.
    await expect(page.getByRole('banner').getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Services' })).toBeVisible();
  });

  test('home shows the locked dashboard and nothing invented', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor');

    await expect(page.getByText('Next lesson', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Needs action', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Upcoming lessons' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Earnings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your week' })).toBeVisible();
    await expect(page.getByText(/Students needing attention/i)).toHaveCount(0);
    await snap(page, 'tutor-home');

    await clickUntilNavigated(page, page.getByRole('link', { name: 'Open calendar' }));
    await expect(page).toHaveURL(/\/tutor\/calendar$/, { timeout: 15_000 });
  });

  test('requests and availability are views of the calendar', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page, TUTOR);
    await page.goto('/tutor/calendar');

    const views = page.getByRole('navigation', { name: 'Calendar views' });
    await expect(views.getByRole('link')).toHaveText([
      'Calendar',
      /^Requests/,
      'Availability',
      'Recurring',
    ]);
    // A real week grid, with the step and mode controls.
    await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Month' })).toBeVisible();

    await clickUntilNavigated(page, page.getByRole('link', { name: 'Month' }));
    await expect(page).toHaveURL(/\/tutor\/calendar\/month/, { timeout: 15_000 });
    await snap(page, 'tutor-calendar-month');

    // The existing request screen, now inside the Calendar.
    await clickUntilNavigated(page, views.getByRole('link', { name: /^Requests/ }));
    await expect(page).toHaveURL(/\/tutor\/requests$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Lesson requests' })).toBeVisible();
    await expect(workspaceNav(page).getByRole('link', { name: 'Calendar' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // And the existing availability editor.
    await clickUntilNavigated(
      page,
      page.getByRole('navigation', { name: 'Calendar views' }).getByRole('link', {
        name: 'Availability',
      }),
    );
    await expect(page).toHaveURL(/\/tutor\/availability$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Your availability' })).toBeVisible();
    await snap(page, 'tutor-availability');

    await clickUntilNavigated(
      page,
      page.getByRole('navigation', { name: 'Calendar views' }).getByRole('link', {
        name: 'Recurring',
      }),
    );
    await expect(page).toHaveURL(/\/tutor\/calendar\/recurring$/, { timeout: 15_000 });
    await expect(page.getByText(/Recurring lessons are not available yet/)).toBeVisible();
  });

  test('earnings speaks only of the tutor’s own money', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/earnings');
    await expect(page.getByRole('heading', { level: 1, name: 'Earnings' })).toBeVisible({
      timeout: 15_000,
    });
    for (const tile of ['Earned', 'Pending', 'Paid out', 'Expected']) {
      await expect(page.getByText(tile, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('Payout status', { exact: true })).toBeVisible();
    const text = await page.getByRole('main').innerText();
    expect(text).not.toMatch(/card declined|payment intent|pi_|acct_|ch_/i);
  });

  test('a student or lesson that is not this tutor’s is not found', async ({ page }) => {
    await signIn(page, TUTOR);
    for (const path of ['/tutor/students/STUDENT-00000000', '/tutor/lessons/BK-00000000']) {
      await page.goto(path);
      await expect(page.getByText(/could not be found/i), path).toBeVisible({ timeout: 15_000 });
    }
  });
});
