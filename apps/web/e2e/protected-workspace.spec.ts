import { expect, test } from '@playwright/test';

test.describe('protected workspaces', () => {
  for (const workspace of ['/parent', '/tutor', '/student', '/manager', '/owner']) {
    test(`unauthenticated visit to ${workspace} redirects to sign-in`, async ({ page }) => {
      await page.goto(workspace);
      // Entering a protected URL must never be sufficient to gain access.
      await expect(page).toHaveURL(
        new RegExp(
          `/sign-in\\?next=${encodeURIComponent(workspace).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        ),
      );
      await expect(page.getByRole('heading', { name: 'Log in to Studdy' })).toBeVisible();
    });
  }
});
