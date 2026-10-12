import type { Page } from '@playwright/test';

/**
 * Keep a picture of a signed-in screen at desktop and phone widths.
 *
 * Text assertions say a screen has the right words; they say nothing about
 * whether it looks right. CI uploads `test-results/screens` as the `e2e-screens`
 * artifact on every run, so a new screen can be looked at rather than inferred.
 */
export async function snap(page: Page, name: string): Promise<void> {
  const original = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `test-results/screens/${name}-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: `test-results/screens/${name}-375.png`, fullPage: true });
  await page.setViewportSize(original);
}
