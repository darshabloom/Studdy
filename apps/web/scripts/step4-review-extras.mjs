/**
 * The two step 4 screens the main walk cannot reach.
 *
 *   * the discovery card's new "Book a lesson" entry point, which only appears
 *     for a family already acting on a subject;
 *   * the format step, which only appears for a tutor whose service version can
 *     be delivered both ways — and among the seeded tutors that is James's
 *     Calculus, taught at Years 10–13, so it needs a senior student.
 *
 *   node apps/web/scripts/step4-review-extras.mjs [baseURL] [outDir]
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3200';
const OUT = process.argv[3] ?? 'S:/Studdy/.review/step4';
const PASSWORD = 'Studdy-local-only-1';
const FAMILY = 'parent.booking@local.studdy.test';

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email address').fill(FAMILY);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
}

async function shoot(page, name) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`wrote ${OUT}/${name}.png`);
}

async function addStudent(page, name, year) {
  await page.goto(`${BASE}/parent`);
  // Wait for the dashboard before counting: `count()` does not auto-wait, and
  // reading it too early reports "no such student" and adds a duplicate — which
  // would quietly change how many children this family has, and with it which
  // questions the booking journey asks.
  await page
    .getByRole('link', { name: /Find tutors|Add a subject|Add a student|Add your first student/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if ((await page.getByText(name).count()) > 0) return;
  await page
    .getByRole('link', { name: /Add a student|Add your first student/ })
    .first()
    .click();
  await page.getByLabel("Student's first name").fill(name);
  await page.getByLabel('Family name').fill('Tester');
  await page.getByLabel('School year').selectOption({ label: year });
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.waitForURL(/\/parent$/, { timeout: 30_000 });
}

/** Give the family a subject context, which is what unlocks the card CTA. */
async function scopedDiscovery(page, subject, year) {
  await page.goto(`${BASE}/parent`);
  const findTutors = page.getByRole('link', { name: 'Find tutors' }).first();
  if ((await findTutors.count()) > 0) {
    await findTutors.click();
  } else {
    await page
      .getByRole('link', { name: /Add a subject/ })
      .first()
      .click();
    await page.getByLabel('Subject', { exact: true }).selectOption({ label: subject });
    await page.getByLabel('School year for this subject').selectOption({ label: year });
    await page.getByRole('button', { name: 'Save and find tutors' }).click();
  }
  await page.waitForURL(/\/tutors\?section=/, { timeout: 30_000 });
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

// ---- Discovery, where "Book a lesson" now lives -------------------------
for (const [prefix, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await signIn(page);
  await addStudent(page, 'Booker', 'Year 9');
  await scopedDiscovery(page, 'Mathematics', 'Year 9');
  await shoot(page, `${prefix}-0-discovery-entry`);
  await context.close();
}

// ---- The format step, which needs a tutor who teaches both ways ---------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page);
  await addStudent(page, 'Senior', 'Year 12');

  /**
   * Decide on the heading that rendered, not on the URL.
   *
   * Adding Senior gives this family two children, so the child question IS
   * asked here — but only one tutor teaches Calculus at that level, so the
   * tutor question is not. A settled step forwards to the next, and reading
   * `page.url()` can catch the one being left rather than the one arrived at.
   */
  await page.goto(`${BASE}/book`);

  const childQuestion = page.getByRole('heading', { name: /Who is this lesson for/ });
  const subjectQuestion = page.getByRole('heading', { name: /help with/ });
  await childQuestion.or(subjectQuestion).waitFor({ timeout: 30_000 });

  if (await childQuestion.isVisible()) {
    await page
      .getByRole('link', { name: /Senior/ })
      .first()
      .click();
    await subjectQuestion.waitFor({ timeout: 30_000 });
  }

  await page.getByRole('link', { name: 'Calculus', exact: false }).first().click();

  /**
   * BOTH the tutor and the length can settle on the way here.
   *
   * James is the only tutor teaching Calculus at Year 12 AND publishes a single
   * length for it, so this journey skips two questions in a row and arrives at
   * the format one directly. An earlier version waited for the length heading
   * and timed out on a screen that was never going to be shown — so every hop
   * is optional now, and only the format question is required.
   */
  const tutorQuestion = page.getByRole('heading', { name: /Who should teach/ });
  const lengthQuestion = page.getByRole('heading', { name: /How long should the lesson/ });
  const formatQuestion = page.getByRole('heading', { name: /Online or in person/ });

  await tutorQuestion.or(lengthQuestion).or(formatQuestion).first().waitFor({ timeout: 30_000 });

  if (await tutorQuestion.isVisible()) {
    await page.getByRole('link', { name: /James/ }).first().click();
    await lengthQuestion.or(formatQuestion).first().waitFor({ timeout: 30_000 });
  }

  if (await lengthQuestion.isVisible()) {
    await page
      .getByRole('link', { name: /minutes/ })
      .first()
      .click();
  }

  await formatQuestion.waitFor({ timeout: 30_000 });
  await shoot(page, 'desktop-2b-format');
  await context.close();
}

// ---- The tutor-facing minimum gap control -------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email address').fill('tutor.a@local.studdy.test');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
  await page.goto(`${BASE}/tutor/availability`);
  await page.getByRole('heading', { name: 'Your availability' }).waitFor({ timeout: 30_000 });
  await shoot(page, 'desktop-6-tutor-minimum-gap');
  await context.close();
}

await browser.close();
console.log('done');
