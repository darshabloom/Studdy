import { and, eq, exists, inArray, isNotNull, isNull, lte, ne, not, or } from 'drizzle-orm';
import {
  acceptanceHoldExpiry,
  assignPositions,
  calculateDeadlines,
  offeredSubset,
  validateFanOut,
  OPEN_ILR_STATUSES,
  type FanOutTarget,
  type IlrStatus,
  type RequestRules,
} from '@studdy/domain/bookings';
import {
  DEFAULT_MINIMUM_GAP_MINUTES,
  zonedClockTime,
  zonedDateOnly,
} from '@studdy/domain/availability';
import { paymentWindowFor, paymentWindowRefusalMessage } from '@studdy/domain/payments';
import { createDatabaseClient } from '../client';
import { formatsForCode } from './services';
import {
  auditEvents,
  domainEvents,
  intendedLessonRequests,
  outboxEntries,
  payments,
  requestTimeOptions,
  tutorRequestTimeOptions,
  services,
  serviceVersions,
  statusTransitions,
  studentProfiles,
  studentSubjectSections,
  tutorProfiles,
  tutorRequests,
  tutorTimeReservations,
} from '../schema/index';
import { bookableSlotsForTutors } from './availability';
import { loadPaymentWindowRules, loadRequestRules } from './rule-settings';

/**
 * Payment statuses that make a request untouchable by the expiry sweep.
 *
 * `succeeded` is obvious. `processing` is the one that matters: it is the state
 * a payment sits in between the parent confirming and Stripe's webhook landing,
 * which is precisely the moment a one-minute sweep would otherwise close the
 * booking out from under them.
 *
 * The terminal statuses are deliberately absent — a `failed`, `cancelled` or
 * `expired` payment must not protect a request from expiring, or an abandoned
 * attempt would hold a tutor's calendar open forever.
 */
const PAYMENT_IN_FLIGHT_STATUSES = ['processing', 'succeeded'] as const;

/**
 * Commands for the Intended Lesson Request slice.
 *
 * Accept/decline, selection close-out, Booking creation and anything Stripe or
 * ledger are deliberately NOT here — they belong to later slices.
 */

/**
 * Tutors grouped by their own lesson length, so availability is derived once
 * per distinct duration rather than once per tutor.
 */
function groupByDuration(
  targets: readonly FanOutTarget[],
  durationByTutor: ReadonlyMap<string, number>,
): ReadonlyMap<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const target of targets) {
    const duration = durationByTutor.get(target.tutorProfileId) ?? 60;
    const existing = groups.get(duration);
    if (existing === undefined) groups.set(duration, [target.tutorProfileId]);
    else existing.push(target.tutorProfileId);
  }
  return groups;
}

/** Postgres SQLSTATEs surfaced by the guarantees this slice relies on. */
const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';

/**
 * SQLSTATEs meaning "this write lost a race with a concurrent one".
 *
 * The exclusion constraint is the usual way an acceptance loses the calendar,
 * but under real concurrency the same collision can surface as a serialization
 * failure or a deadlock instead — Postgres decides which, and the choice is not
 * ours. All three mean the same thing to the tutor: the time went while they
 * were taking it. Treating only 23P01 as a lost race left the other two
 * escaping as a raw "Failed query" error, which is both a worse message and a
 * flaky test.
 */
const LOST_RACE_SQLSTATES = new Set([
  EXCLUSION_VIOLATION,
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '55P03', // lock_not_available
]);

/** A five-character SQLSTATE: two digits then three alphanumerics. */
const SQLSTATE = /^\d{2}[0-9A-Z]{3}$/;

/**
 * Drizzle wraps driver errors, so the SQLSTATE sits on the cause chain.
 *
 * The wrapper carries a `code` of its own, so taking the first `code` found
 * returns drizzle's rather than Postgres's and the real SQLSTATE is never
 * seen — which turned a clean "that time has gone" into an unhandled query
 * error. Walk the whole chain and take the first value actually shaped like a
 * SQLSTATE.
 */
function postgresErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null && current !== undefined; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && SQLSTATE.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export class SlotUnavailableError extends Error {
  override name = 'SlotUnavailableError';
  constructor(readonly tutorProfileId: string | null) {
    super('A selected tutor is no longer free at that time.');
  }
}

export class RequestValidationError extends Error {
  override name = 'RequestValidationError';
  constructor(readonly issues: Record<string, string>) {
    super('Request validation failed');
  }
}

/**
 * A subject section that does not exist yet, to be created as part of sending.
 *
 * THE SECTION IS A CONSEQUENCE OF A SENT REQUEST, NOT OF PRESSING SEND. The
 * booking journey lets a family pick a child and a subject they have never
 * recorded before, and creating the section while they browsed would litter a
 * student's profile with subjects they only looked at. Creating it in a
 * separate write just before this one is no better: the request can still fail
 * — availability moves, a hold collides — and the section would survive a
 * request that was never sent.
 *
 * So the caller passes the draft instead of an id, and the find-or-create runs
 * inside the same transaction as the request itself. Either both exist or
 * neither does.
 */
export interface SubjectSectionDraft {
  readonly studentProfileId: string;
  readonly subjectId: string;
  readonly schoolYearCode: string | null;
  readonly formatPreferenceCode: string;
}

export interface CreateIntendedLessonRequestInput {
  /**
   * An existing section. Mutually exclusive with `subjectSectionDraft`, and the
   * path the multi-tutor shortlist journey still takes, because there a section
   * necessarily already exists — it is what the shortlist hangs from.
   */
  readonly studentSubjectSectionId?: string;
  /** A section to find-or-create atomically with the request. */
  readonly subjectSectionDraft?: SubjectSectionDraft;
  readonly requestedByUserId: string;
  readonly familyAccountId: string | null;
  /**
   * Tutor profile ids only. The priced service version is resolved
   * SERVER-SIDE from the subject section, so a crafted form cannot pin one
   * tutor to another tutor's cheaper price.
   */
  readonly tutorProfileIds: readonly string[];
  /**
   * The exact priced version the family chose, per tutor.
   *
   * Optional: omitted, each tutor's single current version is used, which is
   * what the shortlist journey does. Supplied, it is VALIDATED against the
   * tutor and the subject before it is used — a version id from the browser is
   * an amount of money, and pinning one tutor to another's cheaper version, or
   * to a version of a different subject, must be impossible rather than
   * unlikely.
   */
  readonly serviceVersionIdByTutor?: ReadonlyMap<string, string>;
  /**
   * The times the family would accept, as start instants (D-3). Each tutor is
   * offered only the subset they can actually do; a tutor who can do none is
   * not sent a request at all.
   */
  readonly proposedStarts: readonly Date[];
  /**
   * The single lesson length this request is for, when the caller is asserting
   * one.
   *
   * ONE REQUEST MEANS ONE LESSON. A chosen start has to mean the same interval
   * for every tutor who receives it — otherwise whichever tutor accepted, the
   * family would have agreed to something they were never shown. Supplied, every
   * resolved version must match it or the request is refused outright rather
   * than reconciled.
   *
   * Optional only because the single-tutor journey has exactly one tutor and so
   * cannot disagree with itself.
   */
  readonly requestedDurationMinutes?: number;
  readonly formatCode: string;
  readonly timeZone: string;
  readonly notesForTutors: string | null;
  readonly hasPaymentMethodOnFile: boolean;
  readonly paymentExemptionCode: string | null;
  readonly correlationId: string;
  /** Test seam so deadline maths is deterministic. */
  readonly now?: Date;
}

export interface CreatedIntendedLessonRequest {
  readonly intendedLessonRequestId: string;
  readonly reference: string;
  /** The section the request hangs from, existing or newly created. */
  readonly studentSubjectSectionId: string;
  /** True when this send is what put the subject on the student's profile. */
  readonly subjectSectionCreated: boolean;
  readonly tutorRequestReferences: readonly string[];
  /**
   * Tutors who could do none of the chosen times and were therefore not asked
   * (D-2). The caller surfaces this so the family learns it before sending
   * rather than discovering a silent omission afterwards.
   */
  readonly notAskedTutorProfileIds: readonly string[];
}

/** No tutor could do any of the chosen times, so nothing was sent. */
export class NoTutorAvailableError extends Error {
  override name = 'NoTutorAvailableError';
  constructor() {
    super('None of the chosen tutors are free at any of those times.');
  }
}

/**
 * Create an Intended Lesson Request and fan it out to the chosen tutors.
 *
 * ALL-OR-NOTHING (approved decision 8). The ILR, every Tutor Request, every
 * calendar hold, the audit event, the status transitions, the domain event and
 * the outbox entries are written in ONE transaction. If any tutor's slot is
 * already held, the GiST exclusion constraint raises 23P01 and the whole
 * transaction rolls back — no partial fan-out is possible, and the caller
 * learns which tutor caused it.
 */
