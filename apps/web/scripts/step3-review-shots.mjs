/**
 * Screenshots for the step 3 manual review point.
 *
 * A throwaway script, not part of the test suite: it drives the running dev
 * server and writes five images so the owner can judge the interaction before
 * step 4 starts. Delete it once the review is done.
 *
 *   node apps/web/scripts/step3-review-shots.mjs [baseURL] [outDir]
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3001';
const OUT = process.argv[3] ?? 'S:/Studdy/.review/step3';
const PASSWORD = 'Studdy-local-only-1';
const FAMILY = 'parent.two@local.studdy.test';

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email address').fill(FAMILY);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
}

/** Reach scoped discovery, creating the student and subject need if absent. */
async function scopedDiscovery(page) {
  await page.goto(`${BASE}/parent`);
  const settled = page.getByRole('link', {
    name: /Find tutors|Add a subject|Add a student|Add your first student/,
  });
  await settled.first().waitFor({ timeout: 30_000 });

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
      await page.getByLabel('School year').selectOption({ label: 'Year 10' });
      await page.getByRole('button', { name: 'Add student' }).click();
      await page.waitForURL(/\/parent$/);
      await page
        .getByRole('link', { name: /Add a subject/ })
        .first()
        .waitFor({ timeout: 30_000 });
    }
    await page
      .getByRole('link', { name: /Add a subject/ })
      .first()
      .click();
    await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' });
    // Year 10 so more than one seeded tutor matches: the card grid is part of
    // what is being reviewed, and one card says nothing about browsing several.
    await page.getByLabel('School year for this subject').selectOption({ label: 'Year 10' });
    await page.getByRole('button', { name: 'Save and find tutors' }).click();
  } else {
    await findTutors.click();
  }
  await page.waitForURL(/\/tutors\?section=/, { timeout: 30_000 });
}

/**
 * Follow the card's primary action through to a profile.
 *
 * Waits for the page to settle first: on a cold dev server the click can land
 * before hydration and be swallowed, which shows up as a navigation timeout
 * rather than as anything wrong with the page.
 */
async function openFirstProfile(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  const link = page.getByRole('link', { name: 'View availability' }).first();
  await link.waitFor({ timeout: 30_000 });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await link.click();
    try {
      await page.waitForURL(/\/tutors\/TUTOR-/, { timeout: 20_000 });
      return;
    } catch {
      if (attempt === 2) throw new Error('could not open a tutor profile');
    }
  }
}

async function shoot(page, name) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`wrote ${OUT}/${name}.png`);
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

// ---- Signed out, laptop width -------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/tutors`);
  await page.getByRole('heading', { name: 'Find a tutor' }).waitFor({ timeout: 30_000 });
  await shoot(page, '3-signed-out-discovery');

  await openFirstProfile(page);
  await shoot(page, '4-signed-out-profile');
  await context.close();
}

// ---- Signed in, laptop width --------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page);
  await scopedDiscovery(page);
  await page
    .getByRole('group', { name: /Bookable times for/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await shoot(page, '1-signed-in-discovery-laptop');

  await openFirstProfile(page);
  await page.getByRole('heading', { name: 'Availability' }).waitFor({ timeout: 30_000 });
  await shoot(page, '2-signed-in-profile');

  // Second page of the horizon, to show navigation working.
  const later = page.getByRole('link', { name: 'Show the later seven days' });
  if ((await later.count()) > 0) {
    await later.click();
    // Wait for the URL, not for the heading: the heading is already on screen
    // from the previous render, so waiting for it captures the old week.
    await page.waitForURL(/week=2/, { timeout: 30_000 });
    await page
      .getByRole('group', { name: /Bookable times for/ })
      .first()
      .waitFor({ timeout: 30_000 });
    await shoot(page, '2b-signed-in-profile-week-2');
  }
  await context.close();
}

// ---- Signed in, narrow --------------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page);
  await scopedDiscovery(page);
  await page
    .getByRole('group', { name: /Bookable times for/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await shoot(page, '5a-signed-in-discovery-mobile');

  await openFirstProfile(page);
  await page.getByRole('heading', { name: 'Availability' }).waitFor({ timeout: 30_000 });
  await shoot(page, '5b-signed-in-profile-mobile');
  await context.close();
}

await browser.close();
console.log('done');
