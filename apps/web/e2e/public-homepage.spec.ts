import { expect, test } from '@playwright/test';

test.describe('public homepage', () => {
  test('renders hero, calls to action and labelled example tutors', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        name: 'Find the right tutor. Understand every step of their progress.',
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find a Tutor' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Join as a Tutor' }).first()).toBeVisible();
    // Example tutors must be clearly labelled and never presented as real.
    await expect(
      page.getByText('Example profiles for illustration — not real tutors.'),
    ).toBeVisible();
    await expect(page.getByText('Example profile').first()).toBeVisible();
  });

  test('shows the environment indication outside production', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/synthetic data only/i)).toBeVisible();
  });
});
