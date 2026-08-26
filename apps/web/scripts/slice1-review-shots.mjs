/**
 * Photograph the payment-window screens, for the slice 1 checkpoint.
 *
 *   node slice1-review-shots.mjs [baseURL] [outDir]
 *
 * Walks the request journey to a real selection, so the deadline on screen is
 * the one actually snapshotted onto the request — not a mock. Run against a
 * PRODUCTION server on a freshly seeded database, never `pnpm dev`.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:3200';
const OUT = process.argv[3] ?? 'S:/Studdy/.review/slice1';
const PASSWORD = 'Studdy-local-only-1';
const STUDENT = 'student.requests@local.studdy.test';

async function shoot(page, prefix, name) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: `${OUT}/${prefix}-${name}.png`, fullPage: true });
  console.log(`wrote ${prefix}-${name}.png`);
}

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Email address').fill(STUDENT);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
}

async function walk(page, prefix) {
  await signIn(page);
  await page.goto(`${BASE}/requests`);

  const view = page.getByRole('link', { name: 'View request' }).first();
  await view.waitFor({ timeout: 30_000 });
  await view.click();
  await page.waitForURL(/\/requests\/LR-\d{8}/, { timeout: 30_000 });

  /*
   * The request may already be awaiting payment — the end-to-end suite leaves
   * one in that state — or still be ready to choose. Both are photographed
   * from whatever is actually on screen rather than from an assumed URL, the
   * trap the step 4 scripts hit repeatedly.
   */
  const choose = page.getByRole('link', { name: 'Choose your tutor' });
  if ((await choose.count()) > 0) {
    await choose.click();
    await page.getByRole('heading', { name: 'Choose your tutor' }).waitFor({ timeout: 30_000 });
    await shoot(page, prefix, '1-choose');

    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Choose this tutor' }).click();
    await page.waitForURL(/\/requests\/LR-\d{8}$/, { timeout: 30_000 });
  }

  await page
    .getByText(/You have .* to pay|You chose your tutor/)
    .first()
    .waitFor({ timeout: 30_000 });
  await shoot(page, prefix, '2-awaiting-payment');
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

await browser.close();
console.log('done');
