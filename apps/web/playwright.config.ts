import { defineConfig, devices } from '@playwright/test';

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
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 300_000,
  },
});
