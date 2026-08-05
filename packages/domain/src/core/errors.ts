/**
 * Business error codes. `MFA_REQUIRED` and `RESOURCE_CONFLICT` are first-class
 * codes per Technical Architecture §4.3 and Database spec §3 (optimistic
 * concurrency). The catalogue grows slice by slice.
 */
export const DOMAIN_ERROR_CODES = [
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'NOT_AUTHENTICATED',
  'NOT_AUTHORISED',
  'MFA_REQUIRED',
  'RESOURCE_CONFLICT',
  'PRECONDITION_FAILED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export interface DomainError {
  readonly code: DomainErrorCode;
  /** Developer-facing message. User-safe copy comes from the presentation layer. */
  readonly message: string;
  /** Structured details, e.g. field-level validation issues. */
  readonly details?: Readonly<Record<string, unknown>>;
}

export function domainError(
  code: DomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): DomainError {
  return details === undefined ? { code, message } : { code, message, details };
}
