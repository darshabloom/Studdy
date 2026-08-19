import { expect, test, type Page } from '@playwright/test';

/**
 * The tutor's calendar-first availability screen (UX redesign step 2).
 *
 * DELIBERATELY READ-ONLY. Playwright runs spec FILES in parallel, and the
 * seeded tutors' availability is what `availability-discovery` and
 * `lesson-requests` derive their bookable times from — a spec that dragged a
 * new rule onto this calendar, or removed one, would change what those specs
 * see mid-run and fail them for reasons that have nothing to do with them.
 *
 * The mutating paths are covered where they can be proven properly instead:
 * `availability.integration.test.ts` asserts that an update keeps the row's
 * identity and that one tutor cannot touch another's rows, against a real
 * database.
 *
 * What this spec is for is the boundary that only exists once something is
 * RENDERED: the tutor's own view carries private notes, and "Preview as family"
 * must not, because it is fed a different projection rather than the same one
 * filtered in the browser.
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';

/**
 * The "limited" seeded tutor, who owns a blocked period with a private reason
 * and note. That fixture is the point: without it the privacy assertion below
 * would pass against a page that simply had nothing to leak.
 */
const TUTOR = 'tutor.b@local.studdy.test';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

test.describe('tutor availability, as a calendar', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');
  test.describe.configure({ mode: 'serial' });

  test('shows the week as a calendar rather than a list of rules', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');

    await expect(page.getByRole('heading', { name: 'Your availability' })).toBeVisible({
      timeout: 15_000,
    });

    // The grid itself, with the tutor's own hours on it.
    const calendar = page.getByRole('group', { name: /Your availability, week of/ });
    await expect(calendar).toBeVisible();
    await expect(calendar.locator('[data-calendar-block]').first()).toBeVisible();

    // The tools that make it an editing surface, not a picture.
    await expect(page.getByRole('button', { name: 'Repeats weekly' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Extra time, once' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Block time' })).toBeVisible();
  });

  test('navigates between weeks', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    await expect(page.getByRole('heading', { name: 'Your availability' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('link', { name: /Next/ }).click();
    await expect(page).toHaveURL(/\/tutor\/availability\?week=\d{4}-\d{2}-\d{2}/);

    // "This week" only offers itself once the tutor has left this week.
    await expect(page.getByRole('link', { name: 'This week' })).toBeVisible();
    await page.getByRole('link', { name: 'This week' }).click();
    await expect(page.getByRole('link', { name: 'This week' })).toHaveCount(0);
  });

  test('preview as family shows bookable time and never a reason for a gap', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    await expect(page.getByRole('heading', { name: 'Your availability' })).toBeVisible({
      timeout: 15_000,
    });

    // The tutor's own view carries the private note. Establishing that first is
    // what stops the assertion below passing against a page with nothing in it.
    await expect(page.getByText(/Private note:/).first()).toBeVisible();

    // A link, not a toggle: the preview is its own server render, so entering it
    // is a navigation and the private rows are never queried for that request.
    await page.getByRole('link', { name: 'Preview as family' }).click();
    await expect(page).toHaveURL(/preview=1/);

    const preview = page.getByRole('group', { name: /Bookable times a family can see/ });
    await expect(preview).toBeVisible();

    /**
     * THE PRIVACY ASSERTION, made against what the SERVER SENDS for this URL.
     *
     * The reload is load-bearing. Following the link is a client-side
     * navigation, which leaves the previous page's serialised payload sitting
     * in the document — so asserting straight after the click would be testing
     * what Next.js kept in the DOM, not what this route returns. A fresh
     * request is the real question: does the preview response carry any of the
     * tutor's private data? It must not, because in preview the page never
     * queries exceptions or reservations at all.
     */
    await page.reload();
    await expect(preview).toBeVisible();

    const lowered = (await page.content()).toLowerCase();
    for (const forbidden of [
      'medical_appointment',
      'personal_commitment',
      'private note',
      'synthetic: proves',
    ]) {
      expect(lowered).not.toContain(forbidden);
    }

    // And going back restores the tutor's own view, private note and all.
    await page.getByRole('link', { name: 'Back to editing' }).click();
    await expect(page.getByRole('group', { name: /Your availability, week of/ })).toBeVisible();
    await expect(page.getByText(/Private note:/).first()).toBeVisible();
  });
});
