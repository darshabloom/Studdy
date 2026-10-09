import { expect, test, type Page } from '@playwright/test';
import {
  approvePendingService,
  makeTutorPayable,
  resetOnboardingTutor,
  type OnboardingTutor,
} from './helpers/tutor-onboarding';

/**
 * AN APPROVED TUTOR GETTING THEMSELVES ON SALE, start to finish, in a browser.
 *
 * WHAT THIS PROVES: that a tutor who has just been approved can open their
 * workspace and is told what is left; that they can create a service and that a
 * mistake reports what is wrong without losing what was typed; that nothing they
 * do puts them in front of a family until Studdy has approved the service, they
 * can be paid, AND they have published it; that once they have, a signed-out
 * visitor finds their real service, price and description on a public profile
 * that is not labelled as an example; that unpublishing and pausing each take
 * them back out of public view; and that neither a parent nor the tutor can reach
 * the screens that belong to someone else.
 *
 * The two steps that are not the tutor's own (a reviewer approving, Stripe
 * confirming payouts) are performed through the database, for the reasons in
 * `helpers/tutor-onboarding.ts`. The reviewer's screens sit behind MFA and are
 * proved by `requireStaff`'s own tests and by the integration suite.
 *
 * ONE DEDICATED ACCOUNT, `tutor.onboarding@`, which no other spec may sign in as.
 * It teaches Biology, which no other seeded tutor does, so publishing and
 * unpublishing it cannot change what another spec finds when it searches. The
 * journey starts by resetting the tutor, so it survives a retry.
 */

const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';
const TUTOR = 'tutor.onboarding@local.studdy.test';
const PARENT = 'parent.one@local.studdy.test';

const SERVICE_NAME = 'Year 11 to 13 biology';
const DESCRIPTION =
  'Weekly lessons that follow the school programme. We draw each process out step by step.';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

/**
 * Keep a picture of a screen at desktop and phone width.
 *
 * These screens are new, and text assertions cannot say whether a layout holds
 * together. CI uploads the folder so each one can be looked at.
 */
async function snap(page: Page, name: string): Promise<void> {
  const original = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `test-results/screens/${name}-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: `test-results/screens/${name}-375.png`, fullPage: true });
  await page.setViewportSize(original);
}

const field = (page: Page, name: string) =>
  page.locator(`input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`);

/** The tutor's one service page, reached the way a tutor reaches it. */
async function openService(page: Page): Promise<void> {
  await page.goto('/tutor/services');
  await page.getByRole('link', { name: `Open ${SERVICE_NAME}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: SERVICE_NAME })).toBeVisible({
    timeout: 15_000,
  });
}

/** What a signed-out visitor gets at this tutor's public address. */
async function publicProfileStatus(page: Page, tutor: OnboardingTutor): Promise<number> {
  const response = await page.request.get(`/tutors/${tutor.reference}`);
  return response.status();
}

