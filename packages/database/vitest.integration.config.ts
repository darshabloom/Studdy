import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    /** Integration tests hit a real local database — no parallel file runs. */
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
