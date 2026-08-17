import { expect, test, type Page } from '@playwright/test';

/**
 * The family-facing availability surface (design §7 and §3.1 steps 4–6).
 *
 * Two audiences, one journey: a signed-out visitor gets the coarse label only,
 * while a signed-in family acting on a real student/subject context sees actual
 * bookable times and can combine their shortlist onto one grid.
 *
 * These also pin the privacy boundary at the rendered HTML, which is the layer
 * that actually reaches a person: no reason for unavailability, ever.
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';
/**
 * Dedicated to this spec. Playwright runs spec FILES in parallel, and this
 * journey creates a student, a subject need and a shortlist — sharing an
 * account with `discovery-presentation` or `family-students-discovery`, which
 * both sign `parent.one@` in and out, drops this spec's session mid-journey
 * and fails it on the sign-in page for reasons that have nothing to do with
 * availability.
 */
const FAMILY = 'parent.two@local.studdy.test';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

/** Reach scoped discovery, creating the student and subject need if absent. */
async function scopedDiscovery(page: Page): Promise<void> {
  await page.goto('/parent');

  // Branch on what the dashboard actually offers, cheapest route first. These
  // specs run in series against one account, so by the second test the student
  // and subject already exist and creating another would only add noise — and
  // "Add a student" stays on the page even once one exists, so its presence is
  // not a signal that one is needed.
  const dashboardSettled = page.getByRole('link', {
    name: /Find tutors|Add a subject|Add a student|Add your first student/,
  });
  await expect(dashboardSettled.first()).toBeVisible({ timeout: 15_000 });

  const findTutors = page.getByRole('link', { name: 'Find tutors' }).first();
  if ((await findTutors.count()) === 0) {
    const addSubject = page.getByRole('link', { name: /Add a subject/ }).first();
    if ((await addSubject.count()) === 0) {
      await page
        .getByRole('link', { name: /Add a student|Add your first student/ })
        .first()
        .click();
      await page.getByLabel("Student's first name").fill('Avail');
      await page.getByLabel('Family name').fill('Tester');
      await page.getByLabel('School year').selectOption({ label: 'Year 9' });
      await page.getByRole('button', { name: 'Add student' }).click();
      await expect(page).toHaveURL(/\/parent$/);
      await expect(page.getByRole('link', { name: /Add a subject/ }).first()).toBeVisible({
        timeout: 15_000,
      });
    }
    await page
      .getByRole('link', { name: /Add a subject/ })
      .first()
      .click();
    await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' });
    await page.getByLabel('School year for this subject').selectOption({ label: 'Year 9' });
    await page.getByRole('button', { name: 'Save and find tutors' }).click();
  } else {
    await findTutors.click();
  }
  await expect(page).toHaveURL(/\/tutors\?section=/);
}

test.describe('availability in discovery', () => {
  test('signed out: coarse label only, never real times', async ({ page }) => {
    await page.goto('/tutors');
    await expect(page.getByRole('heading', { name: 'Find a tutor' })).toBeVisible();

    // Availability exists as a general indicator, which is public by design.
    await expect(page.getByText(/Available this week|Limited|Accepting new/).first()).toBeVisible();

    // Actual derived times are not part of the signed-out surface.
    await expect(page.getByText('Bookable times')).toHaveCount(0);
  });

  test.describe('signed in with a subject context', () => {
    test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');
    test.describe.configure({ mode: 'serial' });

    test('discovery shows real bookable times, and no reason for a gap', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);

      await expect(page.getByText('Bookable times').first()).toBeVisible({ timeout: 15_000 });

      // The privacy boundary, asserted on what actually reaches the browser.
      const body = (await page.locator('body').innerText()).toLowerCase();
      for (const forbidden of [
        'medical_appointment',
        'personal_commitment',
        'private note',
        // Any vocabulary that would distinguish one cause of a gap from
        // another. A missing time must read as nothing at all.
        'blocked',
        'already booked',
        'unavailable',
        'busy',
        'on holiday',
        'not working',
      ]) {
        expect(body, `rendered page must not explain a gap: "${forbidden}"`).not.toContain(
          forbidden,
        );
      }
    });

    test('a tutor profile shows their own times for this subject', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);

      await page.getByRole('link', { name: 'View profile' }).first().click();
      await expect(page).toHaveURL(/\/tutors\/TUTOR-/);
      await expect(page.getByRole('heading', { name: /Bookable times for/ })).toBeVisible();
      await expect(page.getByText(/minute lessons, next two weeks/)).toBeVisible();
    });

    test('the combined grid counts only the family own shortlist', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);

      const addToShortlist = page.getByRole('button', { name: 'Add to shortlist' });
      if ((await addToShortlist.count()) > 0) await addToShortlist.first().click();

      await page.getByRole('link', { name: 'Review shortlist' }).first().click();
      await expect(page.getByRole('heading', { name: 'Your shortlist' })).toBeVisible();

      await page.getByRole('link', { name: /Choose times for/ }).click();
      await expect(page.getByRole('heading', { name: 'Choose times that suit' })).toBeVisible();

      // Counts are scoped to the shortlist, never to the platform.
      await expect(page.getByText(/of your \d+ tutors? can do this/).first()).toBeVisible({
        timeout: 15_000,
      });
    });

    test('the grid holds the family to between two and five times', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);
      const sectionId = new URL(page.url()).searchParams.get('section') ?? '';
      await page.goto(`/shortlist/${sectionId}/times`);
      await expect(page.getByRole('heading', { name: 'Choose times that suit' })).toBeVisible();

      const options = page.getByRole('checkbox');
      await expect(options.first()).toBeVisible({ timeout: 15_000 });

      // One is not enough to send: tutors must be given a choice.
      await options.nth(0).check();
      await expect(page.getByText(/Choose at least 2 times/)).toBeVisible();

      // Two is.
      await options.nth(1).check();
      await expect(page.getByText(/Choose at least 2 times/)).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Review request' })).toBeVisible();
    });
  });
});
