import { expect, test, type Page } from '@playwright/test';

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

/**
 * The page text once the workspace has actually resolved.
 *
 * `/tutor` streams a "Loading your workspace" fallback, and `page.goto` returns
 * as soon as the document loads — so reading `innerText` straight afterwards
 * can capture the fallback instead of the answer. That matters most where two
 * responses are compared for being identical: two fallbacks are identical, so
 * the comparison would pass while proving nothing. Waiting for the fallback to
 * clear makes the assertion mean what it says.
 */
async function settledBody(page: Page): Promise<string> {
  await expect(page.getByText('Loading your workspace')).toHaveCount(0);
  return page.locator('body').innerText();
}

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
    await page.getByLabel('School year').selectOption({ label: 'Year 10' });
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
    await page.getByLabel('School year for this subject').selectOption({ label: 'Year 10' });
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
  const addToShortlist = page.getByRole('button', { name: 'Save for later' });
  const onShortlist = page.getByText('Saved for later');
  await expect(addToShortlist.or(onShortlist).first()).toBeVisible({ timeout: 15_000 });

  /*
   * Save EVERY eligible tutor, not just the first.
   *
   * This used to save one, so the "fan-out" journey it set up only ever asked a
   * single tutor and nothing here exercised the thing the multi-tutor path
   * exists for. Waits for the count of unsaved cards to DROP rather than for a
   * fixed pause: saving is a server action followed by a re-render.
   */
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const before = await addToShortlist.count();
    if (before === 0) break;
    await addToShortlist.first().click();
    await page
      .waitForFunction(
        (count) =>
          [...document.querySelectorAll('button')].filter((button) =>
            button.textContent?.includes('Save for later'),
          ).length < count,
        before,
        { timeout: 15_000 },
      )
      .catch(() => {});
  }

  await expect(page.getByRole('link', { name: 'Review shortlist' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Review shortlist' }).first().click();
  await expect(page.getByRole('heading', { name: 'Your shortlist' })).toBeVisible();
}

/**
 * Reach the review screen through the optional multi-tutor journey.
 *
 * Length and format come BEFORE times, because they decide which shortlisted
 * tutors the request can reach and therefore whose availability the times are
 * drawn from. One request is one lesson: every tutor asked gets the same
 * length and the same format, so a chosen start means one interval for all of
 * them.
 */
async function askMultipleAndReview(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Ask multiple tutors' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: /How long should the lesson/ }),
  ).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole('link', { name: /minutes/ })
    .first()
    .click();

  await expect(page.getByRole('heading', { level: 1, name: /Online or in person/ })).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole('link', { name: /^Online|^In person/ })
    .first()
    .click();

  await expect(page.getByRole('heading', { level: 1, name: /When would suit/ })).toBeVisible({
    timeout: 15_000,
  });
  const options = page.getByRole('checkbox');
  await expect(options.first()).toBeVisible({ timeout: 15_000 });
  await options.nth(0).check();
  await options.nth(1).check();

  await page.getByRole('link', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Check this over/ })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('lesson requests', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test('parent: shortlist → ask multiple → send → awaiting responses', async ({ page }) => {
    await signIn(page, REQUEST_PARENT);
    await shortlistAndCompose(page, '/parent');

    await askMultipleAndReview(page);

    // Nothing may claim a card exists or a lesson is booked.
    await expect(page.getByText(/charged/i)).toHaveCount(0);
    await expect(page.getByText('Nothing is booked yet').first()).toBeVisible();

    /**
     * WHO IS BEING ASKED IS ON SCREEN, and so is every tutor who is not.
     * A shortlisted tutor missing from a request is, to the family,
     * indistinguishable from one who declined it.
     */
    await expect(page.getByText(/Asking \d+ tutors?/)).toBeVisible();

    // Times read as the whole lesson, and as alternatives rather than as two
    // lessons being requested.
    await expect(page.getByText(/\d{1,2}:\d{2}–\d{1,2}:\d{2}\s?(am|pm)/).first()).toBeVisible();
    await expect(page.getByText('Any one of these')).toBeVisible();

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

  test('independent student: same journey through the same screens', async ({ page }) => {
    await signIn(page, REQUEST_STUDENT);
    await shortlistAndCompose(page, '/student');

    await askMultipleAndReview(page);
    await page.getByRole('button', { name: /Send request to/ }).click();

    await expect(page).toHaveURL(/\/requests\/LR-\d{8}/);
    await expect(page.getByText('Awaiting responses')).toBeVisible();
  });

  test('tutor: sees only their own request, with a labelled temporary hold', async ({ page }) => {
    await signIn(page, 'tutor.a@local.studdy.test');
    await page.goto('/tutor/requests');
    await expect(page.getByRole('heading', { name: 'Lesson requests' })).toBeVisible();

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

  test('tutor: accepts one offered time and sees the hold with its expiry', async ({ page }) => {
    await signIn(page, 'tutor.a@local.studdy.test');
    await page.goto('/tutor/requests');
    await page.getByRole('link', { name: /with /i }).first().click();
    await expect(page).toHaveURL(/\/tutor\/requests\/TREQ-/);

    await expect(
      page.getByRole('heading', { name: 'Can you do one of these times?' }),
    ).toBeVisible();
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Accept this time' }).click();

    // The hold exists only now, and is shown with its expiry (D-1, D-8).
    await expect(page.getByText('You accepted this time')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/held on your calendar until/)).toBeVisible();
    await expect(page.getByText(/may or may not become a booking/)).toBeVisible();

    // Still nothing about anyone else.
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('lr-');
    expect(body).not.toContain('another tutor');
  });

  test('tutor: an unowned reference is indistinguishable from a missing one', async ({ page }) => {
    // SP-007 used to get "no HTTP-status oracle" for free because no tutor-side
    // [reference] route existed. This route removes that, so the property has
    // to be proven: a reference belonging to another tutor and one that never
    // existed must answer identically.
    await signIn(page, 'tutor.a@local.studdy.test');
    await page.goto('/tutor/requests');
    await page.getByRole('link', { name: /with /i }).first().click();
    await expect(page).toHaveURL(/\/tutor\/requests\/TREQ-/);
    const realReference = new URL(page.url()).pathname.split('/').pop() ?? '';
    expect(realReference).toMatch(/^TREQ-/);

    // Tutor C holds no such request, so for them it is another tutor's.
    await signIn(page, 'tutor.c@local.studdy.test');
    const unowned = await page.goto(`/tutor/requests/${realReference}`);
    const unownedBody = await settledBody(page);
    const missing = await page.goto('/tutor/requests/TREQ-ZZZZZZZZZZ');
    const missingBody = await settledBody(page);

    // Same status and same body: nothing in the response tells this tutor that
    // one of those references is real.
    expect(unowned?.status()).toBe(missing?.status());
    expect(unownedBody).toBe(missingBody);
    // And neither leaks the request itself.
    expect(unownedBody).not.toContain(realReference);
  });

  test('family: chooses the accepted tutor and time, and lands before payment', async ({
    page,
  }) => {
    // The independent student's request is the live one by this point: the
    // parent's was withdrawn earlier in this serial file, and the tutor
    // accepted a time on the student's.
    await signIn(page, REQUEST_STUDENT);
    await page.goto('/requests');
    await page.getByRole('link', { name: 'View request' }).first().click();
    await expect(page).toHaveURL(/\/requests\/LR-\d{8}/);

    await expect(page.getByText('Ready for you to choose')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'Choose your tutor' }).click();
    await expect(page.getByRole('heading', { name: 'Choose your tutor' })).toBeVisible();

    // A tutor and a time together (D-5), not a tutor then a time.
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Choose this tutor' }).click();

    await expect(page).toHaveURL(/\/requests\/LR-\d{8}/);
    // Chosen, but explicitly NOT booked: nobody has paid.
    await expect(page.getByText('You chose your tutor')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/not booked until that is done/)).toBeVisible();
    // The status says "Payment next", never "Booked": `fulfilled` is reserved
    // for a confirmed booking, and nobody has paid.
    await expect(page.getByText('Payment next')).toBeVisible();
  });

  test('tutor: a closed request says nothing about why it closed', async ({ page }) => {
    // Every family-side and system-side ending renders identically. A tutor
    // who was not chosen must not be able to tell that from a withdrawal.
    await signIn(page, 'tutor.a@local.studdy.test');
    await page.goto('/tutor/requests');

    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of [
      'another tutor',
      'not selected',
      'was chosen',
      'another_tutor_selected',
      'selection_window_lapsed',
      'lr-',
    ]) {
      expect(body, `closure must not explain itself: "${forbidden}"`).not.toContain(forbidden);
    }
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
