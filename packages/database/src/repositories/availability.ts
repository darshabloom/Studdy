import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import {
  bookableSlots,
  type AvailabilityException as DomainException,
  type Interval,
  type RecurringRule,
} from '@studdy/domain/availability';
import { createDatabaseClient } from '../client';
import {
  availabilityExceptions,
  availabilityRules,
  services,
  serviceVersions,
  studentSubjectSections,
  tutorProfiles,
  tutorTimeReservations,
} from '../schema/index';
import { publiclyListedTutor } from './tutor-visibility';

/**
 * Availability repository.
 *
 * TWO AUDIENCES, TWO SHAPES, and the difference is the privacy boundary.
 *
 * 1. The tutor's OWN workspace reads rules and exceptions in full, including
 *    private reasons and notes. Every one of those functions takes a
 *    `tutorProfileId` the caller resolved from the session.
 *
 * 2. Families receive `bookableSlotsForTutors` and nothing else. It returns
 *    derived positive slots — two instants per slot. No rule, no exception, no
 *    block, no reason, and no gap. A caller that never receives a reason cannot
 *    leak one.
 *
 * These tables carry no browser-facing grants, so both paths are server-side.
 */

// ---------------------------------------------------------------------------
// Tutor's own workspace
// ---------------------------------------------------------------------------

export interface AvailabilityRuleRecord {
  readonly id: string;
  readonly dayOfWeek: number;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly ianaTimeZone: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly lessonFormatCode: string;
  readonly minimumNoticeMinutes: number | null;
  readonly maximumAdvanceBookingDays: number | null;
}

export interface AvailabilityExceptionRecord {
  readonly id: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly effectCode: string;
  /** TUTOR-ONLY. Never selected by any family-facing projection. */
  readonly reasonCode: string | null;
  /** TUTOR-ONLY. */
  readonly privateNote: string | null;
}

export async function listAvailabilityRules(
  tutorProfileId: string,
): Promise<readonly AvailabilityRuleRecord[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        id: availabilityRules.id,
        dayOfWeek: availabilityRules.dayOfWeek,
        localStartTime: availabilityRules.localStartTime,
        localEndTime: availabilityRules.localEndTime,
        ianaTimeZone: availabilityRules.ianaTimeZone,
        effectiveFrom: availabilityRules.effectiveFrom,
        effectiveUntil: availabilityRules.effectiveUntil,
        lessonFormatCode: availabilityRules.lessonFormatCode,
        minimumNoticeMinutes: availabilityRules.minimumNoticeMinutes,
        maximumAdvanceBookingDays: availabilityRules.maximumAdvanceBookingDays,
      })
      .from(availabilityRules)
      .where(
        and(
          eq(availabilityRules.tutorProfileId, tutorProfileId),
          eq(availabilityRules.statusCode, 'active'),
        ),
      )
      .orderBy(asc(availabilityRules.dayOfWeek), asc(availabilityRules.localStartTime));
    return rows;
  } finally {
    await client.end();
  }
}

export async function listAvailabilityExceptions(
  tutorProfileId: string,
  from: Date,
): Promise<readonly AvailabilityExceptionRecord[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        id: availabilityExceptions.id,
        startsAt: availabilityExceptions.startsAt,
        endsAt: availabilityExceptions.endsAt,
        effectCode: availabilityExceptions.effectCode,
        reasonCode: availabilityExceptions.reasonCode,
        privateNote: availabilityExceptions.privateNote,
      })
      .from(availabilityExceptions)
      .where(
        and(
          eq(availabilityExceptions.tutorProfileId, tutorProfileId),
          eq(availabilityExceptions.statusCode, 'active'),
          gte(availabilityExceptions.endsAt, from),
        ),
      )
      .orderBy(asc(availabilityExceptions.startsAt));
    return rows;
  } finally {
    await client.end();
  }
}

export interface CreateAvailabilityRuleInput {
  readonly tutorProfileId: string;
  readonly createdByUserId: string;
  readonly dayOfWeek: number;
  readonly localStartTime: string;
  readonly localEndTime: string;
  readonly ianaTimeZone: string;
  readonly effectiveFrom: string;
  readonly lessonFormatCode?: string;
  readonly minimumNoticeMinutes?: number | null;
  readonly maximumAdvanceBookingDays?: number | null;
}

