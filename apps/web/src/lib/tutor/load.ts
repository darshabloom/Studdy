import 'server-only';
import { cache } from 'react';
import {
  listBookingsForTutor,
  listRequestsForTutor,
  tutorProfileForUser,
  type TutorBookingView,
  type TutorRequestView,
} from '@studdy/database';
import { resolveIdentity } from '@/lib/identity/resolve';

export interface TutorWorkspace {
  readonly tutorProfileId: string;
  readonly bookings: readonly TutorBookingView[];
  readonly requests: readonly TutorRequestView[];
}

/**
 * Everything the Tutor workspace reads about lessons and requests, scoped once.
 *
 * The tutor profile comes from the SESSION and is the only key either read
 * takes, so a page cannot be handed another tutor's lessons or students by a
 * reference in its URL. Null means "no tutor profile here": signed out, a
 * database blip, or an application not yet approved — never a default tutor.
 * Cached per request so a page and its pieces share one load.
 */
export const loadTutorWorkspace = cache(async (): Promise<TutorWorkspace | null> => {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null || !identity.databaseAvailable) {
    return null;
  }
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) return null;

  const [bookings, requests] = await Promise.all([
    listBookingsForTutor(profile.id),
    listRequestsForTutor(profile.id),
  ]);
  return { tutorProfileId: profile.id, bookings, requests };
});
