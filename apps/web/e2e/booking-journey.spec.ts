import { expect, test, type Page } from '@playwright/test';

/**
 * The parent booking journey: child, subject, tutor, length, format, times,
 * review, send.
 *
 * Two things here are not ordinary UI assertions, and are why this spec exists:
 *
 *   * NOTHING IS WRITTEN WHILE BROWSING. A subject appears on a child because a
 *     request was sent, never because a wizard was opened — so the journey is
 *     walked all the way to the last screen and the child is checked to be
 *     unchanged before Send is pressed.
 *   * EXACT START TIMES STAY DISTINCT. The read-only calendars merge contiguous
 *     slots into bands; this one must not, because four o'clock and half past
 *     four are the choice being made.
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';

/**
 * Dedicated to this spec. Playwright runs spec FILES in parallel, and this
 * journey creates a student, sends real requests and takes real calendar holds
 * — sharing an account with another spec would race it and fail for reasons
 * that have nothing to do with booking.
 */
const FAMILY = 'parent.one@local.studdy.test';
const STUDENT = 'Booker';

/**
 * English and Mei, not maths.
 *
 * Sending a request takes a real calendar hold, and the maths tutors are also
 * being exercised by the lesson-request and discovery journeys. Booking one of
 * them made those specs fail on times this one had quietly taken — the same
 * class of collision the dedicated ACCOUNTS already exist to prevent, one level
 * down. Mei publishes two lengths, so the length step is still a real choice.
 */
const SUBJECT = 'English';
const TUTOR = 'Mei';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(SEEDED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}

/**
 * Make sure there is a student to book for.
 *
 * Branches on what the dashboard actually shows rather than assuming a clean
 * database: this file runs serially and its later tests inherit whatever the
 * earlier ones left behind.
 */
async function ensureStudent(page: Page): Promise<void> {
  await page.goto('/parent');
  const settled = page.getByRole('link', {
    name: /Find tutors|Add a subject|Add a student|Add your first student/,
  });
  await expect(settled.first()).toBeVisible({ timeout: 15_000 });

  if ((await page.getByText(STUDENT).count()) > 0) return;

  await page
    .getByRole('link', { name: /Add a student|Add your first student/ })
    .first()
    .click();
  await page.getByLabel("Student's first name").fill(STUDENT);
  await page.getByLabel('Family name').fill('Tester');
  await page.getByLabel('School year').selectOption({ label: 'Year 9' });
  await page.getByRole('button', { name: 'Add student' }).click();
  await expect(page).toHaveURL(/\/parent$/, { timeout: 15_000 });
}

