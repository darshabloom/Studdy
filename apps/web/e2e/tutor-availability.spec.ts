import { expect, test, type Page } from '@playwright/test';

/**
 * The tutor's calendar-first availability screen (UX redesign step 2).
 *
 * DELIBERATELY READ-ONLY. Playwright runs spec FILES in parallel, and the
 * seeded tutors' availability is what `availability-discovery` and
 * `lesson-requests` derive their bookable times from — a spec that dragged a
 * new rule onto this calendar, or removed one, would change what those specs
 * see mid-run and fail them for reasons that have nothing to do with them.
 *
 * The mutating paths are covered where they can be proven properly instead:
 * `availability.integration.test.ts` asserts that an update keeps the row's
 * identity and that one tutor cannot touch another's rows, against a real
 * database.
 *
 * What this spec is for is the boundary that only exists once something is
 * RENDERED: the tutor's own view carries private notes, and "Preview as family"
 * must not, because it is fed a different projection rather than the same one
 * filtered in the browser.
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';

/**
 * The "limited" seeded tutor, who owns a blocked period with a private reason
 * and note. That fixture is the point: without it the privacy assertion below
 * would pass against a page that simply had nothing to leak.
 */
const TUTOR = 'tutor.b@local.studdy.test';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

test.describe('tutor availability, as a calendar', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');
  test.describe.configure({ mode: 'serial' });

  test('shows the week as a calendar rather than a list of rules', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');

    await expect(page.getByRole('heading', { name: 'Your availability' })).toBeVisible({
      timeout: 15_000,
    });

    // The grid itself, with the tutor's own hours on it.
    const calendar = page.getByRole('group', { name: /Your availability, week of/ });
    await expect(calendar).toBeVisible();
    await expect(calendar.locator('[data-calendar-block]').first()).toBeVisible();

    // Seven day columns, each headed — the shape that makes it read as a week
    // rather than as seven stacked lists.
    await expect(calendar.getByText(/^Mon /)).toBeVisible();
    await expect(calendar.getByText(/^Sun /)).toBeVisible();

    // The tools that make it an editing surface, not a picture. They are a
    // radiogroup because only one can be what a drag will draw.
    const tools = page.getByRole('radiogroup', { name: /dragging on the calendar/i });
    await expect(tools.getByRole('radio', { name: 'Regular availability' })).toBeVisible();
    await expect(tools.getByRole('radio', { name: 'One-off availability' })).toBeVisible();
    await expect(tools.getByRole('radio', { name: 'Block time' })).toBeVisible();

    // Regular availability is selected by default, so a first drag does the
    // thing a tutor almost always wants.
    await expect(tools.getByRole('radio', { name: 'Regular availability' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  /**
   * The editable calendar must offer the whole teaching day, not only the hours
   * this tutor already works. Fitting the window to existing availability would
   * mean an evenings-only tutor never sees a Saturday morning to drag on.
   */
  test('shows the whole teaching day, including hours with no availability yet', async ({
    page,
  }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    const calendar = page.getByRole('group', { name: /Your availability, week of/ });
    await expect(calendar).toBeVisible({ timeout: 15_000 });

    // The seeded tutor teaches late afternoons only; the morning must still be
    // on screen and reachable.
    await expect(calendar.getByText('9 am')).toBeVisible();
    await expect(calendar.getByText('12 pm')).toBeVisible();
    await expect(calendar.getByText('9 pm')).toBeVisible();
  });

  test('opens one editor from + Add, and can scope a time to a format', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    await expect(page.getByRole('group', { name: /Your availability, week of/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: '+ Add' }).click();
    const editor = page.getByRole('dialog', { name: 'Add availability' });
    await expect(editor).toBeVisible();

    // The precision the calendar gesture cannot offer: what kind of time this
    // is, and which formats it can be taught in.
    await expect(editor.getByRole('radio', { name: /Regular availability/ })).toBeVisible();
    await expect(editor.getByRole('radio', { name: /One-off availability/ })).toBeVisible();
    await expect(editor.getByRole('radio', { name: /Block time/ })).toBeVisible();
    await expect(editor.getByRole('radio', { name: 'Both' })).toBeVisible();
    await expect(editor.getByRole('radio', { name: 'Online' })).toBeVisible();
    await expect(editor.getByRole('radio', { name: 'In person' })).toBeVisible();

    // Blocking is about the tutor, not about delivery, so it offers a private
    // note instead of a format.
    await editor.getByRole('radio', { name: /Block time/ }).check();
    await expect(editor.getByRole('radio', { name: 'Online' })).toHaveCount(0);
    await expect(editor.getByText(/Private note/)).toBeVisible();

    await editor.getByRole('button', { name: 'Cancel' }).click();
    await expect(editor).toHaveCount(0);
  });

  /**
   * The same editor, reached the other way. Two entry points that opened two
   * different editors would drift apart in what they allow.
   */
  test('clicking an existing block opens the same editor, filled in', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    const calendar = page.getByRole('group', { name: /Your availability, week of/ });
    await expect(calendar).toBeVisible({ timeout: 15_000 });

    await calendar.locator('[data-calendar-block]').first().click();

    const editor = page.getByRole('dialog', { name: 'Edit this time' });
    await expect(editor).toBeVisible();
    // Prefilled from the block rather than blank.
    await expect(editor.getByLabel('Starts')).not.toHaveValue('');
    // An existing row cannot change what kind of time it is.
    await expect(editor.getByRole('radio', { name: /Regular availability/ })).toBeDisabled();
    await expect(editor.getByRole('button', { name: 'Remove' })).toBeVisible();
  });

  /**
   * The editor as a DIALOG, not a panel that happens to sit on top.
   *
   * A tutor working by keyboard has to be able to open it, move through every
   * field, close it and end up back where they started. Without a trap, Tab
   * walks onto the calendar the dialog is covering and they are silently lost.
   */
  test('the editor behaves as a dialog for a keyboard user', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    await expect(page.getByRole('group', { name: /Your availability, week of/ })).toBeVisible({
      timeout: 15_000,
    });

    const addButton = page.getByRole('button', { name: '+ Add' });
    await addButton.focus();
    await page.keyboard.press('Enter');

    const editor = page.getByRole('dialog', { name: 'Add availability' });
    await expect(editor).toBeVisible();
    // Named and described by its own heading and intro, not by a bare label.
    await expect(editor).toHaveAccessibleDescription(/Press Escape to close/);

    // Tab cannot escape onto the calendar underneath.
    for (let press = 0; press < 25; press += 1) {
      await page.keyboard.press('Tab');
      const inside = await editor.evaluate((dialog) => dialog.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    // Escape closes, and focus comes back to the control that opened it.
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(addButton).toBeFocused();
  });

  /**
   * That the calendar is a GRID, asserted on measured geometry.
   *
   * This exists because of a failure no other test could see. The design system
   * is a workspace package, so it resolves through a symlink in node_modules,
   * and Tailwind's content detection skips node_modules — every utility class
   * used only inside a design system component was silently dropped from the
   * bundle. The markup was correct and every assertion about text and roles
   * still passed, while the week collapsed into a vertical stack of full-width
   * bars roughly two thousand pixels tall.
   *
   * Text and roles cannot catch a missing stylesheet. Positions can.
   */
  test('lays the week out as columns, not as a vertical stack', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    const calendar = page.getByRole('group', { name: /Your availability, week of/ });
    await expect(calendar).toBeVisible({ timeout: 15_000 });
    await expect(calendar.locator('[data-calendar-block]').first()).toBeVisible();

    const geometry = await calendar.evaluate((root) => {
      const blocks = [...root.querySelectorAll('[data-calendar-block]')];
      const columns = [...new Set(blocks.map((block) => block.parentElement))].filter(
        (column): column is HTMLElement => column !== null,
      );
      const boxes = columns.map((column) => column.getBoundingClientRect());
      return {
        blockCount: blocks.length,
        columnCount: columns.length,
        // Distinct left edges: real columns sit beside each other.
        distinctLefts: new Set(boxes.map((box) => Math.round(box.left))).size,
        // Shared top edge: they are a row of columns, not a stack of sections.
        distinctTops: new Set(boxes.map((box) => Math.round(box.top))).size,
        blocksAbsolute: blocks.every(
          (block) => globalThis.getComputedStyle(block).position === 'absolute',
        ),
        calendarHeight: Math.round(root.getBoundingClientRect().height),
        widestBlock: Math.max(...blocks.map((block) => block.getBoundingClientRect().width)),
        calendarWidth: Math.round(root.getBoundingClientRect().width),
        // Hour labels in the gutter, so compactness can be judged against the
        // hours actually on show rather than against a fixed pixel number.
        hoursShown: root.querySelectorAll('.tabular-nums').length,
        // Headings and their columns share one grid template; a heading that
        // does not start where its column starts is naming the wrong day.
        columnLefts: columns
          .map((column) => Math.round(column.getBoundingClientRect().left))
          .sort((a, b) => a - b),
        headingLefts: [...root.querySelectorAll('[data-calendar-heading]')]
          .map((heading) => Math.round(heading.getBoundingClientRect().left))
          .sort((a, b) => a - b),
        dayColumnWidths: [...root.querySelectorAll('[data-calendar-day]')].map((day) =>
          Math.round(day.getBoundingClientRect().width),
        ),
      };
    });

    // Every column carrying a block starts at its own x and shares one y.
    expect(geometry.columnCount).toBeGreaterThan(1);
    expect(geometry.distinctLefts).toBe(geometry.columnCount);
    expect(geometry.distinctTops).toBe(1);

    // Blocks sit at their own time, which requires them to be positioned.
    expect(geometry.blocksAbsolute).toBe(true);

    // Each day heading sits over the column it names.
    for (const left of geometry.columnLefts) {
      expect(geometry.headingLefts).toContain(left);
    }

    // And all seven days are on screen with real width, not six and a sliver.
    expect(geometry.dayColumnWidths).toHaveLength(7);
    for (const width of geometry.dayColumnWidths) expect(width).toBeGreaterThan(0);

    // A block belongs to one day, so it can never span the width of the week.
    expect(geometry.widestBlock).toBeLessThan(geometry.calendarWidth / 3);

    /**
     * Hour rows stay compact.
     *
     * Expressed per visible hour rather than as one pixel bound, because the
     * window is a fixed teaching day WIDENED by anything already on the
     * calendar — a tutor with a late-night blocked period legitimately sees
     * more hours, and an absolute limit would fail on their data while saying
     * nothing about row height. Sixty pixels an hour plus chrome still rules
     * out the stacked layout, which ran to whole screens per day.
     */
    expect(geometry.hoursShown).toBeGreaterThan(0);
    expect(geometry.calendarHeight).toBeLessThan(geometry.hoursShown * 60 + 120);
  });

  test('navigates between weeks', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    await expect(page.getByRole('heading', { name: 'Your availability' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('link', { name: 'Next week' }).click();
    await expect(page).toHaveURL(/\/tutor\/availability\?week=\d{4}-\d{2}-\d{2}/);

    // The way back only offers itself once the tutor has left this week; on the
    // current week the same spot is a plain "This week" marker instead.
    const backToThisWeek = page.getByRole('link', { name: 'Back to this week' });
    await expect(backToThisWeek).toBeVisible();
    await backToThisWeek.click();
    await expect(backToThisWeek).toHaveCount(0);
    await expect(page.getByText('This week', { exact: true })).toBeVisible();
  });

  test('preview as family shows bookable time and never a reason for a gap', async ({ page }) => {
    await signIn(page, TUTOR);
    await page.goto('/tutor/availability');
    await expect(page.getByRole('heading', { name: 'Your availability' })).toBeVisible({
      timeout: 15_000,
    });

    // The tutor's own view carries the private note. Establishing that first is
    // what stops the assertion below passing against a page with nothing in it.
    await expect(page.getByText(/Private note:/).first()).toBeVisible();

    // A link, not a toggle: the preview is its own server render, so entering it
    // is a navigation and the private rows are never queried for that request.
    await page.getByRole('link', { name: 'Preview as family' }).click();
    await expect(page).toHaveURL(/preview=1/);

    const preview = page.getByRole('group', { name: /Bookable times a family can see/ });
    await expect(preview).toBeVisible();

    /**
     * THE PRIVACY ASSERTION, made against what the SERVER SENDS for this URL.
     *
     * The reload is load-bearing. Following the link is a client-side
     * navigation, which leaves the previous page's serialised payload sitting
     * in the document — so asserting straight after the click would be testing
     * what Next.js kept in the DOM, not what this route returns. A fresh
     * request is the real question: does the preview response carry any of the
     * tutor's private data? It must not, because in preview the page never
     * queries exceptions or reservations at all.
     */
    await page.reload();
    await expect(preview).toBeVisible();

    const lowered = (await page.content()).toLowerCase();
    for (const forbidden of [
      'medical_appointment',
      'personal_commitment',
      'private note',
      'synthetic: proves',
    ]) {
      expect(lowered).not.toContain(forbidden);
    }

    // And going back restores the tutor's own view, private note and all.
    await page.getByRole('link', { name: 'Back to editing' }).click();
    await expect(page.getByRole('group', { name: /Your availability, week of/ })).toBeVisible();
    await expect(page.getByText(/Private note:/).first()).toBeVisible();
  });
});
