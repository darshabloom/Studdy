/**
 * Screenshots for the step 4 manual review point.
 *
 * Development-only: drives a running server and writes one image per screen of
 * the parent booking journey, at desktop and mobile widths.
 *
 *   node apps/web/scripts/step4-review-shots.mjs [baseURL] [outDir]
 *
 * Point it at a PRODUCTION server (`pnpm build`, then
 * `pnpm --filter @studdy/web start --port 3200`) rather than `pnpm dev`: the
 * dev server on this machine wedges when a build runs against the same .next.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3200';
const OUT = process.argv[3] ?? 'S:/Studdy/.review/step4';
const PASSWORD = 'Studdy-local-only-1';
// The booking journey's own family, so the review reflects the same account
// the spec exercises rather than one another spec is mutating.
const FAMILY = 'parent.booking@local.studdy.test';
const STUDENT = 'Booker';

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email address').fill(FAMILY);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
}

async function ensureStudent(page) {
  await page.goto(`${BASE}/parent`);
  await page
    .getByRole('link', { name: /Find tutors|Add a subject|Add a student|Add your first student/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if ((await page.getByText(STUDENT).count()) > 0) return;
  await page
    .getByRole('link', { name: /Add a student|Add your first student/ })
    .first()
    .click();
  await page.getByLabel("Student's first name").fill(STUDENT);
  await page.getByLabel('Family name').fill('Tester');
  await page.getByLabel('School year').selectOption({ label: 'Year 9' });
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.waitForURL(/\/parent$/, { timeout: 30_000 });
}

async function shoot(page, prefix, name) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: `${OUT}/${prefix}-${name}.png`, fullPage: true });
  console.log(`wrote ${OUT}/${prefix}-${name}.png`);
}

/** Walk the whole journey, photographing every screen, stopping before send. */
async function walk(page, prefix) {
  await signIn(page);
  await ensureStudent(page);

  // Discovery, to show the new "Book a lesson" entry point in context. It only
  // appears for a family acting on a subject, so make sure one exists first.
  await page.goto(`${BASE}/parent`);
  const findTutors = page.getByRole('link', { name: 'Find tutors' }).first();
  const addSubject = page.getByRole('link', { name: /Add a subject/ }).first();
  /**
   * Wait for whichever of the two the dashboard offers before asking which it
   * was: `count()` does not auto-wait, and reading it against a page that has
   * not rendered reports "neither" and silently skips this screenshot.
   *
   * `.first()` on the UNION, not on each side. Once a subject exists the
   * dashboard shows both links, and waiting on a two-element union is a strict
   * mode violation — which is why the second viewport failed where the first
   * had passed.
   */
  await findTutors.or(addSubject).first().waitFor({ timeout: 30_000 });

  if (await findTutors.isVisible()) {
    await findTutors.click();
  } else {
    await addSubject.click();
    await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' });
    await page.getByLabel('School year for this subject').selectOption({ label: 'Year 9' });
    await page.getByRole('button', { name: 'Save and find tutors' }).click();
  }
  await page.waitForURL(/\/tutors/, { timeout: 30_000 });
  await shoot(page, prefix, '0-discovery-entry');

  /**
   * DECIDE ON WHAT RENDERED, NOT ON THE URL.
   *
   * Every question is asked now, however few options it has — but a prefilled
   * answer can still carry the journey past one, so each hop stays optional.
   * Reading `page.url()` after a `waitForURL` can catch the step being LEFT
   * rather than the one arrived at, and the branch then waits for a heading
   * that was never going to appear. Waiting on the real headings asks the only
   * question that matters: which screen is the family looking at?
   */
  await page.goto(`${BASE}/book`);

  const childQuestion = page.getByRole('heading', { level: 1, name: /Who is this lesson for/ });
  const subjectQuestion = page.getByRole('heading', { level: 1, name: /help with/ });
  await childQuestion.or(subjectQuestion).first().waitFor({ timeout: 30_000 });

  // One child on this account, and the question is still put — which is the
  // point of the screenshot.
  if (await childQuestion.isVisible()) {
    await shoot(page, prefix, '1-child');
    await page
      .getByRole('link', { name: new RegExp(STUDENT) })
      .first()
      .click();
  }

  await subjectQuestion.waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '2-subject');

  await page.getByRole('link', { name: 'Mathematics', exact: false }).first().click();

  const tutorQuestion = page.getByRole('heading', { level: 1, name: /Who should teach/ });
  const lengthQuestion = page.getByRole('heading', {
    level: 1,
    name: /How long should the lesson/,
  });
  await tutorQuestion.or(lengthQuestion).first().waitFor({ timeout: 30_000 });

  // Aroha is the only maths tutor at this level. The screen says so, and the
  // parent still chooses her — worth a picture, since it is the correction.
  if (await tutorQuestion.isVisible()) {
    await shoot(page, prefix, '3-tutor-single-option');
    await page.getByRole('link', { name: /Aroha/ }).first().click();
  }

  await lengthQuestion.waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '4-length');

  await page
    .getByRole('link', { name: /60 minutes/ })
    .first()
    .click();

  // Aroha teaches this one way only, so this is the single-option format
  // screen: shown, explained, and confirmed rather than assumed.
  const formatQuestion = page.getByRole('heading', { level: 1, name: /Online or in person/ });
  const timesQuestion = page.getByRole('heading', { level: 1, name: /When would suit/ });
  await formatQuestion.or(timesQuestion).first().waitFor({ timeout: 30_000 });

  if (await formatQuestion.isVisible()) {
    await shoot(page, prefix, '5-format-single-option');
    await page
      .getByRole('link', { name: /^Online|^In person/ })
      .first()
      .click();
  }

  await timesQuestion.waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '6-times-empty');

  // Two starts, so the chips show full intervals AND say they are alternatives.
  const slots = page.getByRole('group', { name: /Bookable times for/ }).getByRole('button');
  await slots.first().waitFor({ timeout: 30_000 });
  await slots.first().click();
  await slots.nth(2).click();
  await shoot(page, prefix, '7-times-chosen');

  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('heading', { level: 1, name: /Check this over/ })
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '8-review');

  // Back from review is the state where the persistent receipt itself holds the
  // times, since the picker's selection only reaches the URL on Continue.
  await page.getByRole('link', { name: '← Back' }).click();
  await timesQuestion.waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '9-receipt-with-intervals');
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

for (const [prefix, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await walk(page, prefix);
  await context.close();
}

/**
 * The format step lives in the extras script, not here.
 *
 * It only appears for a tutor who teaches one version both ways, and among the
 * seeded tutors that is James's Calculus at Years 10–13 — which needs a SENIOR
 * student this walk's Year 9 account does not have. The version that used to
 * sit here was guarded by `count()` checks that could never pass, so it wrote
 * nothing and looked like it had.
 */
await browser.close();
console.log('done');
