import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { auditSchema } from '../shared/schemas';
import { users } from '../identity/users';

/**
 * `audit.audit_events` — append-only (Permissions doc §88). Corrections are
 * linked records, never edits. Server-only: no browser-facing RLS policy.
 */
export const auditEvents = auditSchema.table('audit_events', {
  ...standardColumns,
  category: text('category').notNull(), // security | business | financial | sensitive_access
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
  actorRoleCode: text('actor_role_code'),
  activeWorkspaceCode: text('active_workspace_code'),
  correlationId: text('correlation_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  originalValue: jsonb('original_value'),
  newValue: jsonb('new_value'),
  riskLevel: text('risk_level').notNull().default('low'),
});
