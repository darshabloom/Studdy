import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` path in tsconfig.json. Without it any test that
      // reaches app code fails to resolve, which reads as a missing package
      // rather than as missing configuration.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /*
       * `server-only` throws by design when imported outside a server
       * environment; Next resolves it to a no-op via the `react-server`
       * export condition, and Vitest does not. Pointed at the package's OWN
       * empty module rather than a stub of ours, so it stays whatever the
       * package says a server-side import should be.
       *
       * Aliasing this one module is deliberate — setting `resolve.conditions`
       * to `react-server` globally would change how React itself resolves.
       */
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    // Playwright specs live in e2e/ and must not run under Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    passWithNoTests: true,
  },
});