export async function createAvailabilityRule(input: CreateAvailabilityRuleInput): Promise<string> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [row] = await db
      .insert(availabilityRules)
      .values({
        tutorProfileId: input.tutorProfileId,
        createdByUserId: input.createdByUserId,
        updatedByUserId: input.createdByUserId,
        dayOfWeek: input.dayOfWeek,
        localStartTime: input.localStartTime,
        localEndTime: input.localEndTime,
        ianaTimeZone: input.ianaTimeZone,
        effectiveFrom: input.effectiveFrom,
        lessonFormatCode: input.lessonFormatCode ?? 'any',
        minimumNoticeMinutes: input.minimumNoticeMinutes ?? null,
        maximumAdvanceBookingDays: input.maximumAdvanceBookingDays ?? null,
      })
      .returning({ id: availabilityRules.id });
    if (row === undefined) throw new Error('Availability rule was not created.');
    return row.id;
  } finally {
    await client.end();
  }
}

/**
 * Archive rather than delete: a rule that produced slots someone was shown is
 * part of the record of what was offered (brief §7, archival over deletion).
 * Ownership is part of the WHERE clause, so another tutor's rule matches zero
 * rows rather than being found and then refused.
 */
export async function archiveAvailabilityRule(
  ruleId: string,
  tutorProfileId: string,
  updatedByUserId: string,
): Promise<boolean> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .update(availabilityRules)
      .set({ statusCode: 'archived', archivedAt: new Date(), updatedByUserId })
      .where(
        and(
          eq(availabilityRules.id, ruleId),
          eq(availabilityRules.tutorProfileId, tutorProfileId),
          eq(availabilityRules.statusCode, 'active'),
        ),
      )
      .returning({ id: availabilityRules.id });
    return rows.length === 1;
  } finally {
    await client.end();
  }
}

export interface CreateAvailabilityExceptionInput {
  readonly tutorProfileId: string;
  readonly createdByUserId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly effectCode: 'adds' | 'removes';
  readonly reasonCode?: string | null;
  readonly privateNote?: string | null;
}

export async function createAvailabilityException(
  input: CreateAvailabilityExceptionInput,
): Promise<string> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [row] = await db
      .insert(availabilityExceptions)
      .values({
        tutorProfileId: input.tutorProfileId,
        createdByUserId: input.createdByUserId,
        updatedByUserId: input.createdByUserId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        effectCode: input.effectCode,
        reasonCode: input.reasonCode ?? null,
        privateNote: input.privateNote ?? null,
      })
      .returning({ id: availabilityExceptions.id });
    if (row === undefined) throw new Error('Availability exception was not created.');
    return row.id;
  } finally {
    await client.end();
  }
}

export async function archiveAvailabilityException(
  exceptionId: string,
  tutorProfileId: string,
  updatedByUserId: string,
): Promise<boolean> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const rows = await db
      .update(availabilityExceptions)
      .set({ statusCode: 'archived', archivedAt: new Date(), updatedByUserId })
      .where(
        and(
          eq(availabilityExceptions.id, exceptionId),
          eq(availabilityExceptions.tutorProfileId, tutorProfileId),
          eq(availabilityExceptions.statusCode, 'active'),
        ),
      )
      .returning({ id: availabilityExceptions.id });
    return rows.length === 1;
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Derived slots — the ONLY availability shape any family-facing surface receives
// ---------------------------------------------------------------------------

/** Two instants. Deliberately nothing else. */
export interface BookableSlot {
  readonly startAt: Date;
  readonly endAt: Date;
}

export interface BookableSlotsQuery {
  readonly tutorProfileIds: readonly string[];
  readonly from: Date;
  readonly to: Date;
  readonly durationMinutes: number;
  readonly now?: Date;
  readonly defaultMinimumNoticeMinutes?: number;
  readonly defaultMaximumAdvanceBookingDays?: number;
  /**
   * Grid the slot starts are aligned to. Defaults to the 30-minute grid a
   * family is offered. A server-side caller asking whether one specific
   * interval is bookable passes 1, which aligns the grid to that interval and
   * turns the question into plain containment.
   */
  readonly stepMinutes?: number;
}

/**
 * A window bound as a plain 'YYYY-MM-DD', widened by `offsetDays`.
 *
 * `effective_from` and `effective_until` are plain dates read in the rule's own
 * zone, while the window bounds are instants. A Pacific/Auckland rule can sit a
 * calendar day ahead of the same moment in UTC, so the bound is widened a day
 * each way to keep such a rule in the candidate set. This is only a coarse
 * pre-filter — `bookableSlots` clips to the real window afterwards, so a day of
 * slack costs nothing, whereas a day of tightness would silently drop a tutor's
 * first or last day.
 */
