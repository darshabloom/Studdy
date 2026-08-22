import { expect, test } from '@playwright/test';

/**
 * Read-only layout checks for public discovery. Safe to run on every project
 * (desktop and mobile) because nothing here mutates data.
 */
test.describe('public discovery layout', () => {
  test('tutor list renders and stays within the viewport', async ({ page }) => {
    await page.goto('/tutors');
    await expect(page.getByRole('heading', { name: 'Find a tutor' })).toBeVisible();
    await expect(page.getByText('These are example profiles for development')).toBeVisible();

    // Cards render with their key facts.
    await expect(page.getByRole('link', { name: 'View availability' }).first()).toBeVisible();
    await expect(page.getByText('Example profile').first()).toBeVisible();

    // No horizontal overflow at this width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test('a tutor profile renders and stays within the viewport', async ({ page }) => {
    await page.goto('/tutors');
    await page.getByRole('link', { name: 'View availability' }).first().click();
    await expect(page).toHaveURL(/\/tutors\/TUTOR-/);
    await expect(page.getByText('What a lesson is like')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test('subject filters are usable', async ({ page }) => {
    await page.goto('/tutors');
    await page.getByRole('link', { name: 'English', exact: true }).click();
    await expect(page).toHaveURL(/subject=english/);
    await expect(page.getByText('Mei').first()).toBeVisible();
  });
});
