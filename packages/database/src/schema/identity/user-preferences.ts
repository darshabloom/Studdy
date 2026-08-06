import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { identitySchema } from '../shared/schemas';
import { users } from './users';

/**
 * `identity.user_preferences` — per-user interface preferences, starting with
 * the last active workspace ("return to the last-used workspace", IA doc §2).
 * One row per user; writes are server-authoritative.
 */
export const userPreferences = identitySchema.table('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'restrict' }),
  lastActiveWorkspaceCode: text('last_active_workspace_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
