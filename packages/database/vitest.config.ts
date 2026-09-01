import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    /*
     * INTEGRATION TESTS ARE NOT UNIT TESTS, and running them here was a latent
     * hazard rather than extra coverage.
     *
     * They have their own script and their own config, which sets
     * `fileParallelism: false` because every one of them talks to the SAME
     * local database. This config had no such setting, so `pnpm test` picked
     * the same files up and ran them CONCURRENTLY — two suites truncating and
     * asserting on the same tables at once. It only stayed quiet because the
     * earlier suites happened not to collide.
     *
     * Excluding them loses nothing: CI runs `test:integration` as its own job,
     * and running the same files twice under two different parallelism settings
     * was never the intent.
     */
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.integration.test.ts'],
  },
});
