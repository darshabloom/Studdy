import { describe, expect, it } from 'vitest';
import type { ActiveRoleAssignment } from '../core/request-context';
import type { RoleAssignmentId } from '../core/ids';
import { availableWorkspaces, resolveActiveWorkspace } from './workspace-resolution';

function assignment(
  roleCode: ActiveRoleAssignment['roleCode'],
  workspaceEnabled = true,
): ActiveRoleAssignment {
  return {
    id: `00000000-0000-4000-8000-00000000000${Math.floor(Math.random() * 10)}` as RoleAssignmentId,
    roleCode,
    workspaceEnabled,
    scopeType: null,
    scopeId: null,
  };
}

describe('availableWorkspaces', () => {
  it('maps enabled role assignments to workspaces', () => {
    expect(availableWorkspaces([assignment('parent_guardian')])).toEqual(['parent']);
    expect(availableWorkspaces([assignment('tutor')])).toEqual(['tutor']);
  });

  it('ignores workspace-disabled assignments', () => {
    expect(availableWorkspaces([assignment('parent_guardian', false)])).toEqual([]);
  });

  it('supporter grants no workspace in package one', () => {
    expect(availableWorkspaces([assignment('supporter')])).toEqual([]);
  });

  it('deduplicates organisation roles into one workspace', () => {
    const result = availableWorkspaces([
      assignment('organisation_member'),
      assignment('organisation_manager'),
    ]);
    expect(result).toEqual(['organisation']);
  });
});

describe('resolveActiveWorkspace', () => {
  const parentAndTutor = [assignment('parent_guardian'), assignment('tutor')];

  it('honours a requested workspace the user holds', () => {
    expect(resolveActiveWorkspace(parentAndTutor, { requested: 'tutor' })).toBe('tutor');
  });

  it('refuses a requested workspace the user does not hold', () => {
    expect(resolveActiveWorkspace(parentAndTutor, { requested: 'platform_owner' })).toBe('parent');
  });

  it('falls back to last-used, then first available', () => {
    expect(resolveActiveWorkspace(parentAndTutor, { lastUsed: 'tutor' })).toBe('tutor');
    expect(resolveActiveWorkspace(parentAndTutor)).toBe('parent');
  });

  it('returns null when no workspace is available — URL entry is never sufficient', () => {
    expect(resolveActiveWorkspace([assignment('supporter')])).toBeNull();
    expect(resolveActiveWorkspace([])).toBeNull();
  });
});
