import type { RoleCode } from './roles';

/**
 * Workspace codes. No document enumerates these (identified gap in the
 * planning digest); this list is derived from the IA doc (§2) workspace list
 * and is recorded as an implementation decision pending approval.
 *
 * There is no workspaces table — a workspace derives from active role
 * assignments with `workspace_enabled`, resolved server-side (Blueprint §6.1,
 * Database spec §13.3).
 */
export const WORKSPACE_CODES = [
  'parent',
  'tutor',
  'dependent_student',
  'independent_student',
  'organisation',
  'platform_manager',
  'platform_owner',
] as const;

export type WorkspaceCode = (typeof WORKSPACE_CODES)[number];

/** Which role grants which workspace. Supporter has no workspace in package one. */
export const ROLE_TO_WORKSPACE: Partial<Record<RoleCode, WorkspaceCode>> = {
  parent_guardian: 'parent',
  tutor: 'tutor',
  dependent_student: 'dependent_student',
  independent_student: 'independent_student',
  organisation_member: 'organisation',
  organisation_manager: 'organisation',
  platform_manager: 'platform_manager',
  platform_owner: 'platform_owner',
};

/** URL segment for each workspace's route group in apps/web. */
export const WORKSPACE_ROUTE_SEGMENTS: Record<WorkspaceCode, string> = {
  parent: 'parent',
  tutor: 'tutor',
  dependent_student: 'student',
  independent_student: 'student',
  organisation: 'organisation',
  platform_manager: 'manager',
  platform_owner: 'owner',
};
