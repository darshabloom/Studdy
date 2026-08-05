import {
  authUserId,
  studdyUserId,
  type ActiveRoleAssignment,
  type RoleAssignmentId,
} from '@studdy/domain';
import type { StuddyUser } from '@studdy/domain/identity';
import type { RoleCode } from '@studdy/permissions';

let counter = 0;

function deterministicUuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

/** Deterministic synthetic Studdy User builder — never real personal data. */
export function buildStuddyUser(overrides: Partial<StuddyUser> = {}): StuddyUser {
  return {
    id: studdyUserId(deterministicUuid()),
    reference: `USER-${String(counter).padStart(6, '0')}`,
    legalName: null,
    preferredName: null,
    displayName: `Synthetic User ${counter}`,
    countryCode: 'NZ',
    timeZone: 'Pacific/Auckland',
    locale: 'en-NZ',
    accountStatusCode: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    recordVersion: 1,
    ...overrides,
  };
}

export function buildRoleAssignment(
  roleCode: RoleCode,
  overrides: Partial<ActiveRoleAssignment> = {},
): ActiveRoleAssignment {
  return {
    id: deterministicUuid() as RoleAssignmentId,
    roleCode,
    workspaceEnabled: true,
    scopeType: null,
    scopeId: null,
    ...overrides,
  };
}

export function buildAuthUserId(): ReturnType<typeof authUserId> {
  return authUserId(deterministicUuid());
}
