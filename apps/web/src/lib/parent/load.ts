import 'server-only';
import { cache } from 'react';
import {
  listBookingsForStudents,
  listPaymentsForStudents,
  listRequestsForStudents,
  type FamilyBookingView,
  type FamilyPaymentView,
  type FamilyRequestView,
} from '@studdy/database';
import type { DiscoveryContext } from '@studdy/domain/discovery';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

export interface FamilyOverview {
  readonly context: DiscoveryContext;
  readonly requests: readonly FamilyRequestView[];
  readonly bookings: readonly FamilyBookingView[];
  readonly payments: readonly FamilyPaymentView[];
}

/**
 * Everything the Parent workspace reads, scoped once.
 *
 * The student ids come from the signed-in person's own context and are the only
 * thing the three reads are keyed on, so a page cannot ask for another family's
 * records by passing a reference. Cached per request: a page and the pieces it
 * renders share one load.
 */
export const loadFamilyOverview = cache(async (): Promise<FamilyOverview | null> => {
  const context = await resolveDiscoveryContext();
  if (context === null) return null;

  const studentProfileIds = context.students.map((student) => student.studentProfileId);
  const [requests, bookings, payments] = await Promise.all([
    listRequestsForStudents(studentProfileIds),
    listBookingsForStudents(studentProfileIds),
    listPaymentsForStudents(studentProfileIds),
  ]);
  return { context, requests, bookings, payments };
});
