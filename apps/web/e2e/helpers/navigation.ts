import type { Locator, Page } from '@playwright/test';

/**
 * Click a link and insist the navigation actually happened.
 *
 * WHEN TO REACH FOR THIS: a link clicked soon after a page load or another
 * navigation, where nothing else has already waited for the page to become
 * interactive. The first interaction after a load can land before React has
 * hydrated, and a click on a not-yet-live `<Link>` is swallowed — no
 * navigation, no error, nothing to see. A longer timeout cannot help, because
 * nothing is on its way.
 *
 * Most clicks in this suite are fine without it: they follow an
 * `expect(...).toBeVisible()` or a form submission, either of which has already
 * given hydration the time it needed. Wrapping every click would hide that
 * distinction rather than respect it.
 *
 * WAITS FOR THE URL TO CHANGE rather than to match a pattern. A swallowed click
 * leaves the URL exactly as it was, which any pattern describing the current
 * page would happily satisfy — so a pattern-matching wait returns believing it
 * navigated. Assert the shape of the new URL afterwards, separately.
 *
 * Retrying is safe because the target is a navigation: a duplicate click either
 * does nothing or arrives at the same place. A link that has vanished means the
 * navigation already happened — some links remove themselves once used — so
 * that counts as success rather than something to wait out.
 */
export async function clickUntilNavigated(page: Page, link: Locator): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {});
  await link.waitFor({ timeout: 15_000 });
  const before = page.url();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await link.count()) === 0) return;
    await link.click({ timeout: 5_000 }).catch(() => {});
    try {
      await page.waitForURL((url) => url.toString() !== before, { timeout: 8_000 });
      return;
    } catch {
      if (attempt === 2) throw new Error(`the click never navigated away from ${before}`);
    }
  }
}