/** Walk as far as the times step, choosing the given lesson length. */
async function walkToTimes(page: Page, length: RegExp): Promise<void> {
  await page.goto('/book');
  await expect(page.getByRole('heading', { name: /Who is this lesson for/ })).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole('link', { name: new RegExp(STUDENT) })
    .first()
    .click();
  await page.getByRole('link', { name: SUBJECT, exact: false }).first().click();
  await page
    .getByRole('link', { name: new RegExp(TUTOR) })
    .first()
    .click();
  await page.getByRole('link', { name: length }).first().click();
  await expect(page.getByRole('heading', { name: /When would suit/ })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('the parent booking journey', () => {
  test.skip(!supabaseConfigured, 'Requires local Supabase (pnpm supabase:start)');
  test.describe.configure({ mode: 'serial' });

  test('signed out, the journey is not reachable at all', async ({ page }) => {
    await page.goto('/book');
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });
  });

  test('refuses a step that has not been reached', async ({ page }) => {
    await signIn(page, FAMILY);
    // Straight to review with nothing answered: sent back to the first question
    // rather than shown a broken screen or, worse, a send button.
    await page.goto('/book/review');
    await expect(page).toHaveURL(/\/book\/child/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Send request/ })).toHaveCount(0);
  });

  test('offers the tutor own lesson lengths, and carries the chosen one', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await page.goto('/book');

    await page
      .getByRole('link', { name: new RegExp(STUDENT) })
      .first()
      .click();
    await page.getByRole('link', { name: SUBJECT, exact: false }).first().click();
    await page
      .getByRole('link', { name: new RegExp(TUTOR) })
      .first()
      .click();

    // This tutor publishes two lengths, so it is a real choice rather than a
    // screen with one option clicked through.
    await expect(page.getByRole('heading', { name: /How long should the lesson/ })).toBeVisible();
    const lengths = page.getByRole('list', { name: 'Lesson lengths' }).getByRole('listitem');
    await expect(lengths).toHaveCount(2);
    await expect(page.getByRole('link', { name: /60 minutes/ })).toBeVisible();

    await page
      .getByRole('link', { name: /90 minutes/ })
      .first()
      .click();

    // Mei teaches online only, so the format question never had to be asked.
    await expect(page.getByRole('heading', { name: /When would suit/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: /90 minutes/ })).toBeVisible();
    await expect(page.getByText(/Choose one or more times that work for you/)).toBeVisible();
  });

  test('offers distinct start times rather than merged bands', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await walkToTimes(page, /60 minutes/);

    const calendar = page.getByRole('group', { name: /Bookable times for/ });
    await expect(calendar.getByRole('button').first()).toBeVisible({ timeout: 15_000 });

    /**
     * A tutor open from four until seven produces several overlapping starts.
     * The read-only calendars merge those into one band; here they must not be,
     * because the start time is the thing being chosen. Asserted on geometry,
     * because a merged band and several stacked blocks read identically to any
     * assertion about text.
     */
    const geometry = await calendar.evaluate((root) => {
      const blocks = [...root.querySelectorAll('[data-calendar-block]')];
      const byColumn = new Map<Element, { top: number; bottom: number }[]>();
      for (const block of blocks) {
        const column = block.parentElement;
        if (column === null) continue;
        const box = block.getBoundingClientRect();
        const boxes = byColumn.get(column) ?? [];
        boxes.push({ top: Math.round(box.top), bottom: Math.round(box.bottom) });
        byColumn.set(column, boxes);
      }

      let overlapping = 0;
      for (const boxes of byColumn.values()) {
        const sorted = [...boxes].sort((a, b) => a.top - b.top);
        for (let index = 1; index < sorted.length; index += 1) {
          // A single pixel of tolerance: adjoining markers share an edge.
          if (sorted[index]!.top < sorted[index - 1]!.bottom - 1) overlapping += 1;
        }
      }

      return {
        blockCount: blocks.length,
        overlapping,
        selectable: blocks.every((block) => block.tagName === 'BUTTON'),
      };
    });

    expect(geometry.blockCount).toBeGreaterThan(1);

    /**
     * NO TWO BLOCKS IN A COLUMN OVERLAP.
     *
     * This is the real invariant, and it is why the assertion is about geometry
     * rather than about how many starts happen to be free. Drawn at their full
     * lesson length, slots derived every half hour overlap — and an absolutely
     * positioned block that overlaps another COVERS it, so every start but the
     * last became unclickable. Counting free slots instead would have made this
     * test depend on what other specs had booked.
     */
    expect(geometry.overlapping).toBe(0);

    // And each one is genuinely choosable.
    expect(geometry.selectable).toBe(true);
  });

  test('never explains why a time is unavailable', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await walkToTimes(page, /60 minutes/);

    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const forbidden of [
      'medical_appointment',
      'personal_commitment',
      'private note',
      'blocked',
      'already booked',
      'unavailable',
      'busy',
      'on holiday',
      'not working',
    ]) {
      expect(body, `the booking calendar must not explain a gap: "${forbidden}"`).not.toContain(
        forbidden,
      );
    }
  });

  test('reaches review having written nothing to the student', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);

    // Read the state BEFORE walking, so the assertion below is about what the
    // wizard did rather than about which tests happened to run first.
    await page.goto('/parent');
    const alreadyStudying = (await page.getByText(SUBJECT).count()) > 0;

    await walkToTimes(page, /60 minutes/);

    const slots = page.getByRole('group', { name: /Bookable times for/ }).getByRole('button');
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });
    await slots.first().click();
    await expect(page.getByText(/1 time chosen/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: /Check this over/ })).toBeVisible({
      timeout: 15_000,
    });

    // Nothing is booked, and the review says so rather than implying otherwise.
    await expect(page.getByText(/Nothing is booked yet/)).toBeVisible();

    /**
     * THE POINT OF THIS TEST, and asserted in BOTH directions because this file
     * runs serially and a later test really does send a request.
     *
     * Where the child has no such subject yet, the review must promise to add
     * it on send — a promise that is only honest because the wizard has not
     * added it already. Where they do have it, the review must NOT claim to be
     * adding a subject they already study. An assertion that only covered the
     * first case passed or failed according to what earlier tests had done.
     */
    const notice = page.getByText(/will be added to .* subjects when you send/);
    if (alreadyStudying) await expect(notice).toHaveCount(0);
    else await expect(notice).toBeVisible();
  });

  test('sends a request, says so honestly, and only then adds the subject', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await walkToTimes(page, /60 minutes/);

    const slots = page.getByRole('group', { name: /Bookable times for/ }).getByRole('button');
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });
    await slots.first().click();
    await slots.nth(1).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: /Check this over/ })).toBeVisible({
      timeout: 15_000,
    });

    // The final action must never claim a confirmed booking.
    const send = page.getByRole('button', { name: /^Send request/ });
    await expect(send).toBeVisible();
    await expect(page.getByRole('button', { name: /^Book a lesson$|^Confirm/ })).toHaveCount(0);

    await page.getByLabel(/Anything you.d like the tutor to know/).fill('Working on algebra.');
    await send.click();

    // Landing on the request means it really was created.
    await expect(page).toHaveURL(/\/requests\/[A-Z0-9-]+$/, { timeout: 30_000 });

    // And the subject is on the child now — because a request was sent.
    await page.goto('/parent');
    await expect(page.getByText(SUBJECT).first()).toBeVisible({ timeout: 15_000 });
  });
});
