import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { auditSchema } from '../shared/schemas';
import { users } from '../identity/users';

/** `audit.status_transitions` — no silent status changes (Statuses doc, Part 25). */
export const statusTransitions = auditSchema.table('status_transitions', {
  ...standardColumns,
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fromStatusCode: text('from_status_code'),
  toStatusCode: text('to_status_code').notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'restrict' }),
  reasonCode: text('reason_code'),
  correlationId: text('correlation_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
});
