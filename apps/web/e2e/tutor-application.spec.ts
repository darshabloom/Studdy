import { expect, test, type Page } from '@playwright/test';

/**
 * The tutor application, from the applicant's side, and the door the reviewer's
 * queue sits behind.
 *
 * WHAT THIS PROVES: that someone can start an application, save a draft and find
 * it again, that a mistake on submission reports what is wrong WITHOUT losing what
 * was typed, that a submitted application is shown as received and can be
 * withdrawn, and that a signed-in person who is not staff cannot read the review
 * queue. The reviewer's own journey (checks, approval) is proved against a real
 * database in `tutor-applications.integration.test.ts`: the manager workspace
 * demands MFA, and a TOTP journey is not something this suite can drive.
 *
 * ONE DEDICATED ACCOUNT, `parent.applicant@`, which no other spec may sign in as:
 * it mutates an application and a pending tutor role, and Playwright runs spec
 * files in parallel. The journey ends by withdrawing, so it survives being run
 * twice; and it first clears anything a failed earlier run left behind.
 */

const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';
const APPLICANT = 'parent.applicant@local.studdy.test';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

/** Whatever state a previous run left, end it: this journey starts from nothing. */
async function startFresh(page: Page): Promise<void> {
  await page.goto('/apply/tutor');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  const withdraw = page.getByRole('button', { name: 'Withdraw my application' });
  if ((await withdraw.count()) > 0) {
    await withdraw.click();
    await expect(page.getByRole('heading', { name: 'Teach with Studdy' })).toBeVisible({
      timeout: 15_000,
    });
  }
}

const field = (page: Page, name: string) =>
  page.locator(`input[name="${name}"], textarea[name="${name}"], select[name="${name}"]`);

async function fillApplication(page: Page): Promise<void> {
  await field(page, 'legalFirstName').fill('Aroha');
  await field(page, 'legalFamilyName').fill('Ngata');
  await field(page, 'preferredFirstName').fill('Aroha');
  await field(page, 'headline').fill('Patient maths tutor for years 7 to 10');
  await field(page, 'teachingApproach').fill(
    'I start from what the student already knows and build up, with lots of worked examples.',
  );
  await field(page, 'experienceSummary').fill(
    'Five years as a secondary maths teacher, and three years tutoring privately alongside.',
  );
  await page.getByRole('group', { name: 'Subjects' }).getByRole('checkbox').first().check();
  await field(page, 'yearLevelFrom').selectOption('7');
  await field(page, 'yearLevelTo').selectOption('10');
  await field(page, 'references.0.fullName').fill('Hemi Walker');
  await field(page, 'references.0.email').fill('hemi.walker@example.test');
  await field(page, 'references.0.relationship').fill('Former head of department');
  await field(page, 'references.1.fullName').fill('Mere Cook');
  await field(page, 'references.1.email').fill('mere.cook@example.test');
  await field(page, 'references.1.relationship').fill('Parent of a past student');
}

test.describe('a person applying to tutor', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');
  test.describe.configure({ mode: 'serial' });

  test('starts, saves a draft, and finds it again', async ({ page }) => {
    await signIn(page, APPLICANT);
    await startFresh(page);

    await page.getByRole('button', { name: 'Start my application' }).click();
    await expect(page.getByRole('heading', { name: 'Your tutor application' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    await fillApplication(page);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 15_000 });

    // Back later: what was typed is still there.
    await page.goto('/apply/tutor');
    await expect(field(page, 'headline')).toHaveValue('Patient maths tutor for years 7 to 10', {
      timeout: 15_000,
    });
    await expect(field(page, 'references.1.email')).toHaveValue('mere.cook@example.test');
    await expect(field(page, 'yearLevelTo')).toHaveValue('10');
  });

  /** A mistake must say what is wrong and must not cost anyone their work. */
  test('reports what is missing on submission without losing what was typed', async ({ page }) => {
    await signIn(page, APPLICANT);
    await page.goto('/apply/tutor');
    await expect(field(page, 'headline')).toBeVisible({ timeout: 15_000 });

    // The declarations are deliberately not ticked.
    await page.getByRole('button', { name: 'Submit application' }).click();

    await expect(page.getByText('You need to accept the declarations to apply.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(field(page, 'headline')).toHaveValue('Patient maths tutor for years 7 to 10');
    // The dropdowns too: a form reset would put them back to "Choose".
    await expect(field(page, 'yearLevelFrom')).toHaveValue('7');
    await expect(field(page, 'yearLevelTo')).toHaveValue('10');
    await expect(page.getByText('Application submitted')).toHaveCount(0);
  });

  test('submits, shows it as received, and can be withdrawn', async ({ page }) => {
    await signIn(page, APPLICANT);
    await page.goto('/apply/tutor');
    await expect(field(page, 'headline')).toBeVisible({ timeout: 15_000 });

    await field(page, 'declarationsAccepted').check();
    await page.getByRole('button', { name: 'Submit application' }).click();

    await expect(page.getByRole('heading', { name: 'We have your application' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
    // It can no longer be edited: the form is gone.
    await expect(field(page, 'headline')).toHaveCount(0);

    await page.getByRole('button', { name: 'Withdraw my application' }).click();
    await expect(page.getByRole('heading', { name: 'Teach with Studdy' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('You withdrew your last application')).toBeVisible();
  });
});

test.describe('the review queue is for staff only', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test('sends a signed-out visitor to sign in', async ({ page }) => {
    await page.goto('/manager/tutor-applications');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('does not show the queue, or any applicant, to a signed-in non-staff user', async ({
    page,
  }) => {
    await signIn(page, 'parent.one@local.studdy.test');
    await page.goto('/manager/tutor-applications');

    // The page refuses and moves them on, rather than rendering the queue.
    await expect(page).not.toHaveURL(/tutor-applications/, { timeout: 15_000 });
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('needs review');
    expect(body).not.toContain('legal name');
  });

  test('does not show one application to a signed-in non-staff user either', async ({ page }) => {
    await signIn(page, 'parent.one@local.studdy.test');
    await page.goto('/manager/tutor-applications/APP-10000001');
    await expect(page).not.toHaveURL(/tutor-applications/, { timeout: 15_000 });
  });
});

test.describe('the applicant route', () => {
  test('sends a signed-out visitor to sign in', async ({ page }) => {
    await page.goto('/apply/tutor');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
