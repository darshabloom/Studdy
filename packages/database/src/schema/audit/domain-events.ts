import { jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { auditSchema } from '../shared/schemas';

/** `audit.domain_events` — written in the same transaction as the business change. */
export const domainEvents = auditSchema.table('domain_events', {
  ...standardColumns,
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  payload: jsonb('payload').notNull(),
  correlationId: text('correlation_id').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
});
