/**
 * Walk the optional multi-tutor journey and photograph every screen.
 *
 *   node ask-walk.mjs [baseURL] [outDir]
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3200';
const OUT = process.argv[3] ?? 'S:/Studdy/.review/step5';
const PASSWORD = 'Studdy-local-only-1';
const FAMILY = 'parent.one@local.studdy.test';

async function shoot(page, prefix, name) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: `${OUT}/${prefix}-${name}.png`, fullPage: true });
  console.log(`wrote ${prefix}-${name}.png`);
}

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email address').fill(FAMILY);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
}

const STUDENT = 'Comparer';

/** A shortlist hangs from a subject section, which hangs from a student. */
async function ensureStudent(page) {
  await page.goto(`${BASE}/parent`);
  await page
    .getByRole('link', { name: /Find tutors|Add a subject|Add a student|Add your first student/ })
    .first()
    .waitFor({ timeout: 30_000 });
  if ((await page.getByText(STUDENT).count()) > 0) return;

  const add = page.getByRole('link', { name: /Add a student|Add your first student/ }).first();
  if ((await add.count()) === 0) return;
  await add.click();
  await page.getByLabel("Student's first name").fill(STUDENT);
  await page.getByLabel('Family name').fill('Tester');
  await page.getByLabel('School year').selectOption({ label: 'Year 10' });
  await page.getByRole('button', { name: 'Add student' }).click();
  await page.waitForURL(/\/parent$/, { timeout: 30_000 });
}

async function walk(page, prefix) {
  await signIn(page);
  await ensureStudent(page);

  // Reach a subject section with a shortlist. Discovery is the way in.
  await page.goto(`${BASE}/parent`);
  const findTutors = page.getByRole('link', { name: 'Find tutors' }).first();
  const addSubject = page.getByRole('link', { name: /Add a subject/ }).first();
  await findTutors.or(addSubject).first().waitFor({ timeout: 30_000 });

  if (await findTutors.isVisible()) {
    await findTutors.click();
  } else {
    await addSubject.click();
    await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' });
    await page.getByLabel('School year for this subject').selectOption({ label: 'Year 10' });
    await page.getByRole('button', { name: 'Save and find tutors' }).click();
  }
  await page.waitForURL(/\/tutors/, { timeout: 30_000 });

  /*
   * Save every eligible tutor, so "ask multiple tutors" is genuinely on offer.
   *
   * Waits for the number of unsaved cards to DROP rather than for a fixed
   * pause: saving is a server action and a re-render, so a timed wait saved one
   * tutor on a fast pass and two on a slow one — which then decided whether the
   * rest of this walk ran at all.
   */
  for (let index = 0; index < 4; index += 1) {
    const unsaved = page.getByRole('button', { name: 'Save for later' });
    const before = await unsaved.count();
    if (before === 0) break;
    await unsaved.first().click();
    await page
      .waitForFunction(
        (count) =>
          [...document.querySelectorAll('button')].filter((button) =>
            button.textContent?.includes('Save for later'),
          ).length < count,
        before,
        { timeout: 15_000 },
      )
      .catch(() => {});
  }

  const section = new URL(page.url()).searchParams.get('section');
  if (section === null) throw new Error('no subject section in the discovery URL');

  await page.goto(`${BASE}/shortlist/${section}`);
  await page.getByRole('heading', { name: 'Your shortlist' }).waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '1-shortlist');

  const ask = page.getByRole('link', { name: 'Ask multiple tutors' });
  if ((await ask.count()) === 0) {
    console.log('NOTE: fewer than two tutors shortlisted; stopping after the shortlist');
    return;
  }
  await ask.click();

  await page
    .getByRole('heading', { level: 1, name: /How long should the lesson/ })
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '2-length');

  await page
    .getByRole('link', { name: /minutes/ })
    .first()
    .click();
  await page
    .getByRole('heading', { level: 1, name: /Online or in person/ })
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '3-format');

  await page
    .getByRole('link', { name: /^Online|^In person/ })
    .first()
    .click();
  await page
    .getByRole('heading', { level: 1, name: /When would suit/ })
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '4-times-empty');

  const boxes = page.getByRole('checkbox');
  await boxes.first().waitFor({ timeout: 30_000 });
  await boxes.first().check();
  const count = await boxes.count();
  if (count > 2) await boxes.nth(2).check();
  await shoot(page, prefix, '5-times-chosen');

  await page.getByRole('link', { name: 'Continue' }).click();
  await page
    .getByRole('heading', { level: 1, name: /Check this over/ })
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '6-review');

  return section;
}

/**
 * The case the whole slice exists for: a length only some of the shortlist
 * offers.
 *
 * Aroha publishes sixty and ninety for maths; James publishes sixty. Choosing
 * ninety therefore reaches one of the two, and James must be SHOWN as not
 * included with a plain reason rather than quietly dropped.
 */
async function walkExclusion(page, prefix, section) {
  await page.goto(`${BASE}/shortlist/${section}/ask/length`);
  await page
    .getByRole('heading', { level: 1, name: /How long should the lesson/ })
    .waitFor({ timeout: 30_000 });

  const ninety = page.getByRole('link', { name: /90 minutes/ }).first();
  if ((await ninety.count()) === 0) {
    console.log('NOTE: no second length published; skipping the exclusion shots');
    return;
  }
  await ninety.click();

  await page
    .getByRole('heading', { level: 1, name: /Online or in person/ })
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '7-format-fewer-tutors');

  await page
    .getByRole('link', { name: /^Online|^In person/ })
    .first()
    .click();
  await page
    .getByRole('heading', { level: 1, name: /When would suit/ })
    .waitFor({ timeout: 30_000 });

  const boxes = page.getByRole('checkbox');
  await boxes.first().waitFor({ timeout: 30_000 });
  await boxes.first().check();
  await page.getByRole('link', { name: 'Continue' }).click();
  await page
    .getByRole('heading', { level: 1, name: /Check this over/ })
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '8-review-with-exclusion');
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

for (const [prefix, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const section = await walk(page, prefix);
  if (section !== undefined) await walkExclusion(page, prefix, section);
  await context.close();
}

await browser.close();
console.log('done');
