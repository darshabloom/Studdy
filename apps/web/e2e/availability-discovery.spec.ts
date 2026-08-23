import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * The family-facing availability surface (design §7 and §3.1 steps 4–6).
 *
 * Two audiences, one journey: a signed-out visitor gets the coarse label only,
 * while a signed-in family acting on a real student/subject context sees actual
 * bookable times and can combine their shortlist onto one grid.
 *
 * These also pin the privacy boundary at the rendered HTML, which is the layer
 * that actually reaches a person: no reason for unavailability, ever.
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';
/**
 * Dedicated to this spec. Playwright runs spec FILES in parallel, and this
 * journey creates a student, a subject need and a shortlist — sharing an
 * account with `discovery-presentation` or `family-students-discovery`, which
 * both sign `parent.one@` in and out, drops this spec's session mid-journey
 * and fails it on the sign-in page for reasons that have nothing to do with
 * availability.
 */
const FAMILY = 'parent.two@local.studdy.test';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

/** Reach scoped discovery, creating the student and subject need if absent. */
async function scopedDiscovery(page: Page): Promise<void> {
  await page.goto('/parent');

  // Branch on what the dashboard actually offers, cheapest route first. These
  // specs run in series against one account, so by the second test the student
  // and subject already exist and creating another would only add noise — and
  // "Add a student" stays on the page even once one exists, so its presence is
  // not a signal that one is needed.
  const dashboardSettled = page.getByRole('link', {
    name: /Find tutors|Add a subject|Add a student|Add your first student/,
  });
  await expect(dashboardSettled.first()).toBeVisible({ timeout: 15_000 });

  const findTutors = page.getByRole('link', { name: 'Find tutors' }).first();
  if ((await findTutors.count()) === 0) {
    const addSubject = page.getByRole('link', { name: /Add a subject/ }).first();
    if ((await addSubject.count()) === 0) {
      await page
        .getByRole('link', { name: /Add a student|Add your first student/ })
        .first()
        .click();
      await page.getByLabel("Student's first name").fill('Avail');
      await page.getByLabel('Family name').fill('Tester');
      await page.getByLabel('School year').selectOption({ label: 'Year 9' });
      await page.getByRole('button', { name: 'Add student' }).click();
      await expect(page).toHaveURL(/\/parent$/);
      await expect(page.getByRole('link', { name: /Add a subject/ }).first()).toBeVisible({
        timeout: 15_000,
      });
    }
    await page
      .getByRole('link', { name: /Add a subject/ })
      .first()
      .click();
    await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' });
    await page.getByLabel('School year for this subject').selectOption({ label: 'Year 9' });
    await page.getByRole('button', { name: 'Save and find tutors' }).click();
  } else {
    await findTutors.click();
  }
  await expect(page).toHaveURL(/\/tutors\?section=/);
}

/**
 * Measured geometry for a family-facing calendar.
 *
 * The same trap that hid a broken tutor calendar behind green tests can hide a
 * broken parent one: the design system resolves through a node_modules symlink
 * that Tailwind's content detection skips, so a utility class used only inside
 * a calendar component can vanish from the bundle while every role and text
 * assertion still passes. What collapses is position, so position is what is
 * asserted here.
 */
async function calendarGeometry(calendar: Locator) {
  return calendar.evaluate((root) => {
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
      // One shared top edge: a row of columns, not a stack of sections.
      distinctTops: new Set(boxes.map((box) => Math.round(box.top))).size,
      blocksAbsolute: blocks.every(
        (block) => globalThis.getComputedStyle(block).position === 'absolute',
      ),
      widestBlock: Math.max(...blocks.map((block) => block.getBoundingClientRect().width)),
      width: Math.round(root.getBoundingClientRect().width),
      height: Math.round(root.getBoundingClientRect().height),
      /**
       * Every day column's left edge, and every heading's.
       *
       * The header and the body are two grids sharing one column template, so
       * a heading lines up with its own column only if both fill the same
       * tracks. When the header skipped the zero-width time gutter, the names
       * slid one day left and the calendar labelled Sunday's availability as
       * Monday's — visible only as a coordinate, never as missing text.
       */
      columnLefts: columns
        .map((column) => Math.round(column.getBoundingClientRect().left))
        .sort((a, b) => a - b),
      headingLefts: [...root.querySelectorAll('[data-calendar-heading]')]
        .map((heading) => Math.round(heading.getBoundingClientRect().left))
        .sort((a, b) => a - b),
    };
  });
}

