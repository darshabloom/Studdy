import { expect, test, type Page } from '@playwright/test';
import { fetchEmailLink, resolveEmailAction } from './helpers/mailpit';

/**
 * End-to-end identity flows against local Supabase + Mailpit. Skipped when
 * Supabase is not configured (e.g. a bare build without the local stack).
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;

const VERIFY_LINK = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*/;
const RECOVERY_LINK = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*type=recovery[^\s"'<>]*/;
const PASSWORD = 'a-long-passphrase-for-testing';
const SEEDED_PASSWORD = 'Studdy-local-only-1';

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  // Wait for the server action's redirect so the session cookie is in place
  // before the test navigates elsewhere.
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

// Serial: these flows share seeded accounts and the Mailpit inbox.
test.describe.configure({ mode: 'serial' });

test.describe('identity and authentication flows', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');

  test('parent journey: sign up → verify email → welcome → parent workspace', async ({ page }) => {
    const email = `parent.e2e.${Date.now()}@local.studdy.test`;

    await page.goto('/sign-up');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Check your email to verify your account')).toBeVisible();

    const link = await resolveEmailAction(await fetchEmailLink(email, VERIFY_LINK));
    await page.goto(link);

    // Verified → welcome setup (via /verify Continue or direct redirect).
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome to Studdy' })).toBeVisible();
    await page.getByLabel('Preferred name').fill('E2E');
    await page.getByLabel('Family name').fill('Parent');
    await page.getByText('I’m a parent or guardian').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/parent/);
    await expect(page.getByText('Welcome to your parent workspace')).toBeVisible();
  });

  test('independent student under-18 is refused; 18+ declaration proceeds', async ({ page }) => {
    const email = `student.e2e.${Date.now()}@local.studdy.test`;
    await page.goto('/sign-up');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    const link = await resolveEmailAction(await fetchEmailLink(email, VERIFY_LINK));
    await page.goto(link);

    await page.goto('/welcome');
    await page.getByLabel('Preferred name').fill('E2E');
    await page.getByLabel('Family name').fill('Student');
    await page.getByText('I’m a student booking for myself').click();
    // Submit WITHOUT the 18+ declaration → refused with guidance.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/18 or older/).first()).toBeVisible();
    await expect(page).toHaveURL(/\/welcome/);

    await page.getByText('I confirm I am 18 or older', { exact: false }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/student/);
  });

  test('tutor entry registers a pending application with no tutor workspace', async ({ page }) => {
    const email = `tutor.e2e.${Date.now()}@local.studdy.test`;
    await page.goto('/sign-up');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    const link = await resolveEmailAction(await fetchEmailLink(email, VERIFY_LINK));
    await page.goto(link);

    await page.goto('/welcome');
    await page.getByLabel('Preferred name').fill('E2E');
    await page.getByLabel('Family name').fill('Tutor');
    await page.getByText('I want to tutor on Studdy').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // No workspace → back on /welcome showing the pending state.
    await expect(page.getByText('Application pending')).toBeVisible();

    // Direct URL entry must not reach tutor tools.
    await page.goto('/tutor');
    await expect(page.getByText(/not yet approved|do not have access/i).first()).toBeVisible();
  });

  test('multi-role account gets the chooser once, then restores the choice', async ({ page }) => {
    await signIn(page, 'parent.tutor@local.studdy.test', SEEDED_PASSWORD);
    // Fresh seed → chooser. A previous run in this session may already have
    // saved a preference, in which case the saved workspace loads directly.
    await expect(page).toHaveURL(/\/(workspace\/choose|tutor|parent)/);
    if (page.url().includes('/workspace/choose')) {
      await expect(
        page.getByRole('heading', { name: 'Where would you like to go?' }),
      ).toBeVisible();
      await page.getByRole('button', { name: /Tutor/ }).click();
    } else if (page.url().includes('/parent')) {
      // Preference was parent — switch to tutor via the top-bar switcher.
      await page.getByRole('button', { name: 'Tutor', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/tutor/);

    // Sign out, sign back in — the saved workspace is restored, no chooser.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn(page, 'parent.tutor@local.studdy.test', SEEDED_PASSWORD);
    await expect(page).toHaveURL(/\/tutor/);
  });

  test('suspended tutor role loses workspace access', async ({ page }) => {
    await signIn(page, 'restricted.tutor@local.studdy.test', SEEDED_PASSWORD);
    await page.goto('/tutor');
    await expect(page.getByText(/do not have access|no active roles/i).first()).toBeVisible();
  });

  test('password reset end-to-end via emailed link', async ({ page }) => {
    const email = `reset.e2e.${Date.now()}@local.studdy.test`;
    const newPassword = 'an-even-longer-replacement-passphrase';

    // Create + verify an account first.
    await page.goto('/sign-up');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    const verifyLink = await resolveEmailAction(await fetchEmailLink(email, VERIFY_LINK));
    await page.goto(verifyLink);

    // Request the reset.
    await page.goto('/reset-password');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText(/reset email is on its way/i)).toBeVisible();

    const resetLink = await resolveEmailAction(await fetchEmailLink(email, RECOVERY_LINK));
    await page.goto(resetLink);
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await page.getByLabel('New password').fill(newPassword);
    await page.getByRole('button', { name: 'Update password and continue' }).click();
    await expect(page).toHaveURL(/\/(welcome|workspace|parent|student|tutor)/);
  });
});