export async function createIntendedLessonRequest(
  input: CreateIntendedLessonRequestInput,
): Promise<CreatedIntendedLessonRequest> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const { rules, deadlineRuleVersion } = await loadRequestRules(db);

    if (
      (input.studentSubjectSectionId === undefined) ===
      (input.subjectSectionDraft === undefined)
    ) {
      throw new RequestValidationError({
        targets: 'A request needs exactly one subject to hang from.',
      });
    }

    /**
     * The subject everything else is resolved against.
     *
     * Read from the section where one exists; taken from the draft where it
     * does not. NOTHING IS WRITTEN HERE — every check below is a read, so a
     * request that fails validation leaves no trace at all, and the only write
     * path runs inside the transaction further down.
     */
    let subjectId: string;
    if (input.subjectSectionDraft !== undefined) {
      subjectId = input.subjectSectionDraft.subjectId;
    } else {
      const [sectionRow] = await db
        .select({ subjectId: studentSubjectSections.subjectId })
        .from(studentSubjectSections)
        .where(eq(studentSubjectSections.id, input.studentSubjectSectionId!));
      if (sectionRow === undefined) {
        throw new RequestValidationError({ targets: 'That subject is no longer available.' });
      }
      subjectId = sectionRow.subjectId;
    }

    const offerings = await db
      .select({
        tutorProfileId: services.tutorProfileId,
        serviceVersionId: serviceVersions.id,
        durationMinutes: serviceVersions.durationMinutes,
        priceAmountMinor: serviceVersions.priceAmountMinor,
        // Needed to refuse a request for a format the tutor does not deliver.
        formatCode: serviceVersions.formatCode,
        tutorFirstName: tutorProfiles.publicFirstName,
      })
      .from(serviceVersions)
      .innerJoin(services, eq(serviceVersions.serviceId, services.id))
      .innerJoin(tutorProfiles, eq(services.tutorProfileId, tutorProfiles.id))
      .where(
        and(
          inArray(services.tutorProfileId, [...input.tutorProfileIds]),
          eq(services.subjectId, subjectId),
          eq(services.statusCode, 'published'),
          eq(serviceVersions.statusCode, 'current'),
        ),
      );

    /**
     * One priced version per tutor.
     *
     * A tutor may publish SEVERAL lengths for one subject, which arrive here as
     * several rows for the same tutor. Keying a map by tutor id alone silently
     * kept whichever row the database returned last — so a family choosing
     * ninety minutes could be charged for sixty, or the reverse, with nothing
     * anywhere recording that a choice had been ignored. The chosen version is
     * therefore looked up by its own id, among that tutor's rows only.
     */
    const offeringsByTutor = new Map<string, typeof offerings>();
    for (const row of offerings) {
      const existing = offeringsByTutor.get(row.tutorProfileId);
      if (existing === undefined) offeringsByTutor.set(row.tutorProfileId, [row]);
      else existing.push(row);
    }

    const versionByTutor = new Map<string, string>();
    const durationByTutor = new Map<string, number>();
    for (const tutorProfileId of input.tutorProfileIds) {
      const rows = offeringsByTutor.get(tutorProfileId) ?? [];
      if (rows.length === 0) {
        throw new RequestValidationError({
          targets:
            'One of the tutors you chose no longer offers this subject. Refresh and try again.',
        });
      }

      const chosenId = input.serviceVersionIdByTutor?.get(tutorProfileId);
      // The validation that matters: a chosen id has to be one of THIS tutor's
      // rows for THIS subject. The query above already restricted to published
      // services and current versions, so membership settles every part of it
      // at once — wrong tutor, wrong subject, withdrawn version, superseded
      // version — and the family is told to start again rather than being
      // quietly given a different price.
      const chosen =
        chosenId === undefined
          ? // Unspecified: the cheapest, so an unstated choice is never the
            // most expensive one a tutor happens to offer.
            [...rows].sort((a, b) =>
              a.priceAmountMinor === b.priceAmountMinor
                ? a.durationMinutes - b.durationMinutes
                : Number(a.priceAmountMinor - b.priceAmountMinor),
            )[0]!
          : rows.find((row) => row.serviceVersionId === chosenId);
      if (chosen === undefined) {
        throw new RequestValidationError({
          targets: 'That lesson length is no longer offered. Choose again and resend.',
        });
      }

      /**
       * THE LESSON HAS TO BE THE SAME LESSON FOR EVERYONE.
       *
       * Refused rather than reconciled. The caller decides who is eligible and
       * tells the family who is left out and why; by the time it reaches here a
       * mismatch means the shortlist or the tutor's services changed underneath
       * the family, and quietly sending a 90-minute request to a tutor the
       * family chose for 60 would be worse than asking them to look again.
       */
      if (
        input.requestedDurationMinutes !== undefined &&
        chosen.durationMinutes !== input.requestedDurationMinutes
      ) {
        throw new RequestValidationError({
          targets: 'One of these tutors no longer offers that lesson length. Check and resend.',
        });
      }

      /**
       * AND IT HAS TO BE DELIVERABLE THE WAY THEY ASKED.
       *
       * Nothing above this checked it: the offerings query restricts to
       * published, current versions of the right subject, and `validateFanOut`
       * only checks the format is one of the two concrete values. So without
       * this an online-only tutor could be sent an in-person request — a lesson
       * they cannot teach, discovered by them rather than by us.
       */
      if (!formatsForCode(chosen.formatCode).some((format) => format === input.formatCode)) {
        throw new RequestValidationError({
          targets: 'One of these tutors does not teach this lesson that way. Check and resend.',
        });
      }

      versionByTutor.set(tutorProfileId, chosen.serviceVersionId);
      durationByTutor.set(tutorProfileId, chosen.durationMinutes);
    }

    const targets: FanOutTarget[] = input.tutorProfileIds.map((tutorProfileId) => ({
      tutorProfileId,
      serviceVersionId: versionByTutor.get(tutorProfileId)!,
    }));

    /**
     * ONE REQUEST IS ONE LESSON, AND THIS IS WHERE THAT BECOMES TRUE.
     *
     * Unconditional, and deliberately not dependent on the caller having
     * asserted `requestedDurationMinutes`: a mixed set is refused however it
     * arrives. It used to be RECONCILED here — the longest length won, on the
     * reasoning that a family should plan for the longest lesson they might get
     * — and that is exactly the behaviour this now forbids. A chosen start has
     * to mean the same interval for every tutor asked about it; otherwise
     * whichever tutor accepted, the family agreed to something they were never
     * shown, and no record anywhere would say which lesson they thought they
     * were asking for.
     *
     * The caller decides eligibility and tells the family who is left out and
     * why. Reaching here with a mix means the shortlist or a tutor's published
     * services changed underneath them, which is a reason to look again rather
     * than something to average.
     */
    const distinctDurations = new Set(durationByTutor.values());
    if (distinctDurations.size > 1) {
      throw new RequestValidationError({
        targets:
          'These tutors do not all offer the same lesson length. Choose a length and try again.',
      });
    }

    /**
     * Safe only because of the guard directly above: the set is now provably a
     * single value, so this reads it rather than choosing between candidates.
     * `groupByDuration` below likewise yields exactly one group.
     */
    const familyDurationMinutes = Math.max(
      ...targets.map((target) => durationByTutor.get(target.tutorProfileId) ?? 60),
    );

    const validation = validateFanOut(
      rules,
      {
        targets,
        proposedStarts: input.proposedStarts,
        durationMinutes: familyDurationMinutes,
        formatCode: input.formatCode,
        hasPaymentMethodOnFile: input.hasPaymentMethodOnFile,
        paymentExemptionCode: input.paymentExemptionCode,
      },
      now,
    );
    if (!validation.ok) {
      throw new RequestValidationError(
        (validation.error.details?.['issues'] ?? {}) as Record<string, string>,
      );
    }

    // Work out, against live availability, which of the chosen times each tutor
    // can actually do.
    //
    // Every offered time is checked, not just one: a tutor may accept any of
    // them, so each has to be a time they were genuinely free for. This is also
    // what stops the request path being an availability oracle — a tutor is
    // only ever asked about times they could accept, so a later "no longer
    // available" cannot be read as "we asked about a time you never offered".
    //
    // `stepMinutes: 1` aligns the grid to the proposed start rather than the
    // 30-minute grid a family is shown, so this asks "is this lesson inside the
    // tutor's open time" rather than "does it sit on our display grid": a tutor
    // free 16:00–19:00 genuinely is free at 17:15.
    const bookableStartsByTutor = new Map<string, Date[]>();
    for (const startAt of validation.value.proposedStarts) {
      for (const [durationMinutes, group] of groupByDuration(targets, durationByTutor)) {
        const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);
        const bookable = await bookableSlotsForTutors({
          tutorProfileIds: group,
          from: startAt,
          to: endAt,
          durationMinutes,
          stepMinutes: 1,
          now,
        });
        for (const tutorProfileId of group) {
          const canDoIt = (bookable.get(tutorProfileId) ?? []).some(
            (slot) => slot.startAt.getTime() === startAt.getTime(),
          );
          if (!canDoIt) continue;
          const existing = bookableStartsByTutor.get(tutorProfileId);
          if (existing === undefined) bookableStartsByTutor.set(tutorProfileId, [startAt]);
          else existing.push(startAt);
        }
      }
    }

    // A tutor who can do none of the chosen times is not asked at all (D-2).
    // An unanswerable request is worse than no request: the tutor can only
    // decline, and the family waits out a deadline for an answer that was
    // never possible.
    const offeredByTutor = new Map<string, readonly Date[]>();
    const notAskedTutorProfileIds: string[] = [];
    for (const target of targets) {
      const subset = offeredSubset(
        validation.value.proposedStarts,
        bookableStartsByTutor.get(target.tutorProfileId) ?? [],
      );
      if (subset.length === 0) notAskedTutorProfileIds.push(target.tutorProfileId);
      else offeredByTutor.set(target.tutorProfileId, subset);
    }
    if (offeredByTutor.size === 0) throw new NoTutorAvailableError();

    const askedTargets = targets.filter((target) => offeredByTutor.has(target.tutorProfileId));

    // The family's own deadline runs from the soonest time they offered.
    const earliestStart = validation.value.proposedStarts[0]!;
    const familyDeadlines = calculateDeadlines(rules, earliestStart, now);

    // Each tutor's response window runs from the soonest time THEY were
    // offered — never the family's earliest.
    //
    // A shared deadline leaks the set the tutor cannot see. The window is
    // clamped to `earliest − minimum notice`, so a tutor offered only Saturday
    // but shown a deadline of 2pm today learns both that an earlier option
    // exists and, by adding the notice back, exactly when it is. The response
    // tiers leak the same thing more coarsely. Deriving from the tutor's own
    // subset is also what D-8 means by "how far ahead the lesson is": for a
    // tutor, that is the lesson they could actually accept.
    const deadlinesByTutor = new Map<string, ReturnType<typeof calculateDeadlines>>();
    for (const target of askedTargets) {
      const ownEarliest = offeredByTutor.get(target.tutorProfileId)![0]!;
      deadlinesByTutor.set(target.tutorProfileId, calculateDeadlines(rules, ownEarliest, now));
    }

    const positioned = assignPositions(askedTargets);

    return await db.transaction(async (tx) => {
      /**
       * The subject section, found or created INSIDE this transaction.
       *
       * This is the whole point of taking a draft rather than an id. Everything
       * above was a read, and everything below either commits with this insert
       * or rolls back with it — including the calendar holds, whose exclusion
       * constraint is the one thing most likely to fail here. A family whose
       * send loses a race for a slot gets an error and an unchanged child, not
       * a subject they never agreed to study.
       *
       * `student_subject_sections_live_unique_idx` makes the find-or-create
       * safe under concurrency without a lock: two simultaneous sends cannot
       * both insert, and the loser reads the winner's row rather than failing.
       */
      let studentSubjectSectionId: string;
      let subjectSectionCreated = false;
      const draft = input.subjectSectionDraft;
      if (draft === undefined) {
        studentSubjectSectionId = input.studentSubjectSectionId!;
      } else {
        const [existing] = await tx
          .select({ id: studentSubjectSections.id })
          .from(studentSubjectSections)
          .where(
            and(
              eq(studentSubjectSections.studentProfileId, draft.studentProfileId),
              eq(studentSubjectSections.subjectId, draft.subjectId),
              eq(studentSubjectSections.statusCode, 'active'),
            ),
          );
        if (existing !== undefined) {
          studentSubjectSectionId = existing.id;
        } else {
          const [inserted] = await tx
            .insert(studentSubjectSections)
            .values({
              studentProfileId: draft.studentProfileId,
              subjectId: draft.subjectId,
              schoolYearCode: draft.schoolYearCode,
              formatPreferenceCode: draft.formatPreferenceCode,
              goals: null,
              createdByUserId: input.requestedByUserId,
              updatedByUserId: input.requestedByUserId,
            })
            // A concurrent send that got there first wins the unique index; we
            // take their row rather than failing a request that is otherwise
            // perfectly valid.
            .onConflictDoNothing()
            .returning({ id: studentSubjectSections.id });
          if (inserted === undefined) {
            const [raced] = await tx
              .select({ id: studentSubjectSections.id })
              .from(studentSubjectSections)
              .where(
                and(
                  eq(studentSubjectSections.studentProfileId, draft.studentProfileId),
                  eq(studentSubjectSections.subjectId, draft.subjectId),
                  eq(studentSubjectSections.statusCode, 'active'),
                ),
              );
            if (raced === undefined) {
              throw new Error('student_subject_sections insert returned no row');
            }
            studentSubjectSectionId = raced.id;
          } else {
            studentSubjectSectionId = inserted.id;
            subjectSectionCreated = true;
          }
        }
      }

      const [ilr] = await tx
        .insert(intendedLessonRequests)
        .values({
          studentSubjectSectionId,
          requestedByUserId: input.requestedByUserId,
          familyAccountId: input.familyAccountId,
          statusCode: 'awaiting_responses',
          durationMinutes: validation.value.durationMinutes,
          formatCode: input.formatCode,
          timeZone: input.timeZone,
          notesForTutors: input.notesForTutors,
          // Snapshotted: later configuration changes never move this.
          decisionDeadlineAt: familyDeadlines.decisionDeadlineAt,
          deadlineRuleVersion,
          sentAt: now,
          createdByUserId: input.requestedByUserId,
        })
        .returning({ id: intendedLessonRequests.id, reference: intendedLessonRequests.reference });
      if (ilr === undefined) throw new Error('intended_lesson_requests insert returned no row');

      // The family's full set of acceptable times. Server-only and family-side:
      // its size alone would tell a tutor how flexible the family is.
      const optionIdByStart = new Map<number, string>();
      for (const [index, startAt] of validation.value.proposedStarts.entries()) {
        const endAt = new Date(startAt.getTime() + validation.value.durationMinutes * 60_000);
        const [option] = await tx
          .insert(requestTimeOptions)
          .values({
            intendedLessonRequestId: ilr.id,
            position: index + 1,
            startsAt: startAt,
            endsAt: endAt,
            localDate: zonedDateOnly(startAt, input.timeZone),
            localStartTime: zonedClockTime(startAt, input.timeZone),
            ianaTimeZone: input.timeZone,
            statusCode: 'offered',
          })
          .returning({ id: requestTimeOptions.id });
        if (option === undefined) throw new Error('request_time_options insert returned no row');
        optionIdByStart.set(startAt.getTime(), option.id);
      }

      const references: string[] = [];
      for (const target of positioned) {
        const [request] = await tx
          .insert(tutorRequests)
          .values({
            intendedLessonRequestId: ilr.id,
            tutorProfileId: target.tutorProfileId,
            serviceVersionId: target.serviceVersionId,
            position: target.position,
            statusCode: 'sent',
            respondByAt: deadlinesByTutor.get(target.tutorProfileId)!.respondByAt,
            deadlineRuleVersion,
            sentAt: now,
            createdByUserId: input.requestedByUserId,
          })
          .returning({ id: tutorRequests.id, reference: tutorRequests.reference });
        if (request === undefined) throw new Error('tutor_requests insert returned no row');
        references.push(request.reference);

        // This tutor's own offered subset, with their own lesson length. Times
        // are snapshotted rather than joined at read time: this row is the
        // record of what this tutor was offered, and a later change to the
        // family's options must not rewrite that history.
        const tutorDuration = durationByTutor.get(target.tutorProfileId) ?? 60;
        for (const startAt of offeredByTutor.get(target.tutorProfileId) ?? []) {
          await tx.insert(tutorRequestTimeOptions).values({
            tutorRequestId: request.id,
            requestTimeOptionId: optionIdByStart.get(startAt.getTime())!,
            startsAt: startAt,
            endsAt: new Date(startAt.getTime() + tutorDuration * 60_000),
            statusCode: 'offered',
          });
        }

        // NO calendar hold here. A request is a question, and holding three
        // tutors' calendars on speculation took real bookable time from people
        // who had not agreed to anything (D-1). The hold is taken at
        // acceptance, by the tutor who actually said yes.

        await tx.insert(statusTransitions).values({
          entityType: 'tutor_request',
          entityId: request.id,
          fromStatusCode: null,
          toStatusCode: 'sent',
          actorUserId: input.requestedByUserId,
          reasonCode: 'request_sent',
          correlationId: input.correlationId,
          occurredAt: now,
        });

        // One outbox entry per tutor. The payload deliberately carries only
        // this tutor's reference — nothing about siblings.
        await tx.insert(outboxEntries).values({
          eventType: 'tutor_request.sent',
          payload: {
            tutorRequestReference: request.reference,
            respondByAt: deadlinesByTutor.get(target.tutorProfileId)!.respondByAt,
          },
          idempotencyKey: `tutor_request.sent:${request.id}`,
          correlationId: input.correlationId,
        });
      }

      await tx.insert(statusTransitions).values({
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        fromStatusCode: null,
        toStatusCode: 'awaiting_responses',
        actorUserId: input.requestedByUserId,
        reasonCode: 'request_sent',
        correlationId: input.correlationId,
        occurredAt: now,
      });

      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'intended_lesson_request.created',
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        actorUserId: input.requestedByUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: {
          tutorCount: positioned.length,
          timeOptionCount: validation.value.proposedStarts.length,
          earliestStartAt: earliestStart,
        },
        riskLevel: 'low',
      });

      await tx.insert(domainEvents).values({
        eventType: 'intended_lesson_request.sent',
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        payload: { reference: ilr.reference, tutorCount: positioned.length },
        correlationId: input.correlationId,
        occurredAt: now,
      });

      return {
        intendedLessonRequestId: ilr.id,
        reference: ilr.reference,
        studentSubjectSectionId,
        subjectSectionCreated,
        tutorRequestReferences: references,
        notAskedTutorProfileIds,
      };
    });
  } catch (error) {
    const code = postgresErrorCode(error);
    if (code === EXCLUSION_VIOLATION) {
      // A tutor's slot was taken between validation and the write. Nothing was
      // written: the whole transaction rolled back.
      throw new SlotUnavailableError(null);
    }
    if (code === UNIQUE_VIOLATION) {
      throw new RequestValidationError({
        targets: 'That request has already been sent. Refresh to see its current state.',
      });
    }
    throw error;
  } finally {
    await sql.end();
  }
}

