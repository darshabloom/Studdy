import { expect, test, type Page } from '@playwright/test';
import { clickUntilNavigated } from './helpers/navigation';
import { snap } from './helpers/screens';

/**
 * The Parent workspace: its five destinations, the student record, and the
 * edges it must not let anyone past.
 *
 * WHAT THIS PROVES: that a parent reaches Home, Students, Bookings, Payments and
 * Tutors from one top navigation with no sidebar; that a student can be added,
 * opened and corrected; that a family with no history is shown honest empty
 * states rather than sample data; that nothing on the payment screens uses
 * Studdy's internal money vocabulary; and that a reference belonging to nobody
 * in this family is simply not found.
 *
 * The journey that FILLS these screens — request, acceptance, choice, payment,
 * booking — is proved against a real database in
 * `family-overview.integration.test.ts`, because confirming a booking needs a
 * verified payment event this suite cannot produce through the browser.
 *
 * ONE DEDICATED ACCOUNT, `parent.workspace@`, which no other spec may sign in
 * as. The journey survives being run twice: the student is only added when
 * absent, and the edit sets a value rather than toggling one.
 */

const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';
const PARENT = 'parent.workspace@local.studdy.test';
const STUDENT = 'Wren';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

const workspaceNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Workspace', exact: true });

async function ensureStudent(page: Page): Promise<void> {
  await page.goto('/parent');
  await expect(
    page.getByRole('heading', { name: /Add your first student|Your students/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
  if ((await page.getByRole('link', { name: STUDENT, exact: true }).count()) > 0) return;

  await clickUntilNavigated(
    page,
    page.getByRole('link', { name: /Add a student|Add your first student/ }).first(),
  );
  await page.getByLabel("Student's first name").fill(STUDENT);
  await page.getByLabel('Family name').fill('Tester');
  await page.getByLabel('School year').selectOption({ label: 'Year 8' });
  await page.getByRole('button', { name: 'Add student' }).click();
  await expect(page).toHaveURL(/\/parent$/, { timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('parent workspace', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '(page text unavailable)');
    console.log(`FAILED AT ${page.url()}\n${text.slice(0, 2000)}`);
  });

  test('top navigation reaches all five destinations, with no sidebar', async ({ page }) => {
    await signIn(page, PARENT);
    await ensureStudent(page);

    const nav = workspaceNav(page);
    await expect(nav.getByRole('link')).toHaveText([
      'Home',
      'Students',
      'Bookings',
      'Payments',
      'Tutors',
    ]);
    // The old shell's sidebar is a complementary landmark; this one has none.
    await expect(page.getByRole('complementary')).toHaveCount(0);

    for (const [label, url, heading] of [
      ['Students', /\/parent\/students$/, 'Students'],
      ['Bookings', /\/parent\/bookings$/, 'Bookings'],
      ['Payments', /\/parent\/payments$/, 'Payments'],
      ['Tutors', /\/parent\/tutors$/, 'Tutors'],
    ] as const) {
      await clickUntilNavigated(page, nav.getByRole('link', { name: label }));
      await expect(page).toHaveURL(url, { timeout: 15_000 });
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
      await snap(page, `parent-${label.toLowerCase()}`);
    }

    // The same bar on a phone: still across the top, still all five.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/parent');
    await expect(nav.getByRole('link', { name: 'Payments' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('complementary')).toHaveCount(0);
  });

  test('home shows the next lesson, payments due, students and recent updates', async ({
    page,
  }) => {
    await signIn(page, PARENT);
    await ensureStudent(page);

    // A family with no history is told so; nothing is filled in for effect.
    await expect(page.getByText('Next lesson', { exact: true })).toBeVisible();
    await expect(page.getByText('No lessons booked yet')).toBeVisible();
    await expect(page.getByText('Payments due', { exact: true })).toBeVisible();
    await expect(page.getByText('Nothing to pay')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your students' })).toBeVisible();
    await expect(page.getByRole('link', { name: STUDENT, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent updates' })).toBeVisible();
    await snap(page, 'parent-home');
  });

  test('a student can be opened and their details corrected', async ({ page }) => {
    await signIn(page, PARENT);
    await ensureStudent(page);

    await clickUntilNavigated(page, page.getByRole('link', { name: STUDENT, exact: true }));
    await expect(page).toHaveURL(/\/parent\/students\/STUDENT-\d+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1, name: /Wren/ })).toBeVisible();

    // What Studdy cannot show yet is said in a sentence, not drawn as if it existed.
    await expect(
      page.getByRole('heading', { name: 'Lesson notes, homework and progress' }),
    ).toBeVisible();
    await expect(page.getByText(/Not available yet/)).toBeVisible();
    await snap(page, 'parent-student');

    await clickUntilNavigated(page, page.getByRole('link', { name: 'Edit details' }));
    await expect(page).toHaveURL(/\/edit$/, { timeout: 15_000 });
    await expect(page.getByLabel("Student's first name")).toHaveValue(STUDENT);
    await snap(page, 'parent-student-edit');
    await page.getByLabel('School (optional)').fill('Kōwhai College');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page).toHaveURL(/\/parent\/students\/STUDENT-\d+$/, { timeout: 15_000 });
    await expect(page.getByText(/Kōwhai College/)).toBeVisible();
  });

  test('bookings keeps requests apart from bookings, and defers recurring honestly', async ({
    page,
  }) => {
    await signIn(page, PARENT);
    await page.goto('/parent/bookings');

    const views = page.getByRole('navigation', { name: 'Booking views' });
    await expect(views.getByRole('link')).toHaveText([
      /^Upcoming/,
      /^Requests/,
      'Calendar',
      'Recurring',
      'Past',
    ]);
    await expect(page.getByText(/No upcoming lessons/)).toBeVisible();

    await views.getByRole('link', { name: /^Requests/ }).click();
    await expect(page).toHaveURL(/view=requests/, { timeout: 15_000 });
    await expect(page.getByText(/A request is a question to a tutor, not a booking/)).toBeVisible();

    await views.getByRole('link', { name: 'Recurring' }).click();
    await expect(page).toHaveURL(/view=recurring/, { timeout: 15_000 });
    await expect(page.getByText(/Recurring lessons are not available yet/)).toBeVisible();

    await views.getByRole('link', { name: 'Calendar' }).click();
    await expect(page).toHaveURL(/view=calendar/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Next →' })).toBeVisible();
    await snap(page, 'parent-bookings-calendar');
  });

  test('payments speaks only in the family’s terms', async ({ page }) => {
    await signIn(page, PARENT);

    for (const view of ['', '?view=history', '?view=refunds', '?view=methods']) {
      await page.goto(`/parent/payments${view}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Payments' })).toBeVisible({
        timeout: 15_000,
      });
      const text = await page.getByRole('main').innerText();
      expect(text).not.toMatch(/commission|platform fee|payout|settlement|transfer|entitlement/i);
    }
    await expect(page.getByText(/does not keep a card on file yet/)).toBeVisible();
    await snap(page, 'parent-payment-methods');
  });

  test('a reference from outside this family is not found', async ({ page }) => {
    await signIn(page, PARENT);

    for (const path of [
      '/parent/students/STUDENT-00000000',
      '/parent/students/STUDENT-00000000/edit',
      '/parent/bookings/BK-00000000',
    ]) {
      // The workspace streams behind a loading boundary, so the status line has
      // already gone out by the time the page decides; the not-found page is
      // what the visitor is actually shown.
      await page.goto(path);
      await expect(page.getByText(/could not be found/i), path).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('link', { name: 'Edit details' })).toHaveCount(0);
    }
  });
});
