import { and, desc, eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  intendedLessonRequests,
  requestTimeOptions,
  services,
  serviceVersions,
  studentProfiles,
  studentSubjectSections,
  subjects,
  tutorProfiles,
  tutorRequestTimeOptions,
  tutorRequests,
  tutorTimeReservations,
} from '../schema/index';

/**
 * Server-side projections for the request slice.
 *
 * These tables carry NO browser-facing grants (see reviewed-sql/rls/0004), so
 * every read goes through one of the two functions below. Each applies its own
 * explicit column list — which is what keeps the tutor-privacy boundary intact
 * where a role-level grant could not.
 */

// ---------------------------------------------------------------------------
// Family-facing projection: the requester sees their own request in full.
// ---------------------------------------------------------------------------

export interface RequestTimeOptionView {
  readonly startAt: Date;
  readonly endAt: Date;
  readonly position: number;
  /** offered | taken | lapsed | withdrawn */
  readonly statusCode: string;
}

export interface OfferedTimeView {
  readonly startAt: Date;
  readonly endAt: Date;
  /** offered | claimed | unavailable | lapsed */
  readonly statusCode: string;
}

export interface FamilyTutorRequestView {
  readonly tutorRequestId: string;
  readonly reference: string;
  readonly statusCode: string;
  /** Family-only: why it closed. Never present in the tutor projection. */
  readonly closeReasonCode: string | null;
  readonly respondByAt: Date;
  readonly tutorFirstName: string;
  readonly tutorReference: string;
  readonly priceAmountMinor: bigint;
  readonly currencyCode: string;
  /** Which of the family's times this tutor was actually asked about. */
  readonly offeredTimes: readonly OfferedTimeView[];
}

export interface FamilyRequestView {
  readonly intendedLessonRequestId: string;
  readonly reference: string;
  readonly statusCode: string;
  /** Every time the family offered, in the order they chose them. */
  readonly timeOptions: readonly RequestTimeOptionView[];
  readonly durationMinutes: number;
  readonly formatCode: string;
  readonly timeZone: string;
  readonly notesForTutors: string | null;
  readonly decisionDeadlineAt: Date;
  readonly closeReasonCode: string | null;
  readonly studentPreferredName: string;
  readonly subjectDisplayName: string;
  readonly tutorRequests: readonly FamilyTutorRequestView[];
}

