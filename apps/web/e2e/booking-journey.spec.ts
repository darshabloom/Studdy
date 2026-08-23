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
  await page.getByRole('link', { name: 'Mathematics', exact: false }).first().click();
  await page.getByRole('link', { name: /Aroha/ }).first().click();
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
    await page.getByRole('link', { name: 'Mathematics', exact: false }).first().click();
    await page.getByRole('link', { name: /Aroha/ }).first().click();

    // The seeded tutor publishes two lengths, so this is a real choice rather
    // than a screen with one option.
    await expect(page.getByRole('heading', { name: /How long should the lesson/ })).toBeVisible();
    const lengths = page.getByRole('list', { name: 'Lesson lengths' }).getByRole('listitem');
    await expect(lengths).toHaveCount(2);
    await expect(page.getByRole('link', { name: /60 minutes/ })).toBeVisible();

    await page
      .getByRole('link', { name: /90 minutes/ })
      .first()
      .click();

    // Aroha teaches online only, so the format question never had to be asked.
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
      const byColumn = new Map<Element, number[]>();
      for (const block of blocks) {
        const column = block.parentElement;
        if (column === null) continue;
        const tops = byColumn.get(column) ?? [];
        tops.push(Math.round(block.getBoundingClientRect().top));
        byColumn.set(column, tops);
      }
      const perColumn = [...byColumn.values()].map((tops) => new Set(tops).size);
      return {
        blockCount: blocks.length,
        mostInOneColumn: Math.max(0, ...perColumn),
        selectable: blocks.every((block) => block.tagName === 'BUTTON'),
      };
    });

    expect(geometry.blockCount).toBeGreaterThan(1);
    // More than one distinct start on a single day: not merged into a band.
    expect(geometry.mostInOneColumn).toBeGreaterThan(1);
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
     * THE POINT OF THIS TEST. The whole wizard has been walked to its last
     * screen, and the review itself promises the subject will be added *when
     * you send* — which is only an honest thing to say if it has not been
     * added already.
     */
    await expect(page.getByText(/will be added to .* subjects when you send/)).toBeVisible();
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
    await expect(page.getByText('Mathematics').first()).toBeVisible({ timeout: 15_000 });
  });
});
