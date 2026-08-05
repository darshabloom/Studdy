import { expect, test } from '@playwright/test';

test.describe('authentication routes', () => {
  test('sign-up renders labelled form controls', async ({ page }) => {
    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: 'Join Studdy' })).toBeVisible();
    // Visible labels above controls — placeholder-only forms are prohibited.
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('sign-in renders and links to sign-up and reset', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Log in to Studdy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgotten your password?' })).toBeVisible();
  });

  test('verify page explains the pending state', async ({ page }) => {
    await page.goto('/verify');
    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  });
});
