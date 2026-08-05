import type { DomainError } from './errors';

/**
 * Command result — explicit success/failure without exceptions crossing the
 * domain boundary.
 */
export type CommandResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DomainError };

export function ok<T>(value: T): CommandResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: DomainError): CommandResult<T> {
  return { ok: false, error };
}

export function unwrap<T>(result: CommandResult<T>): T {
  if (!result.ok) {
    throw new Error(
      `Unwrapped a failed CommandResult: ${result.error.code} — ${result.error.message}`,
    );
  }
  return result.value;
}
