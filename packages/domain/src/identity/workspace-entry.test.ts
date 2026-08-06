import { describe, expect, it } from 'vitest';
import type { ActiveRoleAssignment } from '../core/request-context';
import type { RoleAssignmentId } from '../core/ids';
import { decideWorkspaceEntry } from './workspace-entry';

let n = 0;
function assignment(roleCode: ActiveRoleAssignment['roleCode']): ActiveRoleAssignment {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as RoleAssignmentId,
    roleCode,
    workspaceEnabled: true,
    scopeType: null,
    scopeId: null,
  };
}

describe('decideWorkspaceEntry (approved rules, 6 Aug 2026)', () => {
  it('one workspace → enter automatically', () => {
    expect(decideWorkspaceEntry([assignment('parent_guardian')], null)).toEqual({
      kind: 'enter',
      workspace: 'parent',
    });
  });

  it('several + valid saved preference → restore it', () => {
    const result = decideWorkspaceEntry(
      [assignment('parent_guardian'), assignment('tutor')],
      'tutor',
    );
    expect(result).toEqual({ kind: 'enter', workspace: 'tutor' });
  });

  it('several + no preference → chooser, never a silent priority order', () => {
    const result = decideWorkspaceEntry([assignment('parent_guardian'), assignment('tutor')], null);
    expect(result.kind).toBe('choose');
    if (result.kind === 'choose') {
      expect(result.options).toContain('parent');
      expect(result.options).toContain('tutor');
    }
  });

  it('several + stale preference the user no longer holds → chooser', () => {
    const result = decideWorkspaceEntry(
      [assignment('parent_guardian'), assignment('tutor')],
      'platform_owner',
    );
    expect(result.kind).toBe('choose');
  });

  it('no workspaces (pending tutor, supporter, no roles) → none', () => {
    expect(decideWorkspaceEntry([], null)).toEqual({ kind: 'none' });
    expect(decideWorkspaceEntry([assignment('supporter')], null)).toEqual({ kind: 'none' });
  });
});
