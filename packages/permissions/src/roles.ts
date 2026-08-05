/**
 * The nine role definitions from Permissions, Roles and Access Control (doc 08).
 * Doc 03's single "Admin" maps to platform_manager + platform_owner.
 * Roles are composed of capabilities and never hardcoded as boolean columns
 * (Database spec §4.3) — these codes seed `permissions.role_definitions`.
 */
export const ROLE_CODES = [
  'parent_guardian',
  'dependent_student',
  'independent_student',
  'tutor',
  'supporter',
  'organisation_member',
  'organisation_manager',
  'platform_manager',
  'platform_owner',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_DISPLAY_NAMES: Record<RoleCode, string> = {
  parent_guardian: 'Parent or guardian',
  dependent_student: 'Dependent student',
  independent_student: 'Independent student',
  tutor: 'Tutor',
  supporter: 'Supporter',
  organisation_member: 'Organisation member',
  organisation_manager: 'Organisation manager',
  platform_manager: 'Platform Manager',
  platform_owner: 'Platform Owner',
};
