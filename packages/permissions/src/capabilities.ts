/**
 * Capability model per Permissions doc (08) §3: `resource.action` plus scope,
 * limits and conditions. No complete capability catalogue exists yet in the
 * planning pack — the catalogue grows slice by slice and is seeded into
 * `permissions` schema tables in later pull requests.
 */

/** Record scopes (doc 08 §3 — eleven scopes; package-one subset first). */
export const RECORD_SCOPES = [
  'own',
  'created',
  'assigned',
  'relationship_linked',
  'subject_linked',
  'programme_linked',
  'organisation',
  'regional',
  'country',
  'all',
] as const;

export type RecordScope = (typeof RECORD_SCOPES)[number];

export type Capability = `${string}.${string}`;

export interface PermissionDecision {
  /** Whether the action is allowed. */
  allowed: boolean;
  /** The capability that was evaluated. */
  capability: Capability;
  /** Access sources granting the capability, empty when denied. */
  grantingSources: readonly string[];
  /** Restrictions and limits applied to the grant. */
  restrictions: readonly string[];
  /** Authentication assurance required (e.g. step-up / MFA). */
  requiredAuthentication: 'standard' | 'step_up';
  /** User-safe explanation, e.g. "You do not have access to family payment information". */
  explanation: string;
  /** Whether the evaluation must be audited. */
  auditRequired: boolean;
}

export function deny(capability: Capability, explanation: string): PermissionDecision {
  return {
    allowed: false,
    capability,
    grantingSources: [],
    restrictions: [],
    requiredAuthentication: 'standard',
    explanation,
    auditRequired: false,
  };
}