test.describe('an approved tutor getting on sale', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');
  test.describe.configure({ mode: 'serial' });

  let tutor: OnboardingTutor;

  test('is told what is left, and creates a service', async ({ page }) => {
    tutor = await resetOnboardingTutor(TUTOR);
    await signIn(page, TUTOR);

    // The workspace opens for an approved tutor and says what to do next.
    await page.goto('/tutor');
    await expect(page.getByRole('heading', { name: 'Finish setting up' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: 'Next: Create a service' })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Setup progress' })).toBeVisible();
    await snap(page, '01-dashboard-checklist');

    await page.getByRole('link', { name: 'Next: Create a service' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Create a service' })).toBeVisible({
      timeout: 15_000,
    });

    // A mistake says what is wrong and keeps what was typed.
    await field(page, 'subjectId').selectOption({ label: 'Biology' });
    await field(page, 'displayName').fill(SERVICE_NAME);
    await field(page, 'description').fill(DESCRIPTION);
    await field(page, 'yearLevelFrom').selectOption('11');
    await field(page, 'yearLevelTo').selectOption('13');
    await page.getByRole('button', { name: 'Save as a draft' }).click();
    await expect(page.getByText('Please check the highlighted fields.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Enter a price between/)).toBeVisible();
    await expect(field(page, 'displayName')).toHaveValue(SERVICE_NAME);
    // The dropdowns too: a form reset would put them back to "Choose".
    await expect(field(page, 'yearLevelFrom')).toHaveValue('11');
    await expect(field(page, 'yearLevelTo')).toHaveValue('13');
    await expect(field(page, 'options.0.durationMinutes')).toHaveValue('60');
    await expect(field(page, 'subjectId')).not.toHaveValue('');
    await snap(page, '02-service-form-errors');

    await field(page, 'options.0.price').fill('65');
    await page.getByRole('button', { name: 'Add another lesson length' }).click();
    await field(page, 'options.1.durationMinutes').selectOption('90');
    await field(page, 'options.1.price').fill('90');
    await page.getByRole('button', { name: 'Save as a draft' }).click();

    await page.waitForURL(/\/tutor\/services\/SERVICE-\d{8}/, { timeout: 15_000 });
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await snap(page, '03-service-draft');

    // Sent to Studdy: no longer editable, and still not public.
    await page.getByRole('button', { name: 'Send for review' }).click();
    await expect(page.getByText('Sent to Studdy for review.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    expect(await publicProfileStatus(page, tutor)).toBe(404);
  });

  test('cannot publish until Studdy approves and Stripe can pay them', async ({ page }) => {
    await signIn(page, TUTOR);
    await openService(page);
    // In review: there is nothing to publish with.
    await expect(page.getByRole('button', { name: 'Publish this service' })).toHaveCount(0);

    await approvePendingService(TUTOR);
    await openService(page);
    await expect(page.getByText('Approved, not yet published')).toBeVisible();
    // Approved, but not payable: the button is there and held back, with the reason.
    await expect(page.getByRole('button', { name: 'Publish this service' })).toBeDisabled();
    await expect(page.getByText(/Finish getting set up to be paid first/)).toBeVisible();
    await snap(page, '04-service-approved-not-payable');
    expect(await publicProfileStatus(page, tutor)).toBe(404);

    await makeTutorPayable(TUTOR);
    await openService(page);
    await page.getByRole('button', { name: 'Publish this service' }).click();
    await expect(page.getByText('Published. Families can now find this service.')).toBeVisible({
      timeout: 15_000,
    });
    await snap(page, '05-service-published');
  });

  test('is then found by a signed-out visitor, with their real service', async ({ browser }) => {
    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    try {
      await page.goto('/tutors?subject=biology');
      await expect(page.getByRole('heading', { level: 3, name: 'Tama' })).toBeVisible({
        timeout: 15_000,
      });

      await page.goto(`/tutors/${tutor.reference}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Tama' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole('heading', { name: 'What Tama offers' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 3, name: SERVICE_NAME })).toBeVisible();
      await expect(page.getByText(DESCRIPTION)).toBeVisible();
      await expect(page.getByText('for 60 minutes').first()).toBeVisible();
      await expect(page.getByText('for 90 minutes').first()).toBeVisible();
      await expect(page.getByText('Years 11–13').first()).toBeVisible();
      await expect(page.getByText('Studdy interviewed').first()).toBeVisible();
      // A real tutor is not labelled as an example.
      await expect(page.getByText('Example profile')).toHaveCount(0);
      await snap(page, '06-public-profile');
    } finally {
      await visitor.close();
    }
  });

  test('can step back out of view: unpublish, and pause their listing', async ({ page }) => {
    await signIn(page, TUTOR);

    await openService(page);
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.getByText(/Unpublished\. Families can no longer ask for it/)).toBeVisible({
      timeout: 15_000,
    });
    expect(await publicProfileStatus(page, tutor)).toBe(404);

    // Back on sale without another review.
    await page.getByRole('button', { name: 'Publish this service' }).click();
    await expect(page.getByText('Published. Families can now find this service.')).toBeVisible({
      timeout: 15_000,
    });
    expect(await publicProfileStatus(page, tutor)).toBe(200);

    await page.goto('/tutor/profile');
    await expect(page.getByText('Visible to families', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await snap(page, '07-tutor-profile');
    await page.getByRole('button', { name: 'Pause my listing' }).click();
    await expect(page.getByText(/Your listing is paused\. Families cannot find you/)).toBeVisible({
      timeout: 15_000,
    });
    expect(await publicProfileStatus(page, tutor)).toBe(404);

    await page.getByRole('button', { name: 'Resume my listing' }).click();
    await expect(page.getByText('Your listing is live again.')).toBeVisible({ timeout: 15_000 });
    expect(await publicProfileStatus(page, tutor)).toBe(200);
  });

  test('edits what families read on their profile', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/profile');
    const headline = 'Biology tutor who makes the hard parts visual';
    await field(page, 'headline').fill(`${headline}, every lesson`);
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible({ timeout: 15_000 });

    await page.goto(`/tutors/${tutor.reference}`);
    await expect(page.getByText(`${headline}, every lesson`)).toBeVisible({ timeout: 15_000 });

    // Stopping online lessons is refused while the service is taught online.
    await page.goto('/tutor/profile');
    await field(page, 'offersOnline').uncheck();
    await field(page, 'offersInPerson').check();
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText(/One of your services is taught online/)).toBeVisible({
      timeout: 15_000,
    });

    // Leave the profile as the seed describes it.
    await page.goto('/tutor/profile');
    await field(page, 'headline').fill(headline);
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible({ timeout: 15_000 });
  });

  test('cannot open the review queue, and a parent cannot open tutor services', async ({
    browser,
    page,
  }) => {
    // The tutor: a service they could approve themselves is exactly why this matters.
    await signIn(page, TUTOR);
    await page.goto('/manager/services');
    await expect(page.getByRole('heading', { name: 'Service review' })).toHaveCount(0);
    expect(new URL(page.url()).pathname.startsWith('/manager/services')).toBe(false);

    const family = await browser.newContext();
    const parentPage = await family.newPage();
    try {
      await signIn(parentPage, PARENT);
      await parentPage.goto('/tutor/services');
      await expect(parentPage.getByRole('heading', { name: 'Your services' })).toHaveCount(0);
      await parentPage.goto('/tutor/services/SERVICE-00000001');
      await expect(parentPage.getByRole('button', { name: 'Publish this service' })).toHaveCount(0);
      await parentPage.goto('/manager/services');
      await expect(parentPage.getByRole('heading', { name: 'Service review' })).toHaveCount(0);
    } finally {
      await family.close();
    }
  });

  test('leaves the tutor as approval found them', async () => {
    // So a later run, and anyone using the seeded account by hand, starts clean.
    await resetOnboardingTutor(TUTOR);
  });
});
