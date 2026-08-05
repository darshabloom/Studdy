import { z } from 'zod';

/**
 * Studdy environments (Technical Architecture; brief §11).
 * Credentials, auth users, storage buckets and databases are never shared
 * between environments.
 */
export const STUDDY_ENVIRONMENTS = ['local', 'development', 'staging', 'production'] as const;

export type StuddyEnvironment = (typeof STUDDY_ENVIRONMENTS)[number];

const serverEnvironmentSchema = z.object({
  STUDDY_ENVIRONMENT: z.enum(STUDDY_ENVIRONMENTS).default('local'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  /**
   * Server-only. Must never be exposed to browser code, committed, or placed
   * in any NEXT_PUBLIC_ variable (Blueprint §29.5).
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cached: ServerEnvironment | undefined;

/** Validate and return server-side environment variables. Throws on invalid values. */
export function serverEnvironment(source: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  if (cached === undefined) {
    cached = serverEnvironmentSchema.parse(source);
  }
  return cached;
}

/** Reset the cached environment — test use only. */
export function resetEnvironmentCache(): void {
  cached = undefined;
}

export function currentEnvironment(source: NodeJS.ProcessEnv = process.env): StuddyEnvironment {
  return serverEnvironment(source).STUDDY_ENVIRONMENT;
}
