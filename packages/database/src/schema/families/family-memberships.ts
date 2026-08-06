import { sql } from 'drizzle-orm';
import { boolean, check, index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { familiesSchema } from '../shared/schemas';
import { users } from '../identity/users';
import { familyAccounts } from './family-accounts';

/**
 * `families.family_memberships` — links a User to a Family Account and is the
 * basis of every family-scope permission decision (Data Model §24).
 *
 * Membership roles in this slice: primary_guardian, additional_guardian,
 * dependent_student. Supporter and organisation memberships arrive later.
 */
export const familyMemberships = familiesSchema.table(
  'family_memberships',
  {
    ...standardColumns,
    familyAccountId: uuid('family_account_id')
      .notNull()
      .references(() => familyAccounts.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    membershipRoleCode: text('membership_role_code').notNull(),
    statusCode: text('status_code').notNull().default('active'),
    isPrimaryGuardian: boolean('is_primary_guardian').notNull().default(false),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endReasonCode: text('end_reason_code'),
  },
  (table) => [
    // One live membership per person per family.
    uniqueIndex('family_memberships_live_unique_idx')
      .on(table.familyAccountId, table.userId)
      .where(sql`${table.statusCode} = 'active'`),
    // Family-scope helpers look up by user_id first; the composite unique
    // index above cannot serve that access path.
    index('family_memberships_user_idx').on(table.userId),
    check(
      'family_memberships_status_check',
      sql`${table.statusCode} in ('active', 'ended', 'suspended')`,
    ),
  ],
);
