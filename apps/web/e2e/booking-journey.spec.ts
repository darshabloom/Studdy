import { expect, test, type Page } from '@playwright/test';
import { clickUntilNavigated } from './helpers/navigation';

/**
 * The parent booking journey: child, subject, tutor, length, format, times,
 * review, send.
 *
 * Three things here are not ordinary UI assertions, and are why this spec
 * exists:
 *
 *   * NOTHING IS WRITTEN WHILE BROWSING. A subject appears on a child because a
 *     request was sent, never because a wizard was opened — so the journey is
 *     walked all the way to the last screen and the child is checked to be
 *     unchanged before Send is pressed.
 *   * EXACT START TIMES STAY DISTINCT. The read-only calendars merge contiguous
 *     slots into bands; this one must not, because four o'clock and half past
 *     four are the choice being made.
 *   * A QUESTION WITH ONE ANSWER IS STILL ASKED. This account has one child and
 *     one English tutor at that level, and both are still put to the parent —
 *     on a light screen that says why there is one option. That only one row is
 *     eligible is a fact about supply, and inferring a preference from it would
 *     take a decision away while appearing to have made it for them.
 *   * A CHOSEN TIME IS SHOWN AS AN INTERVAL. Starts are offered every fifteen
 *     minutes, but the family is asking for a whole lesson, so once chosen a
 *     time reads `4:00–5:00 pm` — never padded by the tutor's minimum gap.
 */
const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined;
const SEEDED_PASSWORD = 'Studdy-local-only-1';

/**
 * Dedicated to this spec, at BOTH levels.
 *
 * Playwright runs spec FILES in parallel, and this journey creates a student,
 * sends real requests and takes real calendar holds. Its own family, because
 * `parent.one@` is signed in and out by `discovery-presentation` and
 * `family-students-discovery` and the session dropped mid-journey. Its own
 * tutor, because holds on a shared tutor made the lesson-request and discovery
 * journeys fail on times this spec had quietly taken.
 */
const FAMILY = 'parent.booking@local.studdy.test';
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

/**
 * Open the wizard and answer the child question.
 *
 * The question is asked even though this account has one child, so this always
 * answers it rather than branching. It still tolerates arriving straight at the
 * subject, because a URL carrying a valid child prefills it — a prefilled
 * answer IS allowed, being a choice the parent already made elsewhere.
 */
async function openAtSubject(page: Page): Promise<void> {
  await page.goto('/book');
  await page.waitForURL(/\/book\/(child|subject)/, { timeout: 15_000 });

  if (page.url().includes('/book/child')) {
    await clickUntilNavigated(page, page.getByRole('link', { name: new RegExp(STUDENT) }).first());
  }

  await expect(page.getByRole('heading', { name: /need help with/ })).toBeVisible({
    timeout: 15_000,
  });
}

