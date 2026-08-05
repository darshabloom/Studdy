import { integer, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { auditSchema } from '../shared/schemas';

/**
 * `audit.outbox_entries` — transactional outbox (ADR-0004). Delivery is
 * asynchronous and idempotent; duplicate processing must be detectable.
 */
export const outboxEntries = auditSchema.table('outbox_entries', {
  ...standardColumns,
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  correlationId: text('correlation_id').notNull(),
  statusCode: text('status_code').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});