/** Release every active hold attached to the given tutor requests. */
async function releaseHoldsFor(
  tx: Parameters<Parameters<ReturnType<typeof createDatabaseClient>['db']['transaction']>[0]>[0],
  tutorRequestIds: readonly string[],
  reasonCode: string,
  at: Date,
): Promise<void> {
  if (tutorRequestIds.length === 0) return;
  await tx
    .update(tutorTimeReservations)
    .set({
      statusCode: 'released',
      releasedAt: at,
      releaseReasonCode: reasonCode,
      updatedAt: at,
    })
    .where(
      and(
        inArray(tutorTimeReservations.tutorRequestId, [...tutorRequestIds]),
        eq(tutorTimeReservations.statusCode, 'active'),
      ),
    );
}

export interface WithdrawInput {
  readonly intendedLessonRequestId: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  /** Withdraw a single tutor request; omit to withdraw the whole request. */
  readonly tutorRequestId?: string;
  readonly now?: Date;
}

/**
 * Withdraw one tutor request, or the whole intended lesson request.
 *
 * Idempotent: the status-guarded UPDATE simply affects no rows if the request
 * has already closed, and the command reports how many it actually changed.
 */
export async function withdrawRequest(input: WithdrawInput): Promise<{ withdrawnCount: number }> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      // Lock the ILR so a concurrent withdrawal or expiry serialises behind us.
      const [ilr] = await tx
        .select({ id: intendedLessonRequests.id, statusCode: intendedLessonRequests.statusCode })
        .from(intendedLessonRequests)
        .where(eq(intendedLessonRequests.id, input.intendedLessonRequestId))
        .for('update');
      if (ilr === undefined) return { withdrawnCount: 0 };

      // The ILR must still be open to responses or selection.
      //
      // Without this, a withdrawal racing a selection half-applies: it locks
      // the ILR before selection touches it, reads `ready_for_selection`, then
      // blocks on the winner's row. Selection commits, and the withdrawal
      // resumes to find the winner `selected` — still inside its withdrawable
      // set — closes it and releases its hold, while its own ILR guard
      // (`awaiting_responses`/`ready_for_selection`) matches nothing. The
      // result was an ILR stuck in `awaiting_payment` with no chosen tutor and
      // no held time. Re-reading the locked status closes that window.
      if (!OPEN_ILR_STATUSES.includes(ilr.statusCode as IlrStatus)) {
        return { withdrawnCount: 0 };
      }

      const targetFilter =
        input.tutorRequestId === undefined
          ? eq(tutorRequests.intendedLessonRequestId, input.intendedLessonRequestId)
          : and(
              eq(tutorRequests.intendedLessonRequestId, input.intendedLessonRequestId),
              eq(tutorRequests.id, input.tutorRequestId),
            );

      const liveBefore = await tx
        .select({ id: tutorRequests.id, statusCode: tutorRequests.statusCode })
        .from(tutorRequests)
        .where(
          and(targetFilter, inArray(tutorRequests.statusCode, ['sent', 'accepted', 'selected'])),
        );
      const statusBefore = new Map(liveBefore.map((row) => [row.id, row.statusCode]));

      const withdrawn = await tx
        .update(tutorRequests)
        .set({
          statusCode: 'closed',
          closedAt: now,
          closeReasonCode: 'requester_withdrew',
          updatedByUserId: input.actorUserId,
          updatedAt: now,
        })
        .where(
          and(targetFilter, inArray(tutorRequests.statusCode, ['sent', 'accepted', 'selected'])),
        )
        .returning({ id: tutorRequests.id });

      await releaseHoldsFor(
        tx,
        withdrawn.map((row) => row.id),
        'requester_withdrew',
        now,
      );

      for (const row of withdrawn) {
        await tx.insert(statusTransitions).values({
          entityType: 'tutor_request',
          entityId: row.id,
          fromStatusCode: statusBefore.get(row.id) ?? 'sent',
          toStatusCode: 'closed',
          actorUserId: input.actorUserId,
          reasonCode: 'requester_withdrew',
          correlationId: input.correlationId,
          occurredAt: now,
        });
        // Undifferentiated closure notice: no reason, no mention of others.
        await tx.insert(outboxEntries).values({
          eventType: 'tutor_request.closed',
          payload: { tutorRequestId: row.id },
          idempotencyKey: `tutor_request.closed:${row.id}`,
          correlationId: input.correlationId,
        });
      }

      // Close the ILR when nothing live remains.
      const remaining = await tx
        .select({ id: tutorRequests.id })
        .from(tutorRequests)
        .where(
          and(
            eq(tutorRequests.intendedLessonRequestId, input.intendedLessonRequestId),
            inArray(tutorRequests.statusCode, ['sent', 'accepted', 'selected']),
          ),
        );

      if (remaining.length === 0) {
        const closed = await tx
          .update(intendedLessonRequests)
          .set({
            statusCode: 'closed',
            closedAt: now,
            closeReasonCode: 'requester_withdrew',
            updatedByUserId: input.actorUserId,
            updatedAt: now,
          })
          .where(
            and(
              eq(intendedLessonRequests.id, input.intendedLessonRequestId),
              inArray(intendedLessonRequests.statusCode, [
                'awaiting_responses',
                'ready_for_selection',
              ]),
            ),
          )
          .returning({ id: intendedLessonRequests.id });

        for (const row of closed) {
          await tx.insert(statusTransitions).values({
            entityType: 'intended_lesson_request',
            entityId: row.id,
            fromStatusCode: ilr.statusCode,
            toStatusCode: 'closed',
            actorUserId: input.actorUserId,
            reasonCode: 'requester_withdrew',
            correlationId: input.correlationId,
            occurredAt: now,
          });
          await tx.insert(auditEvents).values({
            category: 'business',
            action: 'intended_lesson_request.withdrawn',
            entityType: 'intended_lesson_request',
            entityId: row.id,
            actorUserId: input.actorUserId,
            correlationId: input.correlationId,
            occurredAt: now,
            riskLevel: 'low',
          });
        }
      }

      return { withdrawnCount: withdrawn.length };
    });
  } finally {
    await sql.end();
  }
}