test.describe('availability in discovery', () => {
  test('signed out: coarse label only, never real times', async ({ page }) => {
    await page.goto('/tutors');
    await expect(page.getByRole('heading', { name: 'Find a tutor' })).toBeVisible();

    // Availability exists as a general indicator, which is public by design.
    await expect(page.getByText(/Available this week|Limited|Accepting new/).first()).toBeVisible();

    // Actual derived times are not part of the signed-out surface.
    await expect(page.getByRole('group', { name: /Bookable times for/ })).toHaveCount(0);
    await expect(page.locator('[data-calendar-block]')).toHaveCount(0);

    /**
     * And NOT an empty calendar in their place. Seven blank columns would read
     * as a tutor with nothing free, which is a claim about this tutor rather
     * than about what this visitor is entitled to see.
     */
    await expect(page.getByText('to see available times.').first()).toBeVisible();
  });

  test('signed out: a tutor profile offers sign-in instead of a calendar', async ({ page }) => {
    await page.goto('/tutors');
    await page.getByRole('link', { name: 'View availability' }).first().click();
    await expect(page).toHaveURL(/\/tutors\/TUTOR-/);

    await expect(page.getByRole('heading', { name: 'Availability' })).toBeVisible();
    await expect(page.getByRole('group', { name: /Bookable times for/ })).toHaveCount(0);
    await expect(page.getByText(/to view this tutor.s live availability/).first()).toBeVisible();

    // The access boundary is not weakened to make a public calendar possible.
    await expect(page.locator('[data-calendar-block]')).toHaveCount(0);
  });

  test.describe('signed in with a subject context', () => {
    test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');
    test.describe.configure({ mode: 'serial' });

    test('a discovery card shows bookable time as a real week', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);

      const calendar = page
        .getByRole('group', { name: /Bookable times for .+, next 7 days/ })
        .first();
      await expect(calendar).toBeVisible({ timeout: 15_000 });
      await expect(calendar.locator('[data-calendar-block]').first()).toBeVisible();

      const geometry = await calendarGeometry(calendar);

      // A week laid out as columns, not seven stacked lists.
      expect(geometry.columnCount).toBeGreaterThan(1);
      expect(geometry.distinctLefts).toBe(geometry.columnCount);
      expect(geometry.distinctTops).toBe(1);

      // Blocks sit at their own time, which requires them to be positioned.
      expect(geometry.blocksAbsolute).toBe(true);

      // A block belongs to ONE day, so it cannot span the width of the week.
      expect(geometry.widestBlock).toBeLessThan(geometry.width / 3);

      // Each heading sits over its own column, so the days are named honestly.
      for (const left of geometry.columnLefts) {
        expect(geometry.headingLefts).toContain(left);
      }

      /**
       * Compact enough to browse several tutors. Mini is a fixed body height by
       * design, so this can be an absolute bound — and it is the assertion that
       * would have caught the collapsed-stack failure on a card.
       */
      expect(geometry.height).toBeLessThan(240);
    });

    test('discovery never explains a gap', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);
      await expect(page.getByRole('group', { name: /Bookable times for/ }).first()).toBeVisible({
        timeout: 15_000,
      });

      // The privacy boundary, asserted on what actually reaches the browser.
      const body = (await page.locator('body').innerText()).toLowerCase();
      for (const forbidden of [
        'medical_appointment',
        'personal_commitment',
        'private note',
        // Any vocabulary that would distinguish one cause of a gap from
        // another. A missing time must read as nothing at all.
        'blocked',
        'already booked',
        'unavailable',
        'busy',
        'on holiday',
        'not working',
      ]) {
        expect(body, `rendered page must not explain a gap: "${forbidden}"`).not.toContain(
          forbidden,
        );
      }
    });

    test('a tutor profile shows their own times, full size', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);

      await page.getByRole('link', { name: 'View availability' }).first().click();
      await expect(page).toHaveURL(/\/tutors\/TUTOR-/);

      await expect(page.getByRole('heading', { name: 'Availability' })).toBeVisible();
      await expect(page.getByText(/minute lessons, shown in New Zealand time/)).toBeVisible();

      const calendar = page.getByRole('group', { name: /Bookable times for/ }).first();
      await expect(calendar).toBeVisible({ timeout: 15_000 });
      await expect(calendar.locator('[data-calendar-block]').first()).toBeVisible();

      const geometry = await calendarGeometry(calendar);
      expect(geometry.columnCount).toBeGreaterThan(1);
      expect(geometry.distinctLefts).toBe(geometry.columnCount);
      expect(geometry.distinctTops).toBe(1);
      expect(geometry.blocksAbsolute).toBe(true);
      expect(geometry.widestBlock).toBeLessThan(geometry.width / 3);
      for (const left of geometry.columnLefts) {
        expect(geometry.headingLefts).toContain(left);
      }

      // Substantially larger than the card's, which is the point of this view.
      expect(geometry.height).toBeGreaterThan(300);

      /**
       * Booking is ANNOUNCED, not offered.
       *
       * The earlier draft put a disabled primary button here, which still reads
       * as an action withheld from this parent rather than as a journey that
       * does not exist yet. There must be no such control until /book is real.
       */
      await expect(
        page.getByText('Booking a lesson here opens shortly', { exact: false }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: /Request a lesson/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Request a lesson/ })).toHaveCount(0);

      // The reason for a gap stays absent at full size too.
      const body = (await page.locator('body').innerText()).toLowerCase();
      for (const forbidden of [
        'blocked',
        'unavailable',
        'busy',
        'already booked',
        'private note',
      ]) {
        expect(body, `profile must not explain a gap: "${forbidden}"`).not.toContain(forbidden);
      }
    });

    test('the profile calendar navigates within the published horizon', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);
      await page.getByRole('link', { name: 'View availability' }).first().click();
      await expect(page).toHaveURL(/\/tutors\/TUTOR-/);

      const later = page.getByRole('link', { name: 'Show the later seven days' });
      await expect(later).toBeVisible();
      await later.click();
      await expect(page).toHaveURL(/week=2/);

      // The far edge stops rather than walking into unpublished days, which
      // would render as an absence of availability rather than of data.
      await expect(page.getByRole('link', { name: 'Show the later seven days' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Show the earlier seven days' })).toBeVisible();

      // A hand-edited page beyond the horizon is clamped, not obeyed.
      const beyond = new URL(page.url());
      beyond.searchParams.set('week', '99');
      await page.goto(beyond.toString());
      await expect(page.getByRole('heading', { name: 'Availability' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Show the later seven days' })).toHaveCount(0);
    });

    test('the combined grid counts only the family own shortlist', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);

      const addToShortlist = page.getByRole('button', { name: 'Save for later' });
      if ((await addToShortlist.count()) > 0) await addToShortlist.first().click();

      await page.getByRole('link', { name: 'Review shortlist' }).first().click();
      await expect(page.getByRole('heading', { name: 'Your shortlist' })).toBeVisible();

      await page.getByRole('link', { name: /Choose times for/ }).click();
      await expect(page.getByRole('heading', { name: 'Choose times that suit' })).toBeVisible();

      // Counts are scoped to the shortlist, never to the platform.
      await expect(page.getByText(/of your \d+ tutors? can do this/).first()).toBeVisible({
        timeout: 15_000,
      });
    });

    test('the grid holds the family to between two and five times', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);
      const sectionId = new URL(page.url()).searchParams.get('section') ?? '';
      await page.goto(`/shortlist/${sectionId}/times`);
      await expect(page.getByRole('heading', { name: 'Choose times that suit' })).toBeVisible();

      const options = page.getByRole('checkbox');
      await expect(options.first()).toBeVisible({ timeout: 15_000 });

      // One is not enough to send: tutors must be given a choice.
      await options.nth(0).check();
      await expect(page.getByText(/Choose at least 2 times/)).toBeVisible();

      // Two is.
      await options.nth(1).check();
      await expect(page.getByText(/Choose at least 2 times/)).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Review request' })).toBeVisible();
    });
  });
});
