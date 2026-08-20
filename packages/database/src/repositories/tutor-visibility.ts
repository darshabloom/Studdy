import { and, inArray, isNull, type SQL } from 'drizzle-orm';
import { tutorProfiles } from '../schema/index';

/**
 * Who counts as a publicly listed tutor.
 *
 * This must stay identical to the predicate in `public.public_tutor_search`
 * (migrations/reviewed-sql/rls/0003), because anything reachable *about* a
 * tutor — their calendar most of all — has to follow the same eligibility as
 * the listing itself. Status and visibility are independent axes: a tutor can
 * be `status_code = 'active'` while `visibility_state_code = 'unlisted'`,
 * having quietly stopped taking new students or been moderated. Checking only
 * status would leave that tutor's bookable time readable through any surface
 * that took a reference rather than going through the view.
 *
 * It lives here, shared, so the two cannot drift apart silently again.
 */
export const LISTED_TUTOR_STATUS_CODES = ['approved', 'active'] as const;
export const LISTED_TUTOR_VISIBILITY_CODES = ['public_recommended', 'public_reduced'] as const;

/** Drizzle condition for "this tutor is publicly listed right now". */
export function publiclyListedTutor(): SQL | undefined {
  return and(
    inArray(tutorProfiles.statusCode, [...LISTED_TUTOR_STATUS_CODES]),
    inArray(tutorProfiles.visibilityStateCode, [...LISTED_TUTOR_VISIBILITY_CODES]),
    isNull(tutorProfiles.archivedAt),
  );
}
