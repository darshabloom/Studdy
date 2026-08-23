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
const FAMILY = 'parent.two@local.studdy.test';
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

  // Discovery, to show the new "Book a lesson" entry point in context.
  await page.goto(`${BASE}/parent`);
  const findTutors = page.getByRole('link', { name: 'Find tutors' }).first();
  if ((await findTutors.count()) > 0) {
    await findTutors.click();
    await page.waitForURL(/\/tutors/, { timeout: 30_000 });
    await shoot(page, prefix, '0-discovery-entry');
  }

  await page.goto(`${BASE}/book`);
  await page.getByRole('heading', { name: /Who is this lesson for/ }).waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '1-child');

  await page
    .getByRole('link', { name: new RegExp(STUDENT) })
    .first()
    .click();
  await page.getByRole('heading', { name: /help with/ }).waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '2-subject');

  await page.getByRole('link', { name: 'Mathematics', exact: false }).first().click();
  await page.getByRole('heading', { name: /Who should teach/ }).waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '3-tutor');

  await page.getByRole('link', { name: /Aroha/ }).first().click();
  await page
    .getByRole('heading', { name: /How long should the lesson/ })
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '4-length');

  await page
    .getByRole('link', { name: /60 minutes/ })
    .first()
    .click();
  await page.getByRole('heading', { name: /When would suit/ }).waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '5-times-empty');

  const slots = page.getByRole('group', { name: /Bookable times for/ }).getByRole('button');
  await slots.first().waitFor({ timeout: 30_000 });
  await slots.first().click();
  await slots.nth(2).click();
  await shoot(page, prefix, '6-times-chosen');

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: /Check this over/ }).waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '7-review');
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

// The format step only appears for a tutor who teaches both ways, so it needs
// its own walk rather than being absent from the review entirely.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page);
  await ensureStudent(page);
  await page.goto(`${BASE}/book`);
  await page
    .getByRole('link', { name: new RegExp(STUDENT) })
    .first()
    .click();
  const calculus = page.getByRole('link', { name: 'Calculus', exact: false }).first();
  if ((await calculus.count()) > 0) {
    await calculus.click();
    const tutor = page.getByRole('link', { name: /James/ }).first();
    if ((await tutor.count()) > 0) {
      await tutor.click();
      await page
        .getByRole('heading', { name: /How long should the lesson/ })
        .waitFor({ timeout: 30_000 });
      await page
        .getByRole('link', { name: /minutes/ })
        .first()
        .click();
      const format = page.getByRole('heading', { name: /Online or in person/ });
      if ((await format.count()) > 0) {
        await format.waitFor({ timeout: 30_000 });
        await shoot(page, 'desktop', '4b-format');
      }
    }
  }
  await context.close();
}

await browser.close();
console.log('done');