export interface ExpireRequestsResult {
  readonly expiredTutorRequests: number;
  readonly closedIntendedLessonRequests: number;
  readonly releasedHolds: number;
}

/**
 * Expire overdue tutor requests and close intended lesson requests that have
 * nothing live left, releasing every unused hold.
 *
 * Independent of any scheduler: Vercel Cron invokes it today and Inngest can
 * invoke the same function later without touching this logic. Idempotent and
 * batched — every UPDATE is status-guarded, so a re-run or an overlapping run
 * simply affects no rows.
 */
export async function expireOverdueRequests(options: {
  readonly correlationId: string;
  readonly batchSize?: number;
  readonly now?: Date;
}): Promise<ExpireRequestsResult> {
  const { sql, db } = createDatabaseClient();
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 200;
  try {
    return await db.transaction(async (tx) => {
      const due = await tx
        .select({ id: tutorRequests.id, ilrId: tutorRequests.intendedLessonRequestId })
        .from(tutorRequests)
        .where(and(eq(tutorRequests.statusCode, 'sent'), lte(tutorRequests.respondByAt, now)))
        .limit(batchSize)
        .for('update', { skipLocked: true });

      const dueIds = due.map((row) => row.id);
      let releasedHolds = 0;

      if (dueIds.length > 0) {
        const expired = await tx
          .update(tutorRequests)
          .set({
            statusCode: 'expired',
            closedAt: now,
            closeReasonCode: 'request_expired',
            updatedAt: now,
          })
          .where(and(inArray(tutorRequests.id, dueIds), eq(tutorRequests.statusCode, 'sent')))
          .returning({ id: tutorRequests.id });

        const released = await tx
          .update(tutorTimeReservations)
          .set({
            statusCode: 'released',
            releasedAt: now,
            releaseReasonCode: 'request_expired',
            updatedAt: now,
          })
          .where(
            and(
              inArray(
                tutorTimeReservations.tutorRequestId,
                expired.map((row) => row.id),
              ),
              eq(tutorTimeReservations.statusCode, 'active'),
            ),
          )
          .returning({ id: tutorTimeReservations.id });
        releasedHolds = released.length;

        for (const row of expired) {
          await tx.insert(statusTransitions).values({
            entityType: 'tutor_request',
            entityId: row.id,
            fromStatusCode: 'sent',
            toStatusCode: 'expired',
            actorUserId: null,
            reasonCode: 'request_expired',
            correlationId: options.correlationId,
            occurredAt: now,
          });
          await tx.insert(outboxEntries).values({
            eventType: 'tutor_request.closed',
            payload: { tutorRequestId: row.id },
            idempotencyKey: `tutor_request.closed:${row.id}`,
            correlationId: options.correlationId,
          });
        }
      }

      // An acceptance whose selection hold has lapsed (design §8.2). The
      // family did not choose in time, so the tutor's calendar is given back
      // rather than held on the chance a decision arrives later — retaining it
      // would cost them real bookable time to protect nothing.
      const lapsedAcceptances = await tx
        .update(tutorRequests)
        .set({
          statusCode: 'closed',
          closedAt: now,
          closeReasonCode: 'selection_window_lapsed',
          updatedAt: now,
        })
        .where(
          and(
            eq(tutorRequests.statusCode, 'accepted'),
            lte(tutorRequests.acceptanceHoldExpiresAt, now),
          ),
        )
        .returning({ id: tutorRequests.id, ilrId: tutorRequests.intendedLessonRequestId });

      if (lapsedAcceptances.length > 0) {
        const releasedLapsed = await tx
          .update(tutorTimeReservations)
          .set({
            statusCode: 'released',
            releasedAt: now,
            releaseReasonCode: 'selection_window_lapsed',
            updatedAt: now,
          })
          .where(
            and(
              inArray(
                tutorTimeReservations.tutorRequestId,
                lapsedAcceptances.map((row) => row.id),
              ),
              eq(tutorTimeReservations.statusCode, 'active'),
            ),
          )
          .returning({ id: tutorTimeReservations.id });
        releasedHolds += releasedLapsed.length;

        for (const row of lapsedAcceptances) {
          await tx.insert(statusTransitions).values({
            entityType: 'tutor_request',
            entityId: row.id,
            fromStatusCode: 'accepted',
            toStatusCode: 'closed',
            actorUserId: null,
            reasonCode: 'selection_window_lapsed',
            correlationId: options.correlationId,
            occurredAt: now,
          });
          // Same neutral event as every other closure: nothing in it says the
          // family ran out of time rather than choosing someone else.
          await tx.insert(outboxEntries).values({
            eventType: 'tutor_request.closed',
            payload: { tutorRequestId: row.id },
            idempotencyKey: `tutor_request.closed:${row.id}`,
            correlationId: options.correlationId,
          });
        }
      }

      /*
       * A SELECTED request whose PAYMENT WINDOW has run out.
       *
       * The deadline is `payment_deadline_at`, snapshotted at selection. Rows
       * selected before the payment window existed have none, and fall back to
       * `acceptance_hold_expires_at` — exactly the behaviour they have today,
       * so this change cannot alter what happens to work already in flight.
       *
       * THE ILR GUARD IS LOAD-BEARING, AND IT IS WHY THE TUTOR REQUEST STATE
       * MACHINE DOES NOT NEED A NEW STATE. A paid booking leaves its winning
       * request `selected` forever, so status alone cannot distinguish "waiting
       * to be paid for" from "paid for and confirmed" — and without this guard
       * the next sweep would close a booking somebody had paid for. The ILR
       * already records which it is: `awaiting_payment` while the window runs,
       * `fulfilled` once payment succeeds. Reading it here is both the narrower
       * change and the more honest one, because the ILR is where that fact
       * genuinely lives.
       *
       * THE IN-FLIGHT PAYMENT GUARD, implemented in slice 5 alongside the rows
       * it protects.
       *
       * A payment that is `processing` or `succeeded` must not have its request
       * lapsed out from under it. The window between a parent confirming a card
       * and Stripe's webhook arriving is small, and it is exactly the window a
       * one-minute sweep lands in: without this, a family could pay and watch
       * the booking evaporate a few seconds later, with the money taken and the
       * tutor's time given back.
       *
       * IT IS A SEPARATE GUARD FROM THE ILR CHECK, not a duplicate of it. The
       * ILR only reaches `fulfilled` when the webhook applies (slice 6), so
       * between confirmation and webhook the ILR still says `awaiting_payment`
       * and the ILR guard alone would let the sweep through. This one reads the
       * payment.
       *
       * Written as a correlated EXISTS rather than a join, so a request with two
       * historical payment rows cannot produce duplicate result rows — and so
       * the terminal statuses (`failed`, `cancelled`, `expired`) are simply
       * outside the set, which is what keeps a genuinely abandoned payment
       * expiring normally.
       *
       * Leaving an expired hold `active` would be worse than closing it: §12
       * forbids retaining a hold beyond its expiry, the tutor's own screen
       * promises it is released when it expires, and an expired-but-active row
       * keeps blocking that slot for every other family, because availability
       * filters on status rather than on time.
       */
      const overdueSelections = await tx
        .select({ id: tutorRequests.id, ilrId: tutorRequests.intendedLessonRequestId })
        .from(tutorRequests)
        .innerJoin(
          intendedLessonRequests,
          eq(tutorRequests.intendedLessonRequestId, intendedLessonRequests.id),
        )
        .where(
          and(
            eq(tutorRequests.statusCode, 'selected'),
            /*
             * The payment deadline where there is one, the acceptance hold
             * where there is not.
             *
             * Written as two guarded branches rather than a `coalesce`
             * fragment: passing `now` into a raw SQL template hands the driver
             * a Date it cannot bind, which fails at RUNTIME while typechecking
             * perfectly. The operator form is also the one the rest of this
             * file reads in.
             *
             * A row selected before the payment window existed has no deadline
             * and must keep behaving exactly as it does today.
             */
            or(
              and(
                isNotNull(tutorRequests.paymentDeadlineAt),
                lte(tutorRequests.paymentDeadlineAt, now),
              ),
              and(
                isNull(tutorRequests.paymentDeadlineAt),
                lte(tutorRequests.acceptanceHoldExpiresAt, now),
              ),
            ),
            // Never a confirmed booking. `fulfilled` means somebody paid.
            eq(intendedLessonRequests.statusCode, 'awaiting_payment'),
            // Never a payment in flight. See the note above.
            not(
              exists(
                tx
                  // A column rather than a literal: the enclosing function
                  // destructures its own `sql` from the client, which shadows
                  // drizzle's template tag.
                  .select({ one: payments.id })
                  .from(payments)
                  .where(
                    and(
                      eq(payments.tutorRequestId, tutorRequests.id),
                      inArray(payments.statusCode, PAYMENT_IN_FLIGHT_STATUSES),
                    ),
                  ),
              ),
            ),
          ),
        )
        .limit(batchSize);

      const overdueIds = overdueSelections.map((row) => row.id);
      const lapsedSelections =
        overdueIds.length === 0
          ? []
          : await tx
              .update(tutorRequests)
              .set({
                statusCode: 'closed',
                closedAt: now,
                closeReasonCode: 'payment_window_lapsed',
                updatedAt: now,
              })
              .where(
                and(
                  inArray(tutorRequests.id, overdueIds),
                  // Re-guarded rather than trusted: the select above is not a
                  // lock, so a concurrent selection or fulfilment between the
                  // two statements must lose here rather than be overwritten.
                  eq(tutorRequests.statusCode, 'selected'),
                ),
              )
              .returning({ id: tutorRequests.id, ilrId: tutorRequests.intendedLessonRequestId });

      if (lapsedSelections.length > 0) {
        const releasedSelected = await tx
          .update(tutorTimeReservations)
          .set({
            statusCode: 'released',
            releasedAt: now,
            releaseReasonCode: 'payment_window_lapsed',
            updatedAt: now,
          })
          .where(
            and(
              inArray(
                tutorTimeReservations.tutorRequestId,
                lapsedSelections.map((row) => row.id),
              ),
              eq(tutorTimeReservations.statusCode, 'active'),
            ),
          )
          .returning({ id: tutorTimeReservations.id });
        releasedHolds += releasedSelected.length;

        for (const row of lapsedSelections) {
          await tx.insert(statusTransitions).values({
            entityType: 'tutor_request',
            entityId: row.id,
            fromStatusCode: 'selected',
            toStatusCode: 'closed',
            actorUserId: null,
            reasonCode: 'payment_window_lapsed',
            correlationId: options.correlationId,
            occurredAt: now,
          });
          await tx.insert(outboxEntries).values({
            eventType: 'tutor_request.closed',
            payload: { tutorRequestId: row.id },
            idempotencyKey: `tutor_request.closed:${row.id}`,
            correlationId: options.correlationId,
          });
        }

        // The ILR follows its winner: `awaiting_payment → closed`, the forward
        // path the state machine already provides.
        await tx
          .update(intendedLessonRequests)
          .set({
            statusCode: 'closed',
            closedAt: now,
            closeReasonCode: 'payment_window_lapsed',
            updatedAt: now,
          })
          .where(
            and(
              inArray(
                intendedLessonRequests.id,
                lapsedSelections.map((row) => row.ilrId),
              ),
              eq(intendedLessonRequests.statusCode, 'awaiting_payment'),
            ),
          );
      }

      // Options whose start time has passed are finished with, on both sides
      // (design §8.1). A request may thus become unanswerable before its own
      // deadline; it still expires on its own clock, so its terminal timing
      // stays driven by the tutor rather than by anyone else's activity.
      await tx
        .update(requestTimeOptions)
        .set({ statusCode: 'lapsed', updatedAt: now })
        .where(
          and(eq(requestTimeOptions.statusCode, 'offered'), lte(requestTimeOptions.startsAt, now)),
        );
      await tx
        .update(tutorRequestTimeOptions)
        .set({ statusCode: 'lapsed', updatedAt: now })
        .where(
          and(
            eq(tutorRequestTimeOptions.statusCode, 'offered'),
            lte(tutorRequestTimeOptions.startsAt, now),
          ),
        );

      // Close any ILR past its decision deadline, or with nothing live left.
      const candidateIlrIds = [
        ...new Set([...due.map((row) => row.ilrId), ...lapsedAcceptances.map((row) => row.ilrId)]),
      ];
      const overdue = await tx
        .select({ id: intendedLessonRequests.id })
        .from(intendedLessonRequests)
        .where(
          and(
            inArray(intendedLessonRequests.statusCode, [
              'awaiting_responses',
              'ready_for_selection',
            ]),
            lte(intendedLessonRequests.decisionDeadlineAt, now),
          ),
        )
        .limit(batchSize);

      const toConsider = [...new Set([...candidateIlrIds, ...overdue.map((row) => row.id)])];
      let closedCount = 0;

      for (const ilrId of toConsider) {
        const live = await tx
          .select({ id: tutorRequests.id })
          .from(tutorRequests)
          .where(
            and(
              eq(tutorRequests.intendedLessonRequestId, ilrId),
              inArray(tutorRequests.statusCode, ['sent', 'accepted', 'selected']),
            ),
          );
        const pastDeadline = overdue.some((row) => row.id === ilrId);
        if (live.length > 0 && !pastDeadline) continue;

        const closed = await tx
          .update(intendedLessonRequests)
          .set({
            statusCode: 'closed',
            closedAt: now,
            closeReasonCode: live.length === 0 ? 'all_tutors_declined' : 'request_expired',
            updatedAt: now,
          })
          .where(
            and(
              eq(intendedLessonRequests.id, ilrId),
              inArray(intendedLessonRequests.statusCode, [
                'awaiting_responses',
                'ready_for_selection',
              ]),
            ),
          )
          .returning({ id: intendedLessonRequests.id });

        for (const row of closed) {
          closedCount += 1;
          await tx.insert(statusTransitions).values({
            entityType: 'intended_lesson_request',
            entityId: row.id,
            fromStatusCode: 'awaiting_responses',
            toStatusCode: 'closed',
            actorUserId: null,
            reasonCode: 'request_expired',
            correlationId: options.correlationId,
            occurredAt: now,
          });
          await tx.insert(outboxEntries).values({
            eventType: 'intended_lesson_request.expired',
            payload: { intendedLessonRequestId: row.id },
            idempotencyKey: `intended_lesson_request.expired:${row.id}`,
            correlationId: options.correlationId,
          });
        }
      }

      return {
        expiredTutorRequests: dueIds.length,
        closedIntendedLessonRequests: closedCount,
        releasedHolds,
      };
    });
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------------------
// Tutor responses — accept and decline
// ---------------------------------------------------------------------------

/**
 * The chosen time cannot be taken.
 *
 * ONE error for every cause: the option was already claimed, the family
 * withdrew it, its start has passed, or another accepted hold now covers the
 * tutor's calendar. A tutor learns that this time is gone and nothing about
 * who or what took it — distinguishing those causes would tell them another
 * party acted, which is the whole point of the boundary.
 */
export class TimeNoLongerAvailableError extends Error {
  override name = 'TimeNoLongerAvailableError';
  constructor() {
    super('That time is no longer available.');
  }
}

/** The request is not this tutor's, or is no longer awaiting their answer. */
export class RequestNotOpenError extends Error {
  override name = 'RequestNotOpenError';
  constructor() {
    super('That request is no longer open.');
  }
}

export interface AcceptTutorRequestInput {
  /** The TREQ- reference the tutor addressed. */
  readonly reference: string;
  /** Resolved from the session — never from a URL, form field or header. */
  readonly tutorProfileId: string;
  /** Which of their offered times they are claiming. */
  readonly tutorRequestTimeOptionId: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}

export interface AcceptedTutorRequest {
  readonly startAt: Date;
  readonly endAt: Date;
  readonly holdExpiresAt: Date;
}

/**
 * Accept exactly one offered time (design §6, D-4).
 *
 * Every step is status-guarded, so a concurrent duplicate cannot double-apply,
 * and the whole thing is one transaction: a failure leaves no claimed option,
 * no status change and no reservation. The GiST exclusion constraint is the
 * final arbiter on the calendar — only the database can decide that without a
 * race — and a 23P01 rolls the lot back.
 *
 * This is where the hold is taken (D-1). Nothing was reserved at send; the
 * tutor who actually says yes is the one whose calendar is committed.
 */
export async function acceptTutorRequestTime(
  input: AcceptTutorRequestInput,
): Promise<AcceptedTutorRequest> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const { rules, deadlineRuleVersion } = await loadRequestRules(db);

    // Ownership is part of the authoritative query, not a check afterwards: a
    // reference belonging to another tutor matches zero rows and is
    // indistinguishable from one that does not exist.
    const [request] = await db
      .select({
        id: tutorRequests.id,
        intendedLessonRequestId: tutorRequests.intendedLessonRequestId,
        statusCode: tutorRequests.statusCode,
        tutorProfileId: tutorRequests.tutorProfileId,
      })
      .from(tutorRequests)
      .where(
        and(
          eq(tutorRequests.reference, input.reference),
          eq(tutorRequests.tutorProfileId, input.tutorProfileId),
        ),
      );
    if (request === undefined || request.statusCode !== 'sent') throw new RequestNotOpenError();

    return await db.transaction(async (tx) => {
      // 1. Claim exactly one still-offered option. Zero rows means it was
      //    already claimed, withdrawn or lapsed — abort.
      const [claimed] = await tx
        .update(tutorRequestTimeOptions)
        .set({ statusCode: 'claimed', claimedAt: now })
        .where(
          and(
            eq(tutorRequestTimeOptions.id, input.tutorRequestTimeOptionId),
            eq(tutorRequestTimeOptions.tutorRequestId, request.id),
            eq(tutorRequestTimeOptions.statusCode, 'offered'),
          ),
        )
        .returning({
          id: tutorRequestTimeOptions.id,
          startAt: tutorRequestTimeOptions.startsAt,
          endAt: tutorRequestTimeOptions.endsAt,
          requestTimeOptionId: tutorRequestTimeOptions.requestTimeOptionId,
        });
      if (claimed === undefined) throw new TimeNoLongerAvailableError();

      const holdExpiresAt = acceptanceHoldExpiry(rules, now, claimed.startAt);

      // 2. Move the request, only from 'sent'.
      const [moved] = await tx
        .update(tutorRequests)
        .set({
          statusCode: 'accepted',
          acceptedTimeOptionId: claimed.id,
          acceptanceHoldExpiresAt: holdExpiresAt,
          holdRuleVersion: deadlineRuleVersion,
          respondedAt: now,
          updatedByUserId: input.actorUserId,
        })
        .where(and(eq(tutorRequests.id, request.id), eq(tutorRequests.statusCode, 'sent')))
        .returning({ id: tutorRequests.id });
      if (moved === undefined) throw new RequestNotOpenError();

      /**
       * 3. Take the ONE reservation.
       *
       * The gap is read INSIDE the transaction and snapshotted onto the row,
       * with `effective_end_at` computed from it. Two things follow. The
       * exclusion constraint can compare a plain two-column range without
       * reaching the profile table — and a tutor who widens their gap later
       * does not retroactively invalidate this hold, or any lesson already
       * agreed under the old figure.
       *
       * Overlap of the EFFECTIVE ranges raises 23P01 and rolls back the whole
       * transaction, so the tutor is told the time is gone rather than ending
       * up with two lessons too close to honour.
       */
      const [gapRow] = await tx
        .select({ minimumGapMinutes: tutorProfiles.minimumGapMinutes })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.id, request.tutorProfileId));
      const gapMinutes = gapRow?.minimumGapMinutes ?? DEFAULT_MINIMUM_GAP_MINUTES;

      await tx.insert(tutorTimeReservations).values({
        tutorProfileId: request.tutorProfileId,
        tutorRequestId: request.id,
        startAt: claimed.startAt,
        endAt: claimed.endAt,
        gapMinutes,
        effectiveEndAt: new Date(claimed.endAt.getTime() + gapMinutes * 60_000),
        statusCode: 'active',
        reservationTypeCode: 'request_hold',
        expiresAt: holdExpiresAt,
      });

      // 4. Family-side bookkeeping.
      await tx
        .update(requestTimeOptions)
        .set({ statusCode: 'taken' })
        .where(eq(requestTimeOptions.id, claimed.requestTimeOptionId));
      await tx
        .update(intendedLessonRequests)
        .set({ statusCode: 'ready_for_selection' })
        .where(
          and(
            eq(intendedLessonRequests.id, request.intendedLessonRequestId),
            eq(intendedLessonRequests.statusCode, 'awaiting_responses'),
          ),
        );

      // 5. Audit, transition, domain event, outbox.
      await tx.insert(statusTransitions).values({
        entityType: 'tutor_request',
        entityId: request.id,
        fromStatusCode: 'sent',
        toStatusCode: 'accepted',
        actorUserId: input.actorUserId,
        reasonCode: 'tutor_accepted',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'tutor_request.accepted',
        entityType: 'tutor_request',
        entityId: request.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: { startAt: claimed.startAt, holdExpiresAt },
        riskLevel: 'low',
      });
      await tx.insert(domainEvents).values({
        eventType: 'tutor_request.accepted',
        entityType: 'tutor_request',
        entityId: request.id,
        payload: { startAt: claimed.startAt, holdExpiresAt },
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(outboxEntries).values({
        eventType: 'tutor_request.accepted',
        payload: { tutorRequestReference: input.reference, startAt: claimed.startAt },
        idempotencyKey: `tutor_request.accepted:${request.id}`,
        correlationId: input.correlationId,
      });

      return { startAt: claimed.startAt, endAt: claimed.endAt, holdExpiresAt };
    });
  } catch (error) {
    const code = postgresErrorCode(error);
    // The calendar was taken between the guard and the write. Same error a
    // claimed option raises: the difference carries no information.
    if (code !== null && LOST_RACE_SQLSTATES.has(code)) throw new TimeNoLongerAvailableError();
    throw error;
  } finally {
    await sql.end();
  }
}

