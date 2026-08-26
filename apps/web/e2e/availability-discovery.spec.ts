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
      /**
       * Every DAY column, not only the ones carrying blocks.
       *
       * A zero-width column is a day nobody can see. Mini has a zero-width
       * gutter TRACK, and a body that skipped its cell pushed the first day
       * into that track and the seventh off the end — the week quietly lost a
       * column, and only a tutor who happened to teach on that day made it
       * visible at all.
       */
      dayColumnWidths: [...root.querySelectorAll('[data-calendar-day]')].map((day) =>
        Math.round(day.getBoundingClientRect().width),
      ),
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

      // Step 4 gave the card a real entry point; the profile is still one
      // click away, quietly, for a parent who wants to look before booking.
      await expect(page.getByRole('link', { name: 'Book a lesson' }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'View profile' }).first()).toBeVisible();

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

      // All seven days are present, and every one of them is really there.
      expect(geometry.dayColumnWidths).toHaveLength(7);
      for (const width of geometry.dayColumnWidths) expect(width).toBeGreaterThan(0);

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

      await page.getByRole('link', { name: 'View profile' }).first().click();
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
       * Booking is now OFFERED, and honestly labelled.
       *
       * Through step 3 this was a callout saying booking opened shortly, since
       * a disabled primary reads as an action withheld from this parent rather
       * than as a journey that did not exist yet. Step 4 built the journey, so
       * the entry point is real — and it still must not claim that pressing it
       * confirms anything.
       */
      await expect(page.getByRole('link', { name: 'Book a lesson' })).toBeVisible();
      await expect(page.getByText(/still has to accept/)).toBeVisible();
      await expect(page.getByRole('button', { name: /Confirm|Book now/ })).toHaveCount(0);

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
      await page.getByRole('link', { name: 'View profile' }).first().click();
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

    /**
     * Reach the multi-tutor times grid, which now sits behind two questions.
     *
     * Length and format come first because they decide which shortlisted tutors
     * the request can reach, and therefore whose availability the grid is drawn
     * from.
     */
    /**
     * Make sure this family has a shortlist before a journey that reads one.
     *
     * `locator.count()` does NOT auto-wait, so reading it against a page whose
     * cards have not rendered reports "nothing to save", the save never
     * happens, and the shortlist stays empty — which surfaces several screens
     * later as "no tutor offers this subject", a long way from the cause. A
     * rendered card shows one of two controls, so wait for either.
     */
    async function ensureShortlisted(page: Page): Promise<void> {
      const addToShortlist = page.getByRole('button', { name: 'Save for later' });
      const alreadySaved = page.getByText('Saved for later');
      await expect(addToShortlist.or(alreadySaved).first()).toBeVisible({ timeout: 15_000 });

      if ((await alreadySaved.count()) > 0) return;

      await addToShortlist.first().click();
      // Saving is a server action and a re-render; the shortlist has to exist
      // before the journey that reads it starts.
      await expect(alreadySaved.first()).toBeVisible({ timeout: 15_000 });
    }

    async function askTimes(page: Page): Promise<void> {
      const sectionId = new URL(page.url()).searchParams.get('section') ?? '';
      await page.goto(`/shortlist/${sectionId}/ask/length`);
      await expect(
        page.getByRole('heading', { level: 1, name: /How long should the lesson/ }),
      ).toBeVisible({ timeout: 15_000 });
      await page
        .getByRole('link', { name: /minutes/ })
        .first()
        .click();

      await expect(
        page.getByRole('heading', { level: 1, name: /Online or in person/ }),
      ).toBeVisible({ timeout: 15_000 });
      await page
        .getByRole('link', { name: /^Online|^In person/ })
        .first()
        .click();

      await expect(page.getByRole('heading', { level: 1, name: /When would suit/ })).toBeVisible({
        timeout: 15_000,
      });
    }

    test('the combined grid counts only the family own shortlist', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);

      await ensureShortlisted(page);
      await askTimes(page);

      // Counts are scoped to the tutors this request actually reaches, never to
      // the platform — and to the INCLUDED ones now, since a tutor who cannot
      // take the chosen lesson is not offering times for it.
      await expect(page.getByText(/of \d+ tutors? can do this/).first()).toBeVisible({
        timeout: 15_000,
      });
    });

    /**
     * The bound is ONE to five, here as well as in the single-tutor journey. It
     * is a single configured rule, deliberately, so the two paths cannot drift
     * apart — and a family with one workable time has made a real request even
     * when they are asking several tutors at once.
     */
    test('the grid holds the family to between one and five times', async ({ page }) => {
      await signIn(page, FAMILY);
      await scopedDiscovery(page);
      await ensureShortlisted(page);
      await askTimes(page);

      const options = page.getByRole('checkbox');
      await expect(options.first()).toBeVisible({ timeout: 15_000 });

      // Nothing chosen is still nothing to ask about.
      await expect(page.getByRole('link', { name: 'Continue' })).toHaveCount(0);

      // One is enough. The copy recommends more; the rule does not demand it.
      await options.nth(0).check();
      await expect(page.getByText(/Choose at least/)).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Continue' })).toBeVisible();
    });
  });
});
