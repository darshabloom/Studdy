import { expect, test, type Page } from '@playwright/test';

/**
 * `/tutors` is ONE route presented according to who is looking. These tests
 * pin both presentations so a signed-in user never sees the public marketing
 * chrome (which reads as "you are signed out"), and a signed-out visitor
 * keeps the public navigation.
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

test.describe('tutor discovery presentation', () => {
  test('signed out: public navigation and public calls to action', async ({ page }) => {
    await page.goto('/tutors');
    await expect(page.getByRole('heading', { name: 'Find a tutor' })).toBeVisible();

    // Public chrome is present in the site header.
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Join Studdy' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    // Authenticated chrome is absent.
    await expect(page.getByRole('navigation', { name: 'Workspaces' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '← Back to dashboard' })).toHaveCount(0);

    // Public browsing still works, with the invitation to sign in to save.
    await expect(page.getByRole('link', { name: 'View availability' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save for later' })).toHaveCount(0);
  });

  test.describe('signed in', () => {
    test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

    test('parent sees authenticated chrome, not the public marketing header', async ({ page }) => {
      await signIn(page, 'parent.one@local.studdy.test');
      await page.goto('/tutors');

      // Authenticated chrome: workspace switcher, account menu, way back.
      await expect(page.getByRole('navigation', { name: 'Workspaces' })).toBeVisible();
      await expect(page.getByText('Parent').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
      await expect(page.getByRole('link', { name: '← Back to dashboard' })).toBeVisible();

      // No competing public sign-in emphasis.
      await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Join Studdy' })).toHaveCount(0);

      // The same tutor results are still rendered.
      await expect(page.getByRole('link', { name: 'View availability' }).first()).toBeVisible();

      // Back to dashboard actually returns to the parent workspace.
      await page.getByRole('link', { name: '← Back to dashboard' }).click();
      await expect(page).toHaveURL(/\/parent/);
    });

    test('the tutor profile page carries the same authenticated chrome', async ({ page }) => {
      await signIn(page, 'parent.one@local.studdy.test');
      await page.goto('/tutors');
      await page.getByRole('link', { name: 'View availability' }).first().click();
      await expect(page).toHaveURL(/\/tutors\/TUTOR-/);
      await expect(page.getByRole('navigation', { name: 'Workspaces' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
    });

    test('an independent student sees their own workspace context', async ({ page }) => {
      await signIn(page, 'student.independent@local.studdy.test');
      await page.goto('/tutors');
      await expect(page.getByRole('navigation', { name: 'Workspaces' })).toBeVisible();
      await expect(page.getByRole('link', { name: '← Back to dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
      await page.getByRole('link', { name: '← Back to dashboard' }).click();
      await expect(page).toHaveURL(/\/student/);
    });
  });
});