function dateOnlyUtc(instant: Date, offsetDays: number): string {
  return new Date(instant.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Bookable slots per tutor, keyed by tutor profile id.
 *
 * Everything sensitive is consumed inside this function: rules, exceptions,
 * private reasons and existing reservations go in, and only positive slots come
 * out. A gap in the result is indistinguishable between "already booked",
 * "blocked privately", "on holiday", "held by another family's acceptance" and
 * "outside working hours" — which is exactly the intent, and is asserted by
 * integration test.
 */
export async function bookableSlotsForTutors(
  query: BookableSlotsQuery,
): Promise<Map<string, readonly BookableSlot[]>> {
  const result = new Map<string, readonly BookableSlot[]>();
  if (query.tutorProfileIds.length === 0) return result;

  const now = query.now ?? new Date();
  const window: Interval = { startAt: query.from, endAt: query.to };
  const ids = [...query.tutorProfileIds];

  const { sql: client, db } = createDatabaseClient();
  try {
    const ruleRows = await db
      .select({
        tutorProfileId: availabilityRules.tutorProfileId,
        dayOfWeek: availabilityRules.dayOfWeek,
        localStartTime: availabilityRules.localStartTime,
        localEndTime: availabilityRules.localEndTime,
        ianaTimeZone: availabilityRules.ianaTimeZone,
        effectiveFrom: availabilityRules.effectiveFrom,
        effectiveUntil: availabilityRules.effectiveUntil,
        minimumNoticeMinutes: availabilityRules.minimumNoticeMinutes,
        maximumAdvanceBookingDays: availabilityRules.maximumAdvanceBookingDays,
      })
      .from(availabilityRules)
      .where(
        and(
          inArray(availabilityRules.tutorProfileId, ids),
          eq(availabilityRules.statusCode, 'active'),
          lte(availabilityRules.effectiveFrom, dateOnlyUtc(query.to, 1)),
          or(
            isNull(availabilityRules.effectiveUntil),
            gte(availabilityRules.effectiveUntil, dateOnlyUtc(query.from, -1)),
          ),
        ),
      );

    // Only exceptions overlapping the window matter. `reason_code` and
    // `private_note` are deliberately NOT selected: this path must not be able
    // to leak what it never loaded.
    const exceptionRows = await db
      .select({
        tutorProfileId: availabilityExceptions.tutorProfileId,
        startsAt: availabilityExceptions.startsAt,
        endsAt: availabilityExceptions.endsAt,
        effectCode: availabilityExceptions.effectCode,
      })
      .from(availabilityExceptions)
      .where(
        and(
          inArray(availabilityExceptions.tutorProfileId, ids),
          eq(availabilityExceptions.statusCode, 'active'),
          lte(availabilityExceptions.startsAt, query.to),
          gte(availabilityExceptions.endsAt, query.from),
        ),
      );

    // Active reservations of every kind: confirmed bookings and request holds
    // alike. Both make time unbookable, and the difference is not the family's
    // business.
    const reservationRows = await db
      .select({
        tutorProfileId: tutorTimeReservations.tutorProfileId,
        startAt: tutorTimeReservations.startAt,
        endAt: tutorTimeReservations.endAt,
      })
      .from(tutorTimeReservations)
      .where(
        and(
          inArray(tutorTimeReservations.tutorProfileId, ids),
          eq(tutorTimeReservations.statusCode, 'active'),
          lte(tutorTimeReservations.startAt, query.to),
          gte(tutorTimeReservations.endAt, query.from),
        ),
      );

    for (const tutorProfileId of ids) {
      const rules: RecurringRule[] = ruleRows
        .filter((row) => row.tutorProfileId === tutorProfileId)
        .map((row) => ({
          dayOfWeek: row.dayOfWeek,
          localStartTime: row.localStartTime,
          localEndTime: row.localEndTime,
          ianaTimeZone: row.ianaTimeZone,
          effectiveFrom: row.effectiveFrom,
          effectiveUntil: row.effectiveUntil,
          minimumNoticeMinutes: row.minimumNoticeMinutes,
          maximumAdvanceBookingDays: row.maximumAdvanceBookingDays,
        }));

      const exceptions: DomainException[] = exceptionRows
        .filter((row) => row.tutorProfileId === tutorProfileId)
        .map((row) => ({
          startAt: row.startsAt,
          endAt: row.endsAt,
          effectCode: row.effectCode === 'adds' ? 'adds' : 'removes',
        }));

      const reservations: Interval[] = reservationRows
        .filter((row) => row.tutorProfileId === tutorProfileId)
        .map((row) => ({ startAt: row.startAt, endAt: row.endAt }));

      const slots = bookableSlots({
        rules,
        exceptions,
        reservations,
        window,
        durationMinutes: query.durationMinutes,
        defaultMinimumNoticeMinutes: query.defaultMinimumNoticeMinutes ?? 120,
        defaultMaximumAdvanceBookingDays: query.defaultMaximumAdvanceBookingDays ?? 60,
        now,
        ...(query.stepMinutes === undefined ? {} : { stepMinutes: query.stepMinutes }),
      });

      // Map explicitly rather than passing the domain object through, so an
      // added field there cannot silently widen what families receive.
      result.set(
        tutorProfileId,
        slots.map((slot) => ({ startAt: slot.startAt, endAt: slot.endAt })),
      );
    }

    return result;
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Discovery — bookable slots for a real student/subject context
// ---------------------------------------------------------------------------

export interface TutorBookableSlots {
  readonly tutorReference: string;
  readonly tutorProfileId: string;
  /** The tutor's own lesson length for this subject. Tutors may differ. */
  readonly durationMinutes: number;
  readonly slots: readonly BookableSlot[];
}

export interface SubjectSectionSlotsQuery {
  readonly subjectSectionId: string;
  /** Restrict to these tutors. Omitted means every tutor offering the subject. */
  readonly tutorReferences?: readonly string[];
  readonly from: Date;
  readonly to: Date;
  readonly now?: Date;
}

/**
 * Bookable slots for the tutors who teach a subject section's subject.
 *
 * This is the family-facing availability surface (§7). It is scoped to a real
 * student/subject context rather than being an open calendar endpoint: the
 * caller passes a subject section id it has already resolved from the session,
 * and slots come back only for tutors who actually publish that subject.
 *
 * The duration is each tutor's own current published lesson length, not a
 * number from the browser — a caller cannot widen a tutor's apparent
 * availability by asking for shorter lessons than the tutor offers.
 *
 * What comes back is the same two-instants shape as everywhere else. Nothing
 * here can express a reason, a gap or a block.
 */
export async function bookableSlotsForSubjectSection(
  query: SubjectSectionSlotsQuery,
): Promise<readonly TutorBookableSlots[]> {
  const { sql: client, db } = createDatabaseClient();
  try {
    const [section] = await db
      .select({ subjectId: studentSubjectSections.subjectId })
      .from(studentSubjectSections)
      .where(eq(studentSubjectSections.id, query.subjectSectionId));
    if (section === undefined) return [];

    const offerings = await db
      .select({
        tutorProfileId: tutorProfiles.id,
        tutorReference: tutorProfiles.reference,
        durationMinutes: serviceVersions.durationMinutes,
      })
      .from(serviceVersions)
      .innerJoin(services, eq(serviceVersions.serviceId, services.id))
      .innerJoin(tutorProfiles, eq(services.tutorProfileId, tutorProfiles.id))
      .where(
        and(
          eq(services.subjectId, section.subjectId),
          eq(services.statusCode, 'published'),
          eq(serviceVersions.statusCode, 'current'),
          // A tutor who is not openly listed does not appear in discovery, so
          // their calendar must not be reachable through it either — including
          // through a shortlist entry saved while they still were listed.
          publiclyListedTutor(),
          ...(query.tutorReferences === undefined
            ? []
            : [inArray(tutorProfiles.reference, [...query.tutorReferences])]),
        ),
      );
    if (offerings.length === 0) return [];

    // One derivation per distinct lesson length rather than one per tutor:
    // tutors overwhelmingly share the standard durations.
    const byDuration = new Map<number, typeof offerings>();
    for (const offering of offerings) {
      const existing = byDuration.get(offering.durationMinutes);
      if (existing === undefined) byDuration.set(offering.durationMinutes, [offering]);
      else existing.push(offering);
    }

    const results: TutorBookableSlots[] = [];
    for (const [durationMinutes, group] of byDuration) {
      const slotsByTutor = await bookableSlotsForTutors({
        tutorProfileIds: group.map((offering) => offering.tutorProfileId),
        from: query.from,
        to: query.to,
        durationMinutes,
        ...(query.now === undefined ? {} : { now: query.now }),
      });
      for (const offering of group) {
        results.push({
          tutorReference: offering.tutorReference,
          tutorProfileId: offering.tutorProfileId,
          durationMinutes,
          slots: slotsByTutor.get(offering.tutorProfileId) ?? [],
        });
      }
    }
    return results;
  } finally {
    await client.end();
  }
}
