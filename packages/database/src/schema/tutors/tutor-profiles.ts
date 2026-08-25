import { sql } from 'drizzle-orm';
import { boolean, check, integer, text, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { tutorsSchema } from '../shared/schemas';
import { users } from '../identity/users';

/**
 * `tutors.tutor_profiles`. In this slice profiles are development seeds
 * (`source_type = 'development_seed'`); the real application, interview and
 * approval workflow arrives with the tutor-onboarding slice.
 *
 * Public exposure is NOT via this table — anonymous visitors read only
 * `public.public_tutor_search`, which projects the approved field list.
 */
export const tutorProfiles = tutorsSchema.table(
  'tutor_profiles',
  {
    ...standardColumns,
    reference: text('reference')
      .notNull()
      .unique()
      .default(sql`'TUTOR-' || lpad(nextval('platform.global_reference_seq')::text, 8, '0')`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** First name only is exposed publicly (doc 14 §13, privacy-conservative). */
    publicFirstName: text('public_first_name').notNull(),
    headline: text('headline'),
    teachingApproach: text('teaching_approach'),
    /** applicant | under_review | approved | active | unlisted | restricted | suspended */
    statusCode: text('status_code').notNull().default('active'),
    /** public_recommended | public_reduced | recommendations_paused | unlisted | existing_only | suspended */
    visibilityStateCode: text('visibility_state_code').notNull().default('public_recommended'),
    /** development_seed | approved_application */
    sourceTypeCode: text('source_type_code').notNull().default('development_seed'),
    yearLevelFrom: integer('year_level_from'),
    yearLevelTo: integer('year_level_to'),
    offersOnline: boolean('offers_online').notNull().default(true),
    offersInPerson: boolean('offers_in_person').notNull().default(false),
    /**
     * The least time that must pass between one lesson ending and the next
     * beginning: preparing, resetting, or travelling.
     *
     * ON THE PROFILE rather than on a rule, a service or a format. It is one
     * fact about how this tutor works, and rules are scoped policy — a
     * tutor-wide value spread across rule rows could disagree with itself, and
     * nothing would say which row was right. Fifteen minutes by default,
     * because back-to-back with no turnaround is nobody's real working day.
     *
     * Not yet split by format. An in-person lesson plausibly needs longer than
     * an online one, but travel buffers are their own modelled concept (§8.8)
     * and inventing half of one here would be worse than one honest number.
     */
    minimumGapMinutes: integer('minimum_gap_minutes').notNull().default(15),
    /** "Available this week", "Accepting new students", … (doc 14 §13). */
    availabilityLabelCode: text('availability_label_code').notNull().default('accepting_new'),
    completedLessonCount: integer('completed_lesson_count').notNull().default(0),
    /** Rating in hundredths (450 = 4.5) — integers only, never floats. */
    ratingHundredths: integer('rating_hundredths'),
    isNewToStuddy: boolean('is_new_to_studdy').notNull().default(true),
  },
  (table) => [
    // Free-text codes constrained so a typo cannot silently change public
    // visibility (the discovery view allow-lists these values).
    check(
      'tutor_profiles_status_check',
      sql`${table.statusCode} in ('applicant', 'under_review', 'more_information_required', 'approved', 'active', 'unlisted', 'restricted', 'suspended', 'departed')`,
    ),
    check(
      'tutor_profiles_visibility_check',
      sql`${table.visibilityStateCode} in ('public_recommended', 'public_reduced', 'recommendations_paused', 'unlisted', 'existing_only', 'suspended')`,
    ),
  ],
);
