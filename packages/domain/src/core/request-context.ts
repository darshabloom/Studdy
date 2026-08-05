import type { RoleCode, WorkspaceCode } from '@studdy/permissions';
import type { AuthUserId, RoleAssignmentId, StuddyUserId } from './ids';
import type { IsoInstant } from './time';

/**
 * RequestContext per Blueprint §13. Resolved once per protected request; it
 * does NOT replace fresh authoritative loading inside commands — role
 * removal, suspension, relationship closure and temporary-grant expiry take
 * effect immediately.
 */
export interface ActiveRoleAssignment {
  readonly id: RoleAssignmentId;
  readonly roleCode: RoleCode;
  readonly workspaceEnabled: boolean;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
}

export type AuthenticationAssurance = 'standard' | 'mfa';

export interface RequestContext {
  readonly correlationId: string;
  readonly requestId: string;
  readonly authUserId: AuthUserId;
  readonly studdyUserId: StuddyUserId;
  readonly activeWorkspace: WorkspaceCode;
  readonly roleAssignments: readonly ActiveRoleAssignment[];
  readonly authenticationAssurance: AuthenticationAssurance;
  readonly locale: string;
  readonly timeZone: string;
  readonly environment: 'local' | 'development' | 'staging' | 'production';
  readonly resolvedAt: IsoInstant;
}
