import { expect, test, type Page, type TestInfo } from '@playwright/test';

/**
 * End-to-end journeys for the Intended Lesson Request slice.
 *
 * Covers both booking paths through the same screens, plus the tutor
 * read-only view and its temporary-hold presentation.
 *
 * Accept/decline, selection and payment are deliberately absent — they belong
 * to later slices and the interface says so rather than showing dead controls.
 *
 * These journeys use DEDICATED seeded accounts. Playwright runs spec files in
 * parallel, so a journey that mutates an account shared with another spec
 * races it; `describe.configure({ mode: 'serial' })` only orders tests within
 * one file.
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';
const REQUEST_PARENT = 'parent.requests@local.studdy.test';
const REQUEST_STUDENT = 'student.requests@local.studdy.test';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

/** A date input value a few days ahead, comfortably past minimum notice. */

/**
 * A lesson date unique to this attempt.
 *
 * A sent request leaves a live hold on the tutor's calendar, and the platform
 * is correct to refuse a second request overlapping it — that is PD-010 and the
 * GiST exclusion constraint doing their job. So an attempt that re-books the
 * identical slot fails on a rule the application is right to enforce, and the
 * real failure is masked by a misleading one.
 *
 * A family sending another request while the first is still live would pick a
 * different time, so each attempt does too. Whole weeks keep the same weekday,
 * so weekly availability rules still match, and moving further out only
 * increases notice — there is no maximum booking horizon to breach.
 *
 * Cleaning up at the end of the journey instead would not survive a failure
 * midway, which is precisely when the next attempt runs.
 */
function attemptDateValue(testInfo: TestInfo, baseDaysAhead: number): string {
  const attempt = testInfo.repeatEachIndex * 8 + testInfo.retry;
  return nextWeekdayValue(LESSON_WEEKDAY, baseDaysAhead + attempt * 7);
}

/**
 * The next `weekday` falling at least `daysAhead` out, as 'YYYY-MM-DD'.
 *
 * The server now refuses a time the tutor does not offer, so a lesson date can
 * no longer be "some day next week" — it has to land on a weekday the tutor
 * actually works, or the send fails for a reason that has nothing to do with
 * what the test is checking.
 */
