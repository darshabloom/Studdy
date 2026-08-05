import { boolean, char, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { identitySchema } from '../shared/schemas';
import { roleDefinitions } from '../permissions/role-definitions';
import { users } from './users';

/**
 * `identity.user_role_assignments` (Database spec §2.2). Workspace derives
 * from active assignments with workspace_enabled — there is no workspaces
 * table; resolution happens server-side (spec §13.3).
 */
export const userRoleAssignments = identitySchema.table('user_role_assignments', {
  ...standardColumns,
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  roleDefinitionId: uuid('role_definition_id')
    .notNull()
    .references(() => roleDefinitions.id, { onDelete: 'restrict' }),
  statusCode: text('status_code').notNull().default('active'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),
  assignedByUserId: uuid('assigned_by_user_id').references(() => users.id, {
    onDelete: 'restrict',
  }),
  assignmentReasonCode: text('assignment_reason_code'),
  workspaceEnabled: boolean('workspace_enabled').notNull().default(true),
  scopeType: text('scope_type'),
  scopeId: uuid('scope_id'),
  countryCode: char('country_code', { length: 2 }),
  /** FK lands when the organisations slice creates its tables. */
  organisationId: uuid('organisation_id'),
});