/** Every request belonging to the given student profiles, newest first. */
export async function listRequestsForStudents(
  studentProfileIds: readonly string[],
): Promise<readonly FamilyRequestView[]> {
  if (studentProfileIds.length === 0) return [];
  const { sql, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        id: intendedLessonRequests.id,
        reference: intendedLessonRequests.reference,
        statusCode: intendedLessonRequests.statusCode,
        durationMinutes: intendedLessonRequests.durationMinutes,
        formatCode: intendedLessonRequests.formatCode,
        timeZone: intendedLessonRequests.timeZone,
        notesForTutors: intendedLessonRequests.notesForTutors,
        decisionDeadlineAt: intendedLessonRequests.decisionDeadlineAt,
        closeReasonCode: intendedLessonRequests.closeReasonCode,
        studentPreferredName: studentProfiles.preferredName,
        subjectDisplayName: subjects.displayName,
      })
      .from(intendedLessonRequests)
      .innerJoin(
        studentSubjectSections,
        eq(intendedLessonRequests.studentSubjectSectionId, studentSubjectSections.id),
      )
      .innerJoin(studentProfiles, eq(studentSubjectSections.studentProfileId, studentProfiles.id))
      .innerJoin(subjects, eq(studentSubjectSections.subjectId, subjects.id))
      .where(inArray(studentSubjectSections.studentProfileId, [...studentProfileIds]))
      .orderBy(desc(intendedLessonRequests.createdAt));

    if (rows.length === 0) return [];

    const children = await db
      .select({
        ilrId: tutorRequests.intendedLessonRequestId,
        tutorRequestId: tutorRequests.id,
        reference: tutorRequests.reference,
        statusCode: tutorRequests.statusCode,
        closeReasonCode: tutorRequests.closeReasonCode,
        respondByAt: tutorRequests.respondByAt,
        tutorFirstName: tutorProfiles.publicFirstName,
        tutorReference: tutorProfiles.reference,
        priceAmountMinor: serviceVersions.priceAmountMinor,
        currencyCode: serviceVersions.currencyCode,
      })
      .from(tutorRequests)
      .innerJoin(tutorProfiles, eq(tutorRequests.tutorProfileId, tutorProfiles.id))
      .innerJoin(serviceVersions, eq(tutorRequests.serviceVersionId, serviceVersions.id))
      .where(
        inArray(
          tutorRequests.intendedLessonRequestId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(tutorRequests.position);

    // The family's own full set of times, and the subset each tutor was asked
    // about. Both are family-side reads: this projection serves the requester.
    const options = await db
      .select({
        ilrId: requestTimeOptions.intendedLessonRequestId,
        startAt: requestTimeOptions.startsAt,
        endAt: requestTimeOptions.endsAt,
        position: requestTimeOptions.position,
        statusCode: requestTimeOptions.statusCode,
      })
      .from(requestTimeOptions)
      .where(
        inArray(
          requestTimeOptions.intendedLessonRequestId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(requestTimeOptions.position);

    const offered =
      children.length === 0
        ? []
        : await db
            .select({
              tutorRequestId: tutorRequestTimeOptions.tutorRequestId,
              startAt: tutorRequestTimeOptions.startsAt,
              endAt: tutorRequestTimeOptions.endsAt,
              statusCode: tutorRequestTimeOptions.statusCode,
            })
            .from(tutorRequestTimeOptions)
            .where(
              inArray(
                tutorRequestTimeOptions.tutorRequestId,
                children.map((child) => child.tutorRequestId),
              ),
            )
            .orderBy(tutorRequestTimeOptions.startsAt);

    return rows.map((row) => ({
      intendedLessonRequestId: row.id,
      reference: row.reference,
      statusCode: row.statusCode,
      timeOptions: options
        .filter((option) => option.ilrId === row.id)
        .map((option) => ({
          startAt: option.startAt,
          endAt: option.endAt,
          position: option.position,
          statusCode: option.statusCode,
        })),
      durationMinutes: row.durationMinutes,
      formatCode: row.formatCode,
      timeZone: row.timeZone,
      notesForTutors: row.notesForTutors,
      decisionDeadlineAt: row.decisionDeadlineAt,
      closeReasonCode: row.closeReasonCode,
      studentPreferredName: row.studentPreferredName,
      subjectDisplayName: row.subjectDisplayName,
      tutorRequests: children
        .filter((child) => child.ilrId === row.id)
        .map((child) => ({
          tutorRequestId: child.tutorRequestId,
          reference: child.reference,
          statusCode: child.statusCode,
          closeReasonCode: child.closeReasonCode,
          respondByAt: child.respondByAt,
          tutorFirstName: child.tutorFirstName,
          tutorReference: child.tutorReference,
          priceAmountMinor: child.priceAmountMinor,
          currencyCode: child.currencyCode,
          offeredTimes: offered
            .filter((entry) => entry.tutorRequestId === child.tutorRequestId)
            .map((entry) => ({
              startAt: entry.startAt,
              endAt: entry.endAt,
              statusCode: entry.statusCode,
            })),
        })),
    }));
  } finally {
    await sql.end();
  }
}

/** One request, scoped to student profiles the caller may act for. */
export async function findRequestForStudents(
  reference: string,
  studentProfileIds: readonly string[],
): Promise<FamilyRequestView | null> {
  const all = await listRequestsForStudents(studentProfileIds);
  return all.find((request) => request.reference === reference) ?? null;
}

// ---------------------------------------------------------------------------
// TUTOR-FACING PROJECTION — the privacy boundary.
//
// A tutor may learn ONLY about their own request. This projection therefore
// selects NOTHING that could reveal, directly or by inference:
//   * the Intended Lesson Request or its identifier
//   * sibling Tutor Requests, their number, or any tutor's identity
//   * the slot number within the fan-out
//   * why a request closed
//   * that this request was one of several
//
// Deliberately absent columns, each of which exists on the row:
//   intended_lesson_request_id, position, close_reason_code.
//
// The tutor addresses their request by `reference` (TREQ-), drawn from the
// global sequence shared with every other entity, so consecutive references
// reveal nothing about fan-out. Closure is reported as a single undifferentiated
// state.
// ---------------------------------------------------------------------------

export interface TutorRequestView {
  readonly reference: string;
  readonly statusCode: string;
  readonly respondByAt: Date;
  readonly sentAt: Date;
  /**
   * The times THIS tutor was offered, and nothing else.
   *
   * Never the family's full set: its size alone would tell the tutor how
   * flexible the family is, and by extension how easily replaced this tutor
   * would be. A tutor whose subset is smaller than the family's set cannot
   * tell that from this projection, because nothing here counts anything they
   * were not asked about.
   */
  readonly offeredTimes: readonly OfferedTimeView[];
  readonly durationMinutes: number;
  readonly formatCode: string;
  readonly timeZone: string;
  readonly notesForTutors: string | null;
  readonly subjectDisplayName: string;
  readonly studentPreferredName: string;
  readonly studentSchoolYearCode: string | null;
  readonly serviceDisplayName: string;
  readonly priceAmountMinor: bigint;
  readonly currencyCode: string;
  /** The temporary hold, labelled and time-boxed in the interface. */
  readonly holdExpiresAt: Date | null;
  readonly holdStatusCode: string | null;
}

/**
 * EVERY terminal state stays visible, and every non-decline ending renders
 * identically ("Closed — no longer available").
 *
 * Hiding some endings while showing others is itself a leak: a tutor who saw a
 * request while it was `sent` could tell "the family withdrew" (card vanished)
 * from "it ended some other way" (card still there). Once selection close-out
 * lands and losers become `closed`/`superseded`, that difference would reveal
 * the existence of a competitor. Keeping all of them visible and identically
 * labelled removes the channel.
 */
const TUTOR_VISIBLE_STATUSES = [
  'sent',
  'accepted',
  'selected',
  'declined',
  'expired',
  'acceptance_withdrawn',
  'closed',
] as const;

/**
 * Every request addressed to this tutor. Scoped by `tutorProfileId`, which the
 * caller resolves from the signed-in user — never from a URL parameter.
 */
export async function listRequestsForTutor(
  tutorProfileId: string,
): Promise<readonly TutorRequestView[]> {
  const { sql, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        tutorRequestId: tutorRequests.id,
        reference: tutorRequests.reference,
        statusCode: tutorRequests.statusCode,
        respondByAt: tutorRequests.respondByAt,
        sentAt: tutorRequests.sentAt,
        // THIS tutor's own lesson length, not the family-side figure.
        //
        // The ILR stores the longest duration across the invited tutors, so a
        // 60-minute tutor invited alongside a 90-minute one would have been
        // shown "90 minutes" — a number they know is not theirs, and therefore
        // proof that someone else was asked. Their own service version is both
        // the truthful answer and the one that reveals nothing.
        durationMinutes: serviceVersions.durationMinutes,
        formatCode: intendedLessonRequests.formatCode,
        timeZone: intendedLessonRequests.timeZone,
        notesForTutors: intendedLessonRequests.notesForTutors,
        subjectDisplayName: subjects.displayName,
        studentPreferredName: studentProfiles.preferredName,
        studentSchoolYearCode: studentSubjectSections.schoolYearCode,
        serviceDisplayName: services.displayName,
        priceAmountMinor: serviceVersions.priceAmountMinor,
        currencyCode: serviceVersions.currencyCode,
        holdExpiresAt: tutorTimeReservations.expiresAt,
        holdStatusCode: tutorTimeReservations.statusCode,
      })
      .from(tutorRequests)
      // The ILR is joined for the lesson details the tutor needs to assess the
      // request. Its identifier is NOT selected and never leaves the server.
      .innerJoin(
        intendedLessonRequests,
        eq(tutorRequests.intendedLessonRequestId, intendedLessonRequests.id),
      )
      .innerJoin(
        studentSubjectSections,
        eq(intendedLessonRequests.studentSubjectSectionId, studentSubjectSections.id),
      )
      .innerJoin(studentProfiles, eq(studentSubjectSections.studentProfileId, studentProfiles.id))
      .innerJoin(subjects, eq(studentSubjectSections.subjectId, subjects.id))
      .innerJoin(serviceVersions, eq(tutorRequests.serviceVersionId, serviceVersions.id))
      .innerJoin(services, eq(serviceVersions.serviceId, services.id))
      .leftJoin(
        tutorTimeReservations,
        and(
          eq(tutorTimeReservations.tutorRequestId, tutorRequests.id),
          eq(tutorTimeReservations.statusCode, 'active'),
        ),
      )
      .where(
        and(
          eq(tutorRequests.tutorProfileId, tutorProfileId),
          inArray(tutorRequests.statusCode, [...TUTOR_VISIBLE_STATUSES]),
        ),
      )
      .orderBy(desc(tutorRequests.sentAt));

    if (rows.length === 0) return [];

    // Only this tutor's own offered rows. `request_time_option_id` is
    // deliberately not selected: it is an identifier from the family's side of
    // the boundary, and nothing tutor-facing has any use for it.
    const offered = await db
      .select({
        tutorRequestId: tutorRequestTimeOptions.tutorRequestId,
        startAt: tutorRequestTimeOptions.startsAt,
        endAt: tutorRequestTimeOptions.endsAt,
        statusCode: tutorRequestTimeOptions.statusCode,
      })
      .from(tutorRequestTimeOptions)
      .where(
        inArray(
          tutorRequestTimeOptions.tutorRequestId,
          rows.map((row) => row.tutorRequestId),
        ),
      )
      .orderBy(tutorRequestTimeOptions.startsAt);

    // Map explicitly and drop the internal id, so the view a tutor receives
    // carries no key belonging to the request record itself.
    return rows.map(({ tutorRequestId, ...view }) => ({
      ...view,
      offeredTimes: offered
        .filter((entry) => entry.tutorRequestId === tutorRequestId)
        .map((entry) => ({
          startAt: entry.startAt,
          endAt: entry.endAt,
          statusCode: entry.statusCode,
        })),
    }));
  } finally {
    await sql.end();
  }
}

/**
 * One request addressed to this tutor, by reference. The tutorProfileId
 * predicate means a reference belonging to another tutor simply returns null —
 * a tutor cannot probe references to discover other requests.
 */
export async function findRequestForTutor(
  reference: string,
  tutorProfileId: string,
): Promise<TutorRequestView | null> {
  const all = await listRequestsForTutor(tutorProfileId);
  return all.find((request) => request.reference === reference) ?? null;
}

/** Resolve the signed-in user's tutor profile, if they hold one. */
export async function tutorProfileForUser(userId: string): Promise<{ id: string } | null> {
  const { sql, db } = createDatabaseClient();
  try {
    const [row] = await db
      .select({ id: tutorProfiles.id })
      .from(tutorProfiles)
      .where(and(eq(tutorProfiles.userId, userId), eq(tutorProfiles.statusCode, 'active')));
    return row ?? null;
  } finally {
    await sql.end();
  }
}
