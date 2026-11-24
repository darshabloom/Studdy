import { expect, test } from '@playwright/test';

test.describe('public homepage', () => {
  test('renders the approved Studdy brand hero, calls to action and honest example preview', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Tutoring that builds confidence.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find a tutor' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Join as a tutor' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explore tutoring by subject' })).toBeVisible();
    await expect(
      page.getByText('Illustrative interface preview — no real student information'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Studdy home' }).first()).toBeVisible();
  });

  test('shows the environment indication outside production', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/synthetic data only/i)).toBeVisible();
  });
});