export interface DeclineTutorRequestInput {
  readonly reference: string;
  readonly tutorProfileId: string;
  readonly actorUserId: string;
  readonly declineReasonCode?: string | null;
  readonly correlationId: string;
  readonly now?: Date;
}

/**
 * Decline a request outright.
 *
 * Declining takes no calendar time and releases nothing, because a request
 * held nothing to begin with. The reason, if given, is server-side and for the
 * platform — it is never rendered to the family as a distinguishing signal.
 */
export async function declineTutorRequest(input: DeclineTutorRequestInput): Promise<void> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const [request] = await db
      .select({ id: tutorRequests.id, statusCode: tutorRequests.statusCode })
      .from(tutorRequests)
      .where(
        and(
          eq(tutorRequests.reference, input.reference),
          eq(tutorRequests.tutorProfileId, input.tutorProfileId),
        ),
      );
    if (request === undefined || request.statusCode !== 'sent') throw new RequestNotOpenError();

    await db.transaction(async (tx) => {
      const [moved] = await tx
        .update(tutorRequests)
        .set({
          statusCode: 'declined',
          declineReasonCode: input.declineReasonCode ?? null,
          respondedAt: now,
          closedAt: now,
          updatedByUserId: input.actorUserId,
        })
        .where(and(eq(tutorRequests.id, request.id), eq(tutorRequests.statusCode, 'sent')))
        .returning({ id: tutorRequests.id });
      if (moved === undefined) throw new RequestNotOpenError();

      // The tutor's own offered rows close with the request. They are marked
      // lapsed rather than given a "declined" status of their own: the option
      // vocabulary describes availability, not the answer.
      await tx
        .update(tutorRequestTimeOptions)
        .set({ statusCode: 'lapsed' })
        .where(
          and(
            eq(tutorRequestTimeOptions.tutorRequestId, request.id),
            eq(tutorRequestTimeOptions.statusCode, 'offered'),
          ),
        );

      await tx.insert(statusTransitions).values({
        entityType: 'tutor_request',
        entityId: request.id,
        fromStatusCode: 'sent',
        toStatusCode: 'declined',
        actorUserId: input.actorUserId,
        reasonCode: input.declineReasonCode ?? 'tutor_declined',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'tutor_request.declined',
        entityType: 'tutor_request',
        entityId: request.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        riskLevel: 'low',
      });
      await tx.insert(outboxEntries).values({
        eventType: 'tutor_request.declined',
        payload: { tutorRequestReference: input.reference },
        idempotencyKey: `tutor_request.declined:${request.id}`,
        correlationId: input.correlationId,
      });
    });
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------------------
// Family selection — choosing one accepted tutor and time
// ---------------------------------------------------------------------------

