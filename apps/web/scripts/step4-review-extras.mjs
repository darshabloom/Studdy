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

  await page.goto(`${BASE}/book`);
  await page
    .getByRole('link', { name: /Senior/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Calculus', exact: false }).first().click();
  await page.getByRole('link', { name: /James/ }).first().click();
  await page
    .getByRole('heading', { name: /How long should the lesson/ })
    .waitFor({ timeout: 30_000 });
  await page
    .getByRole('link', { name: /minutes/ })
    .first()
    .click();
  await page.getByRole('heading', { name: /Online or in person/ }).waitFor({ timeout: 30_000 });
  await shoot(page, 'desktop-4b-format');
  await context.close();
}

await browser.close();
console.log('done');
