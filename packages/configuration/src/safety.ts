import { currentEnvironment, type StuddyEnvironment } from './environment';

export class EnvironmentSafetyError extends Error {
  override name = 'EnvironmentSafetyError';
}

/**
 * Guard for destructive commands (db:reset, reseeding, bulk deletes).
 *
 * Brief §11: dangerous commands must fail safely where the target environment
 * is unclear; a reset must never casually run against Production. The default
 * allowlist is local only — development requires explicit opt-in at the call
 * site, and staging/production are never allowed through this guard.
 */
export function assertDestructiveCommandAllowed(
  commandName: string,
  allowed: readonly StuddyEnvironment[] = ['local'],
): void {
  const environment = currentEnvironment();
  if (allowed.includes('staging') || allowed.includes('production')) {
    throw new EnvironmentSafetyError(
      `${commandName}: staging and production may never be allow-listed for destructive commands.`,
    );
  }
  if (!allowed.includes(environment)) {
    throw new EnvironmentSafetyError(
      `${commandName} refused: STUDDY_ENVIRONMENT is "${environment}", allowed: ${allowed.join(', ')}.`,
    );
  }
}