function nextWeekdayValue(weekday: number, daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setUTCHours(0, 0, 0, 0);
  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Tuesday at 17:00 is the one slot both seeded maths tutors offer — Aroha works
 * 16:00–19:00 and James 17:00–19:00 — so the journey holds whichever of them
 * discovery happens to list first.
 */
const LESSON_WEEKDAY = 2;
const LESSON_START_TIME = '17:00';

/**
 * Ensure the signed-in account has a student and a subject need, creating them
 * through the interface if absent, and finish on scoped tutor discovery.
 */
async function ensureSubjectNeed(page: Page, dashboard: string): Promise<void> {
  await page.goto(dashboard);

  // `locator.count()` does NOT auto-wait, so every branch below must be taken
  // only after the dashboard has actually rendered. Wait for whichever of the
  // two possible states appears first.
  // Four possible headings: empty/populated × parent/independent.
  const dashboardHeading = page.getByRole('heading', {
    name: /Add your first student|Set up your learning profile|Your students|Your learning/,
  });
  await expect(dashboardHeading.first()).toBeVisible({ timeout: 15_000 });

  const addStudent = page
    .getByRole('link', { name: /Add a student|Add your first student|Set up my profile/ })
    .first();
  if ((await addStudent.count()) > 0) {
    await addStudent.click();
    // The same form serves both paths with different wording: a guardian adds
    // a student, an independent student sets up their own profile.
    await page.getByLabel(/Student's first name|Your first name/).fill('Reqi');
    await page.getByLabel('Family name').fill('Tester');
    await page.getByLabel('School year').selectOption({ label: 'Year 9' });
    await page.getByRole('button', { name: /Add student|Save my profile/ }).click();
    // Anchored: `/parent` alone also matches `/parent/students/new`, so a
    // failed submission would slip through unnoticed.
    await expect(page).toHaveURL(new RegExp(`${dashboard}$`));
  }

  // If the account already has a subject need, follow its "Find tutors" link
  // rather than creating a duplicate. Wait for the dashboard again first: the
  // add-student redirect re-renders it.
  await expect(page.getByRole('link', { name: /Add a subject|Find tutors/ }).first()).toBeVisible({
    timeout: 15_000,
  });
  const findTutors = page.getByRole('link', { name: 'Find tutors' }).first();
  if ((await findTutors.count()) > 0) {
    await findTutors.click();
  } else {
    await page
      .getByRole('link', { name: /Add a subject/ })
      .first()
      .click();
    // Pinned rather than positional: the journey depends on reaching tutors
    // whose seeded availability covers the lesson time chosen below.
    await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' });
    await page.getByLabel('School year for this subject').selectOption({ label: 'Year 9' });
    await page.getByRole('button', { name: 'Save and find tutors' }).click();
  }
}

/** Shortlist a tutor for a subject, then open the shortlist review. */
async function shortlistAndCompose(page: Page, dashboard: string): Promise<void> {
  await ensureSubjectNeed(page, dashboard);

  await expect(page).toHaveURL(/\/tutors/);

  // Readiness here is "the tutor list has rendered", and a rendered tutor shows
  // one of two controls: the add button, or the badge saying it is already on
  // the shortlist. Waiting only for the button assumed a pristine account, so
  // any second run — including a Playwright retry after an unrelated failure
  // elsewhere in this serial file — waited 15s for a control the application is
  // correct never to show twice, and failed with a misleading timeout.
  // Note count() does not auto-wait, so the combined locator must settle first.
  const addToShortlist = page.getByRole('button', { name: 'Add to shortlist' });
  const onShortlist = page.getByText('On your shortlist');
  await expect(addToShortlist.or(onShortlist).first()).toBeVisible({ timeout: 15_000 });

  if ((await addToShortlist.count()) > 0) {
    await addToShortlist.first().click();
  }

  await expect(page.getByRole('link', { name: 'Review shortlist' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Review shortlist' }).first().click();
  await expect(page.getByRole('heading', { name: 'Your shortlist' })).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.describe('lesson requests', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test('parent: shortlist → compose → send → awaiting responses', async ({ page }, testInfo) => {
    await signIn(page, REQUEST_PARENT);
    await shortlistAndCompose(page, '/parent');

    await page.getByRole('link', { name: /Send request/i }).click();
    await expect(page.getByRole('heading', { name: 'Send your lesson request' })).toBeVisible();

    // Honest payment copy: nothing may claim a card exists.
    await expect(page.getByText('You will not be charged when requests are sent')).toBeVisible();
    await expect(page.getByText('your card will not be charged')).toHaveCount(0);

    await page.getByLabel('Lesson date').fill(attemptDateValue(testInfo, 6));
    await page.getByLabel('Start time').fill(LESSON_START_TIME);
    await page.getByRole('button', { name: /Send request to/ }).click();

    await expect(page).toHaveURL(/\/requests\/LR-\d{8}/);
    await expect(page.getByText('Awaiting responses')).toBeVisible();
    await expect(page.getByText('Awaiting response').first()).toBeVisible();

    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: 'Lesson requests' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View request' }).first()).toBeVisible();
  });

  test('parent: withdrawing the request closes it and frees the held time', async ({ page }) => {
    await signIn(page, REQUEST_PARENT);
    await page.goto('/requests');
    await page.getByRole('link', { name: 'View request' }).first().click();

    await page.getByRole('button', { name: 'Withdraw the whole request' }).click();
    await expect(page).toHaveURL(/\/requests\/LR-\d{8}/);
    await expect(page.getByText('This request is closed')).toBeVisible();
    // The shortlist survives, so the family can send a fresh request.
    await expect(page.getByText('Your shortlist is still saved')).toBeVisible();
  });

  test('independent student: same journey through the same screens', async ({ page }, testInfo) => {
    await signIn(page, REQUEST_STUDENT);
    await shortlistAndCompose(page, '/student');

    await page.getByRole('link', { name: /Send request/i }).click();
    await expect(page.getByRole('heading', { name: 'Send your lesson request' })).toBeVisible();
    // A week past the parent's lesson: same weekday and time, different date,
    // so this send cannot collide with a hold that journey left behind.
    await page.getByLabel('Lesson date').fill(attemptDateValue(testInfo, 13));
    await page.getByLabel('Start time').fill(LESSON_START_TIME);
    await page.getByRole('button', { name: /Send request to/ }).click();

    await expect(page).toHaveURL(/\/requests\/LR-\d{8}/);
    await expect(page.getByText('Awaiting responses')).toBeVisible();
  });

  test('tutor: sees only their own request, with a labelled temporary hold', async ({ page }) => {
    await signIn(page, 'tutor.a@local.studdy.test');
    await page.goto('/tutor/requests');
    await expect(page.getByRole('heading', { name: 'Lesson requests' })).toBeVisible();

    // Responding is honestly deferred, not faked with dead controls.
    await expect(page.getByText('Responding opens in the next release')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Decline' })).toHaveCount(0);

    const holds = page.getByText('Temporary request hold');
    if ((await holds.count()) > 0) {
      await expect(holds.first()).toBeVisible();
      await expect(
        page.getByText(/This time is held in your calendar until/).first(),
      ).toBeVisible();
      await expect(page.getByText(/released automatically/).first()).toBeVisible();
    }

    // Nothing on the page may reveal a competitor, a fan-out or an ILR.
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('lr-');
    expect(body).not.toContain('other tutor');
    expect(body).not.toContain('another tutor');
    expect(body).not.toContain('tutors you asked');
    expect(body).not.toContain('position');
    const html = await page.content();
    expect(html).not.toMatch(/intendedLessonRequestId/i);
  });

  test('a tutor cannot reach the family request routes', async ({ page }) => {
    await signIn(page, 'tutor.a@local.studdy.test');
    await page.goto('/requests');
    // A tutor has no student profiles, so the family view shows nothing —
    // never another family's request.
    await expect(page.getByText('No lesson requests yet')).toBeVisible();
  });
});

test.describe('scheduled expiry endpoint', () => {
  test('refuses a request without the shared secret', async ({ request }) => {
    const response = await request.post('/api/jobs/expire-requests');
    expect(response.status()).toBe(401);
  });

  test('refuses a secret supplied in the query string', async ({ request }) => {
    const response = await request.post(
      '/api/jobs/expire-requests?secret=local-development-cron-secret',
    );
    expect(response.status()).toBe(401);
  });

  test('refuses GET, because expiry mutates state', async ({ request }) => {
    const response = await request.get('/api/jobs/expire-requests');
    expect(response.status()).toBe(405);
  });

  test('runs with the shared secret and reports counts only', async ({ request }) => {
    const response = await request.post('/api/jobs/expire-requests', {
      headers: { Authorization: 'Bearer local-development-cron-secret' },
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['ok']).toBe(true);
    expect(typeof body['expiredTutorRequests']).toBe('number');
    expect(typeof body['releasedHolds']).toBe('number');
    // The response carries counts, never request details.
    expect(JSON.stringify(body)).not.toMatch(/LR-|TREQ-/);
  });
});
