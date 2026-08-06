import { sql } from 'drizzle-orm';
import { text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { tutorsSchema } from '../shared/schemas';
import { tutorProfiles } from './tutor-profiles';

/**
 * `tutors.tutor_verifications` — the fixed verification labels from doc 01
 * §14.3: identity_verified, qualification_verified, references_completed,
 * studdy_interviewed. Evidence records and the review workflow belong to the
 * tutor-onboarding slice; this holds only the earned label.
 */
export const tutorVerifications = tutorsSchema.table(
  'tutor_verifications',
  {
    ...standardColumns,
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),
    labelCode: text('label_code').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    statusCode: text('status_code').notNull().default('active'),
  },
  (table) => [
    uniqueIndex('tutor_verifications_live_unique_idx')
      .on(table.tutorProfileId, table.labelCode)
      .where(sql`${table.statusCode} = 'active'`),
  ],
);