/** The chosen combination is no longer selectable. */
export class SelectionNoLongerAvailableError extends Error {
  override name = 'SelectionNoLongerAvailableError';
  constructor() {
    super('That tutor and time is no longer available to choose.');
  }
}

/**
 * The chosen lesson now starts too soon to arrange payment.
 *
 * A DISTINCT error rather than another `SelectionNoLongerAvailable`, because
 * the two need different screens: the first means "pick again, this one is
 * gone", and this one means "this one is still there but the clock beat you to
 * it". Collapsing them would send a family to hunt for a time that is still
 * visibly on their list.
 *
 * Carries the required lead time so the message can quote the enforced number
 * rather than a copy of it.
 */
export class LessonTooCloseForPaymentError extends Error {
  override name = 'LessonTooCloseForPaymentError';
  constructor(readonly requiredLeadMinutes: number) {
    super(paymentWindowRefusalMessage(requiredLeadMinutes));
  }
}

export interface SelectAcceptedRequestInput {
  /** The family's LR- reference. */
  readonly reference: string;
  /** Student profiles the caller may act for, resolved from the session. */
  readonly studentProfileIds: readonly string[];
  /** The winning Tutor Request, by its TREQ- reference. */
  readonly tutorRequestReference: string;
  readonly actorUserId: string;
  readonly correlationId: string;
  readonly now?: Date;
}

