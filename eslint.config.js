import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Root ESLint flat config.
 *
 * Package boundary enforcement (Blueprint §14): the domain layer must not
 * import React, Next.js, Supabase clients, Drizzle implementations, Stripe,
 * Inngest, email-provider SDKs or other external provider SDKs. Enforced via
 * no-restricted-imports scoped to packages/domain.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'packages/database/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    // Domain purity: no framework or provider SDK imports (Blueprint §14).
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Domain must not import React.' },
            { name: 'next', message: 'Domain must not import Next.js.' },
            { name: 'drizzle-orm', message: 'Domain must not import Drizzle implementations.' },
            { name: 'stripe', message: 'Domain must not import the Stripe SDK.' },
            { name: 'inngest', message: 'Domain must not import the Inngest SDK.' },
          ],
          patterns: [
            { group: ['next/*'], message: 'Domain must not import Next.js.' },
            { group: ['react-dom', 'react-dom/*'], message: 'Domain must not import React DOM.' },
            {
              group: ['@supabase/*'],
              message: 'Domain must not import Supabase clients.',
            },
            {
              group: ['drizzle-orm/*'],
              message: 'Domain must not import Drizzle implementations.',
            },
            {
              group: ['@studdy/database', '@studdy/database/*'],
              message: 'Domain depends on repository interfaces, not the database package.',
            },
            {
              group: ['@studdy/integrations', '@studdy/integrations/*'],
              message: 'Domain depends on provider interfaces, not integration implementations.',
            },
            {
              group: ['@studdy/design-system', '@studdy/design-system/*'],
              message: 'Domain must not import the design system.',
            },
          ],
        },
      ],
    },
  },
);
