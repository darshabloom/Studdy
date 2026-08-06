import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Load .env.local into the Playwright process (Next.js loads it itself, but
// spec-level skip conditions and helpers need the values too).
try {
  const envFile = readFileSync(join(__dirname, '.env.local'), 'utf8');
  for (const line of envFile.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match !== null && match[1] !== undefined && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
} catch {
  // No .env.local — CI provides env directly.
}

/**
 * E2E foundation (brief §5 testing): public page, auth route, protected
 * workspace. Runs against a production build; Supabase is optional — tests
 * that need it are written to pass in both configured and unconfigured
 * environments (protected routes fail closed either way).
 */
const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: process.env.CI !== undefined ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      // Identity flows mutate shared seeded accounts (preferences, sessions);
      // running them concurrently in two projects races. Functional flow
      // coverage runs on desktop; mobile keeps layout-facing specs.
      testIgnore: /identity-flows/,
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 300_000,
  },
});