export interface SelectionOutcome {
  readonly tutorFirstName: string;
  readonly startAt: Date;
  readonly closedCount: number;
  /** When payment is due. Server-authoritative; the browser invents nothing. */
  readonly paymentDeadlineAt: Date;
  /** How long the family was given, for the copy that explains the deadline. */
  readonly paymentWindowMinutes: number;
}

/**
 * Choose one accepted tutor and time, and close the rest (design §3.1 step 11, D-5).
 *
 * ONE transaction, every step status-guarded, so a double submission or two
 * guardians clicking at once cannot half-apply it. The winner keeps its
 * reservation; every competing request closes as plain `closed` with the real
 * reason server-side, and their holds are released immediately — a tutor who
 * was not chosen gets their calendar time back at once rather than waiting out
 * a hold that no longer protects anything.
 *
 * The ILR lands on `awaiting_payment`, NOT `fulfilled`. `fulfilled` is terminal
 * and means a confirmed booking; a request that nobody has paid for is not one,
 * and treating it as one would leave payment failure with nowhere to go but
 * backwards out of a terminal state.
 */
export async function selectAcceptedTutorRequest(
  input: SelectAcceptedRequestInput,
): Promise<SelectionOutcome> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    // A session with no student profiles can act on nothing. Guarding here
    // keeps it a clean refusal rather than an empty-IN driver error.
    if (input.studentProfileIds.length === 0) throw new SelectionNoLongerAvailableError();

    // Ownership is part of the authoritative query: an ILR belonging to
    // another family matches zero rows rather than being found and refused.
    const [ilr] = await db
      .select({
        id: intendedLessonRequests.id,
        statusCode: intendedLessonRequests.statusCode,
      })
      .from(intendedLessonRequests)
      .innerJoin(
        studentSubjectSections,
        eq(intendedLessonRequests.studentSubjectSectionId, studentSubjectSections.id),
      )
      .where(
        and(
          eq(intendedLessonRequests.reference, input.reference),
          inArray(studentSubjectSections.studentProfileId, [...input.studentProfileIds]),
        ),
      );
    if (ilr === undefined || ilr.statusCode !== 'ready_for_selection') {
      throw new SelectionNoLongerAvailableError();
    }

    return await db.transaction(async (tx) => {
      // 1. The winner, only from 'accepted', and only within this ILR. Zero
      //    rows means it was withdrawn, expired or never accepted — abort.
      const [winner] = await tx
        .update(tutorRequests)
        .set({ statusCode: 'selected', updatedByUserId: input.actorUserId })
        .where(
          and(
            eq(tutorRequests.reference, input.tutorRequestReference),
            eq(tutorRequests.intendedLessonRequestId, ilr.id),
            eq(tutorRequests.statusCode, 'accepted'),
          ),
        )
        .returning({
          id: tutorRequests.id,
          tutorProfileId: tutorRequests.tutorProfileId,
          acceptedTimeOptionId: tutorRequests.acceptedTimeOptionId,
        });
      if (winner === undefined) throw new SelectionNoLongerAvailableError();

      const [claimed] = await tx
        .select({ startAt: tutorRequestTimeOptions.startsAt })
        .from(tutorRequestTimeOptions)
        .where(eq(tutorRequestTimeOptions.id, winner.acceptedTimeOptionId!));
      if (claimed === undefined) throw new SelectionNoLongerAvailableError();

      /*
       * 1a. THE PAYMENT WINDOW, RE-EVALUATED AT SELECTION.
       *
       * Minimum notice was checked when the request was SENT, and selection can
       * happen hours later — a family who takes their time over a lesson that
       * was two hours away can arrive here with ninety minutes left. So the
       * near-lesson rule is applied against `now`, not inherited.
       *
       * Refusal throws, and the transaction rolls back whole: the winner's
       * `selected` update above is undone, no loser is closed, no hold is
       * released. A refused selection writes NOTHING.
       */
      const {
        rules: paymentRules,
        windowRuleVersion,
        nearLessonCutoffRuleVersion,
      } = await loadPaymentWindowRules(tx);
      const window = paymentWindowFor({
        selectedAt: now,
        lessonStartAt: claimed.startAt,
        rules: paymentRules,
      });
      if (window.kind === 'refused') {
        throw new LessonTooCloseForPaymentError(window.requiredLeadMinutes);
      }

      const [tutor] = await tx
        .select({ firstName: tutorProfiles.publicFirstName })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.id, winner.tutorProfileId));

      // 2. Every competing request closes — as `closed`, never a status that
      //    says "not selected". A distinct status would tell the tutor a
      //    competitor existed; the real reason stays server-side.
      //
      //    Their prior status is read first: an UPDATE ... RETURNING gives the
      //    new row, so recording the transition without this would log
      //    `from: null` and lose whether the tutor had accepted or was still
      //    deciding when the family chose.
      const beforeClose = await tx
        .select({ id: tutorRequests.id, statusCode: tutorRequests.statusCode })
        .from(tutorRequests)
        .where(
          and(
            eq(tutorRequests.intendedLessonRequestId, ilr.id),
            ne(tutorRequests.id, winner.id),
            inArray(tutorRequests.statusCode, ['sent', 'accepted']),
          ),
        );
      const statusBeforeClose = new Map(beforeClose.map((row) => [row.id, row.statusCode]));

      const losers = await tx
        .update(tutorRequests)
        .set({
          statusCode: 'closed',
          closeReasonCode: 'another_tutor_selected',
          closedAt: now,
          updatedByUserId: input.actorUserId,
        })
        .where(
          and(
            eq(tutorRequests.intendedLessonRequestId, ilr.id),
            ne(tutorRequests.id, winner.id),
            inArray(tutorRequests.statusCode, ['sent', 'accepted']),
          ),
        )
        .returning({ id: tutorRequests.id });

      // 3. Release the losers' holds at once. Retaining them to blur the
      //    timing of this decision would cost those tutors real bookable time
      //    to obscure an inference the guarantee does not even cover.
      if (losers.length > 0) {
        await tx
          .update(tutorTimeReservations)
          .set({ statusCode: 'released', releasedAt: now })
          .where(
            and(
              inArray(
                tutorTimeReservations.tutorRequestId,
                losers.map((row) => row.id),
              ),
              eq(tutorTimeReservations.statusCode, 'active'),
            ),
          );
      }
      /*
       * The winner's hold now runs to the PAYMENT DEADLINE.
       *
       * Usually EARLIER than the acceptance hold it replaces — an hour rather
       * than up to eight — because the family has stopped deciding and started
       * paying, and holding a tutor's calendar longer than the thing it is
       * protecting needs is exactly what §12 forbids. The tutor's screen must
       * not present the earlier expiry as a penalty; it is the point at which
       * they get their time back if nobody pays.
       *
       * Left `request_hold` and left `active`. It becomes `booking_confirmed`
       * with no expiry when a payment succeeds, which is a later slice.
       */
      await tx
        .update(tutorTimeReservations)
        .set({ expiresAt: window.deadlineAt, updatedAt: now })
        .where(
          and(
            eq(tutorTimeReservations.tutorRequestId, winner.id),
            eq(tutorTimeReservations.statusCode, 'active'),
          ),
        );

      /*
       * Snapshot the deadline, both inputs that produced it, and ONE RULE
       * VERSION PER INPUT — the same discipline the response deadline and the
       * acceptance hold already follow, but with the versions kept apart.
       *
       * `rule_settings` versions per key, so the window and the cutoff move
       * independently: a single `payment_rule_version` would be unable to say
       * which cutoff was in force when the window was last changed. Both
       * columns together make the decision reconstructable from the row alone.
       */
      await tx
        .update(tutorRequests)
        .set({
          paymentDeadlineAt: window.deadlineAt,
          paymentWindowMinutes: window.windowMinutes,
          paymentWindowRuleVersion: windowRuleVersion,
          nearLessonCutoffMinutes: window.nearLessonCutoffMinutes,
          nearLessonCutoffRuleVersion,
          updatedAt: now,
        })
        .where(eq(tutorRequests.id, winner.id));

      // 4. Any option the family offered that nobody took is finished with.
      await tx
        .update(requestTimeOptions)
        .set({ statusCode: 'withdrawn' })
        .where(
          and(
            eq(requestTimeOptions.intendedLessonRequestId, ilr.id),
            eq(requestTimeOptions.statusCode, 'offered'),
          ),
        );

      // 5. The ILR moves on to payment, only from 'ready_for_selection'.
      const [movedIlr] = await tx
        .update(intendedLessonRequests)
        .set({ statusCode: 'awaiting_payment', updatedByUserId: input.actorUserId })
        .where(
          and(
            eq(intendedLessonRequests.id, ilr.id),
            eq(intendedLessonRequests.statusCode, 'ready_for_selection'),
          ),
        )
        .returning({ id: intendedLessonRequests.id });
      if (movedIlr === undefined) throw new SelectionNoLongerAvailableError();

      // 6. Audit, transitions, events.
      await tx.insert(statusTransitions).values({
        entityType: 'tutor_request',
        entityId: winner.id,
        fromStatusCode: 'accepted',
        toStatusCode: 'selected',
        actorUserId: input.actorUserId,
        reasonCode: 'family_selected',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      for (const loser of losers) {
        await tx.insert(statusTransitions).values({
          entityType: 'tutor_request',
          entityId: loser.id,
          fromStatusCode: statusBeforeClose.get(loser.id) ?? null,
          toStatusCode: 'closed',
          actorUserId: input.actorUserId,
          reasonCode: 'another_tutor_selected',
          correlationId: input.correlationId,
          occurredAt: now,
        });
        // One outbox entry per closed tutor, carrying only their own
        // reference — nothing about the winner or how many others existed.
        await tx.insert(outboxEntries).values({
          eventType: 'tutor_request.closed',
          payload: { tutorRequestId: loser.id },
          idempotencyKey: `tutor_request.closed:${loser.id}`,
          correlationId: input.correlationId,
        });
      }
      await tx.insert(statusTransitions).values({
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        fromStatusCode: 'ready_for_selection',
        toStatusCode: 'awaiting_payment',
        actorUserId: input.actorUserId,
        reasonCode: 'family_selected',
        correlationId: input.correlationId,
        occurredAt: now,
      });
      await tx.insert(auditEvents).values({
        category: 'business',
        action: 'intended_lesson_request.selected',
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        occurredAt: now,
        newValue: { closedCount: losers.length, startAt: claimed.startAt },
        riskLevel: 'low',
      });
      await tx.insert(domainEvents).values({
        eventType: 'intended_lesson_request.selected',
        entityType: 'intended_lesson_request',
        entityId: ilr.id,
        payload: { startAt: claimed.startAt, paymentDeadlineAt: window.deadlineAt },
        correlationId: input.correlationId,
        occurredAt: now,
      });
      /*
       * Written now, consumed later. Nothing drains the outbox yet — that is
       * the notifications slice — but the entry belongs to the transaction that
       * created the obligation, not to whatever eventually sends the email.
       * Emitting it here means the notification slice never has to reopen this
       * transaction.
       */
      await tx.insert(outboxEntries).values({
        eventType: 'payment.required',
        payload: { tutorRequestId: winner.id, paymentDeadlineAt: window.deadlineAt },
        idempotencyKey: `payment.required:${winner.id}`,
        correlationId: input.correlationId,
      });

      return {
        tutorFirstName: tutor?.firstName ?? 'Your tutor',
        startAt: claimed.startAt,
        closedCount: losers.length,
        paymentDeadlineAt: window.deadlineAt,
        paymentWindowMinutes: window.windowMinutes,
      };
    });
  } catch (error) {
    // Two guardians choosing different winners at the same instant lock each
    // other's rows in opposite order and one is killed as a deadlock. The
    // transaction rolled back whole, so the honest answer is the same as any
    // other lost race rather than a raw driver error.
    const code = postgresErrorCode(error);
    if (code !== null && LOST_RACE_SQLSTATES.has(code)) {
      throw new SelectionNoLongerAvailableError();
    }
    throw error;
  } finally {
    await sql.end();
  }
}

/** Rules currently in force, for interface copy and validation. */
export async function currentRequestRules(): Promise<RequestRules> {
  const { rules } = await loadRequestRules();
  return rules;
}

/** Resolve the student profile owning a subject section, for scope checks. */
export async function subjectSectionOwner(
  subjectSectionId: string,
): Promise<{ studentProfileId: string; defaultFamilyAccountId: string | null } | null> {
  const { sql, db } = createDatabaseClient();
  try {
    const [row] = await db
      .select({
        studentProfileId: studentSubjectSections.studentProfileId,
        defaultFamilyAccountId: studentProfiles.defaultFamilyAccountId,
      })
      .from(studentSubjectSections)
      .innerJoin(studentProfiles, eq(studentSubjectSections.studentProfileId, studentProfiles.id))
      .where(
        and(
          eq(studentSubjectSections.id, subjectSectionId),
          eq(studentSubjectSections.statusCode, 'active'),
        ),
      );
    return row ?? null;
  } finally {
    await sql.end();
  }
}