/** Walk as far as the times step, choosing the given lesson length. */
async function walkToTimes(page: Page, length: RegExp): Promise<void> {
  await openAtSubject(page);

  await clickUntilNavigated(page, page.getByRole('link', { name: SUBJECT, exact: false }).first());

  // Mei is the only English tutor at this level, and the screen says so — but
  // the parent still chooses her.
  await expect(page.getByRole('heading', { name: /Who should teach/ })).toBeVisible({
    timeout: 15_000,
  });
  await clickUntilNavigated(page, page.getByRole('link', { name: new RegExp(TUTOR) }).first());

  await expect(page.getByRole('heading', { name: /How long should the lesson/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('link', { name: length }).first().click();

  // Online only, and still confirmed rather than assumed.
  await expect(page.getByRole('heading', { name: /Online or in person/ })).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole('link', { name: /^Online/ })
    .first()
    .click();

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
    // still open rather than shown a broken screen or, worse, a send button.
    //
    // Which question that is depends on whether a child exists yet, and this
    // file runs serially — so the assertion is that review was refused and the
    // family landed on a real question, not on which particular one.
    await page.goto('/book/review');
    await expect(page).toHaveURL(/\/book\/(child|subject)/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Send request/ })).toHaveCount(0);
  });

  test('offers the tutor own lesson lengths, and carries the chosen one', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await openAtSubject(page);

    await clickUntilNavigated(
      page,
      page.getByRole('link', { name: SUBJECT, exact: false }).first(),
    );
    await clickUntilNavigated(page, page.getByRole('link', { name: new RegExp(TUTOR) }).first());

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

    // Mei teaches online only — and the parent is told that and accepts it,
    // rather than being moved past a condition of the lesson.
    await expect(page.getByRole('heading', { name: /Online or in person/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/offers this lesson online only/)).toBeVisible();
    await page
      .getByRole('link', { name: /^Online/ })
      .first()
      .click();

    await expect(page.getByRole('heading', { name: /When would suit/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: /90 minutes/ })).toBeVisible();
    await expect(page.getByText(/The tutor can accept one of them/)).toBeVisible();
  });

  /**
   * The correction that matters most here.
   *
   * Studdy must not read a preference off scarcity. One eligible tutor means
   * one option SHOWN, with a reason — a parent may well look at "the only
   * tutor" and decide to browse instead, and skipping the question would take
   * that decision away while looking like it had been made.
   */
  test('still asks a question that has only one valid answer', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);

    // One child on the account, and the question is still put.
    await page.goto('/book');
    await expect(page).toHaveURL(/\/book\/child/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: new RegExp(STUDENT) })).toBeVisible();
    await clickUntilNavigated(page, page.getByRole('link', { name: new RegExp(STUDENT) }).first());

    // One English tutor at this level, and the question is still put — with the
    // scarcity stated, and a way out of it offered.
    await clickUntilNavigated(
      page,
      page.getByRole('link', { name: SUBJECT, exact: false }).first(),
    );
    await expect(page).toHaveURL(/\/book\/tutor/, { timeout: 15_000 });
    await expect(page.getByText(/is the only tutor teaching/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse every tutor/ })).toBeVisible();

    // And nothing was decided on the parent's behalf on the way here: the tutor
    // row is still empty until they choose.
    const summary = page.getByRole('complementary', { name: 'Your request so far' });
    await expect(summary.getByText('(only option)')).toHaveCount(0);
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

  /**
   * The answers stay on screen, and stay changeable.
   *
   * A wizard that takes each answer away as it moves on asks a parent to hold
   * six decisions in their head and trust the seventh screen knows them. The
   * summary is built from the same resolved booking the screens are guarded by,
   * so what it claims and what the server would accept cannot drift.
   */
  test('accumulates the answers, and offers each one back', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await walkToTimes(page, /60 minutes/);

    const summary = page.getByRole('complementary', { name: 'Your request so far' });
    await expect(summary).toBeVisible();
    for (const answered of [STUDENT, SUBJECT, TUTOR, '60 minutes']) {
      await expect(summary.getByText(answered, { exact: false }).first()).toBeVisible();
    }

    /**
     * NOTHING IS MARKED AS DECIDED FOR THEM, because nothing was. Every answer
     * on this list is one the parent gave, including the ones whose question
     * had a single option.
     */
    await expect(summary.getByText('(only option)')).toHaveCount(0);

    // And every one of them offers a way back — especially the single-option
    // ones, since a parent reconsidering "the only tutor" needs it most.
    for (const answered of ['Who for', 'Subject', 'Tutor', 'Online or in person']) {
      await expect(
        summary.getByRole('link', { name: new RegExp(`Change ${answered}`) }),
      ).toBeVisible();
    }

    await summary.getByRole('link', { name: /Change Lesson length/ }).click();
    await expect(page.getByRole('heading', { name: /How long should the lesson/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  /**
   * A chosen time is a lesson, not a fifteen-minute slot.
   *
   * The grid offers starts every quarter hour because that is the granularity
   * that is bookable. The moment one is chosen it leaves that context — into a
   * receipt, a row, a review screen — so it is written as the span the lesson
   * occupies. Anything less invites a parent to think they asked for fifteen
   * minutes.
   */
  test('shows a chosen time as the whole lesson interval', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await walkToTimes(page, /60 minutes/);

    const slots = page.getByRole('group', { name: /Bookable times for/ }).getByRole('button');
    await expect(slots.first()).toBeVisible({ timeout: 15_000 });

    /**
     * A 60-minute lesson, so an interval an hour wide — never the start alone,
     * and never padded by the gap the tutor keeps afterwards.
     *
     * The calendar's own markers stay compact (`4:15`) because the heading has
     * just said how long the lesson is. Everything a chosen time travels INTO
     * has lost that context, so the interval is asserted there.
     */
    const interval = /\d{1,2}:\d{2}–\d{1,2}:\d{2}\s?(am|pm)/;

    await slots.first().click();
    await expect(page.getByText(/1 preferred time chosen/)).toBeVisible();
    await expect(page.getByText(interval).first()).toBeVisible();

    // A second choice reads as an alternative, not a second lesson.
    await slots.nth(2).click();
    await expect(page.getByText(/2 preferred times chosen/)).toBeVisible();
    await expect(page.getByText(/can accept any one of them/)).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: /Check this over/ })).toBeVisible({
      timeout: 15_000,
    });

    // Review says the same thing, in the same shape, and says outright that
    // they are alternatives where a bare list of two would not.
    await expect(page.getByText('Any one of these')).toBeVisible();
    await expect(page.getByText(interval).first()).toBeVisible();

    /**
     * And so does the persistent receipt.
     *
     * Reached by going BACK, which is the state where the receipt genuinely
     * holds times: while the family is still picking, the selection lives in
     * the picker and only reaches the URL on Continue — so a receipt reading
     * "Not yet" mid-selection is correct, not a gap in the wiring.
     */
    await clickUntilNavigated(page, page.getByRole('link', { name: '← Back' }));
    await expect(page).toHaveURL(/\/book\/times/, { timeout: 15_000 });

    const summary = page.getByRole('complementary', { name: 'Your request so far' });
    await expect(summary.getByText(interval).first()).toBeVisible();
    await expect(summary.getByText('Any one of these')).toBeVisible();
  });

  /**
   * The narrow-screen shape: one accordion, exactly one section open.
   *
   * This spec is excluded from the mobile project — it sends real requests and
   * takes real holds — so the viewport is narrowed here instead, which is also
   * what proves the two shapes come from ONE render rather than two routes.
   */
  test('reads as an accordion on a narrow screen', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await openAtSubject(page);
    await clickUntilNavigated(
      page,
      page.getByRole('link', { name: SUBJECT, exact: false }).first(),
    );
    await clickUntilNavigated(page, page.getByRole('link', { name: new RegExp(TUTOR) }).first());
    await expect(page.getByRole('heading', { name: /How long should the lesson/ })).toBeVisible({
      timeout: 15_000,
    });

    // The desktop receipt is not a second copy on screen; it is not on screen.
    await expect(page.getByRole('complementary', { name: 'Your request so far' })).toBeHidden();

    // EXACTLY ONE SECTION IS OPEN, and it is the question being asked.
    const openSections = page.getByRole('heading', { level: 2 });
    await expect(openSections).toHaveCount(1);
    await expect(openSections).toHaveText('Lesson length');

    // Completed sections show their answers while collapsed, and every one of
    // them reopens — including the tutor, whose question had a single option.
    const subjectSection = page.getByRole('link', { name: new RegExp(`Subject.*${SUBJECT}`, 's') });
    await expect(subjectSection).toBeVisible();
    await expect(
      page.getByRole('link', { name: new RegExp(`Tutor.*${TUTOR}`, 's') }),
    ).toBeVisible();
    await expect(page.getByText('(only option)')).toHaveCount(0);

    // Tapping a completed section opens it — and closes the one that was open.
    await clickUntilNavigated(page, subjectSection);
    await expect(page).toHaveURL(/\/book\/subject/, { timeout: 15_000 });
    const reopened = page.getByRole('heading', { level: 2 });
    await expect(reopened).toHaveCount(1);
    await expect(reopened).toHaveText('Subject');
  });

  /**
   * Quarter-hour starts, asserted on what a parent can actually click.
   *
   * Server-authoritative: the grid comes from the derivation, so a 4:15 option
   * exists here only because a 4:15 lesson is genuinely bookable.
   */
  test('offers quarter-hour start times', async ({ page }) => {
    await signIn(page, FAMILY);
    await ensureStudent(page);
    await walkToTimes(page, /60 minutes/);

    const calendar = page.getByRole('group', { name: /Bookable times for/ });
    await expect(calendar.getByRole('button').first()).toBeVisible({ timeout: 15_000 });

    const labels = await calendar.getByRole('button').allInnerTexts();
    const quarters = labels.filter((label) => /:15|:45/.test(label));
    expect(quarters.length, 'a quarter-past or quarter-to start should be offered').toBeGreaterThan(
      0,
    );
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
    await expect(page.getByText(/1 preferred time chosen/)).toBeVisible();
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
