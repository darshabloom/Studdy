import { expect, test, type Page } from '@playwright/test';

/**
 * The two booking paths through one shared discovery journey.
 * Requires local Supabase plus a seeded database (pnpm db:seed).
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

async function addSubjectNeed(page: Page, subject: string, year: string): Promise<void> {
  await page.getByLabel('Subject', { exact: true }).selectOption({ label: subject });
  await page.getByLabel('School year for this subject').selectOption({ label: year });
  await page.getByRole('button', { name: 'Save and find tutors' }).click();
  await page.waitForURL(/\/tutors\?section=/, { timeout: 15_000 });
}

// Serial: these journeys share seeded accounts and mutate their data.
test.describe.configure({ mode: 'serial' });

test.describe('family, students and tutor discovery', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test('anonymous visitors can browse public tutor discovery', async ({ page }) => {
    await page.goto('/tutors');
    // Regression: /tutors must not be caught by the /tutor workspace guard.
    await expect(page).toHaveURL(/\/tutors$/);
    await expect(page.getByRole('heading', { name: 'Find a tutor' })).toBeVisible();
    await expect(page.getByText('These are example profiles for development')).toBeVisible();
    await expect(page.getByText('Aroha').first()).toBeVisible();
    // A suspended tutor must never surface publicly.
    await expect(page.getByText('Riley')).toHaveCount(0);
    // Anonymous visitors are invited to sign in rather than shown save controls.
    await expect(page.getByRole('button', { name: 'Save for later' })).toHaveCount(0);
  });

  test('parent journey: add student → add subject → shortlist three → save', async ({ page }) => {
    await signIn(page, 'parent.one@local.studdy.test');
    await expect(page).toHaveURL(/\/parent/);

    // First visit shows the honest empty state.
    const addStudent = page
      .getByRole('link', { name: /Add a student|Add your first student/ })
      .first();
    await addStudent.click();
    await expect(page).toHaveURL(/\/parent\/students\/new/);

    await page.getByLabel("Student's first name").fill('Ari');
    await page.getByLabel('Family name').fill('Tester');
    await page.getByLabel('School year').selectOption({ label: 'Year 9' });
    await page.getByRole('button', { name: 'Add student' }).click();
    await expect(page).toHaveURL(/\/parent$/);
    await expect(page.getByText('Ari')).toBeVisible();

    await page.getByRole('link', { name: 'Add a subject' }).first().click();
    await addSubjectNeed(page, 'Mathematics', 'Year 9');

    // Discovery is now scoped to that student and subject.
    await expect(page.getByText(/Showing tutors for/)).toBeVisible();
    await expect(page.getByText('0 of 3 shortlisted')).toBeVisible();

    // Shortlist every tutor offered, up to the cap.
    for (let index = 0; index < 3; index += 1) {
      const addButton = page.getByRole('button', { name: 'Save for later' }).first();
      if ((await addButton.count()) === 0) break;
      await addButton.click();
      await page.waitForURL(/\/tutors\?section=/, { timeout: 15_000 });
    }

    await page.getByRole('link', { name: 'Review shortlist' }).first().click();
    await expect(page).toHaveURL(/\/shortlist\//);
    await expect(page.getByRole('heading', { name: 'Your shortlist' })).toBeVisible();

    // It must be unmistakably a saved shortlist, not a sent request.
    await expect(page.getByText('This is a saved shortlist, not a lesson request')).toBeVisible();
    await expect(page.getByText(/Nothing has been sent to these tutors/)).toBeVisible();

    const savedCount = await page.getByRole('button', { name: 'Remove' }).count();
    expect(savedCount).toBeGreaterThan(0);
    expect(savedCount).toBeLessThanOrEqual(3);

    // The selection survives signing out and back in.
    const shortlistUrl = page.url();
    await page.goto('/parent');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'parent.one@local.studdy.test');
    await page.goto(shortlistUrl);
    await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(savedCount);
  });

  test('parent can change the selection by removing a tutor', async ({ page }) => {
    await signIn(page, 'parent.one@local.studdy.test');
    await page.getByRole('link', { name: 'Review shortlist' }).first().click();
    await expect(page.getByRole('heading', { name: 'Your shortlist' })).toBeVisible();
    // Wait for the saved entries to render before counting them.
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();
    const before = await page.getByRole('button', { name: 'Remove' }).count();
    expect(before).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Remove' }).first().click();
    await page.waitForURL(/\/shortlist\//, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(before - 1);
  });

  test('independent student journey uses the same discovery and shortlist', async ({ page }) => {
    await signIn(page, 'student.independent@local.studdy.test');
    await expect(page).toHaveURL(/\/student/);

    await page
      .getByRole('link', { name: /Set up my profile/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/student\/setup/);
    await page.getByLabel('Your first name').fill('Sam');
    await page.getByLabel('Family name').fill('Solo');
    await page.getByLabel('School year').selectOption({ label: 'Year 13' });
    await page.getByRole('button', { name: 'Save my profile' }).click();
    await expect(page).toHaveURL(/\/student$/);

    // No student selector: an independent student acts only for themselves.
    await page.getByRole('link', { name: 'Add a subject' }).first().click();
    await expect(page.getByLabel('Which student?')).toHaveCount(0);
    await addSubjectNeed(page, 'Mathematics', 'Year 13');

    const addButton = page.getByRole('button', { name: 'Save for later' }).first();
    await addButton.click();
    await page.waitForURL(/\/tutors\?section=/, { timeout: 15_000 });
    await expect(page.getByText('1 of 3 shortlisted')).toBeVisible();

    await page.getByRole('link', { name: 'Review shortlist' }).first().click();
    await expect(page.getByRole('heading', { name: 'Your shortlist' })).toBeVisible();
    await expect(page.getByText('Sam')).toBeVisible();
  });

  test('a tutor profile page shows approved public fields', async ({ page }) => {
    await page.goto('/tutors');
    await page.getByRole('link', { name: 'View availability' }).first().click();
    await expect(page).toHaveURL(/\/tutors\/TUTOR-/);
    await expect(page.getByText('Example profile')).toBeVisible();
    await expect(page.getByText('What a lesson is like')).toBeVisible();
    await expect(page.getByText('Verification')).toBeVisible();
  });
});
