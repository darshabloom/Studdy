import { and, eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../client';
import {
  services,
  serviceVersions,
  studentProfiles,
  studentSubjectSections,
  subjects,
  tutorProfiles,
} from '../../schema/index';
import { bookableSlotsForSubjectSection } from '../../repositories/availability';
import { createIntendedLessonRequest } from '../../repositories/lesson-requests';
import { setRuleSetting } from '../../repositories/rule-settings';

/**
 * Real bookable start times shared by the target tutors.
 *
 * A request may now only offer times its tutors can actually do, so a seed
 * cannot invent "five days from now" and expect it to be accepted — the seeded
 * tutors work weekday afternoons, and an arbitrary instant almost never lands
 * inside those hours. Deriving from live availability keeps the scenarios
 * honest against whatever the availability seed produced.
 */
async function bookableStartsFor(
  target: { subjectSectionId: string; tutorProfileIds: readonly string[] },
  count: number,
): Promise<Date[]> {
  const from = new Date();
  const availability = await bookableSlotsForSubjectSection({
    subjectSectionId: target.subjectSectionId,
    from,
    to: new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000),
  });
  const wanted = new Set(target.tutorProfileIds);
  const starts = availability
    .filter((entry) => wanted.has(entry.tutorProfileId))
    .flatMap((entry) => entry.slots.map((slot) => slot.startAt.getTime()));
  return [...new Set(starts)]
    .sort((a, b) => a - b)
    .slice(0, count)
    .map((at) => new Date(at));
}

/**
 * Seeded request scenarios for the ILR slice.
 *
 * Named after the states listed in the handoff brief §12 so they can be reset
 * and re-run. Only the states this slice can actually reach are seeded —
 * accepted, selected and paid states arrive with their own slices, and seeding
 * them now would be fabricating data the code cannot yet produce.
 */

/** Provisional deadline and hold configuration (approved decision 5). */
export async function seedRequestRules(): Promise<void> {
  await setRuleSetting(
    'requests.fan_out_cap',
    3,
    'Provisional: MVP Plan §18-22 recommends an initial maximum of three.',
  );
  await setRuleSetting(
    'requests.response_deadline_tiers',
    [
      { minHoursUntilLesson: 48, responseWindowHours: 24 },
      { minHoursUntilLesson: 24, responseWindowHours: 12 },
      { minHoursUntilLesson: 6, responseWindowHours: 4 },
      { minHoursUntilLesson: 0, responseWindowHours: 1 },
    ],
    'Provisional: Doc 11 §13 "potential model". Awaiting confirmed numbers.',
  );
  await setRuleSetting(
    'requests.decision_grace_hours',
    24,
    'Provisional: time to choose after the last response is due.',
  );
  await setRuleSetting(
    'requests.minimum_notice_hours',
    2,
    'Provisional: minimum notice before a requested lesson.',
  );
  await setRuleSetting(
    'requests.min_time_options',
    1,
    'A parent may genuinely have one workable time. Studdy encourages flexibility in the copy rather than requiring it in the rule.',
  );
  await setRuleSetting(
    'requests.max_time_options',
    5,
    'Past five a tutor is reading a timetable rather than answering a question, and each extra time is another hold to reason about.',
  );
  await setRuleSetting(
    'requests.require_payment_method_before_send',
    false,
    'Approved policy is TRUE, but DISABLED until the Stripe slice provides a real way to add and verify a payment method. Enabling it now would block every request with no way to satisfy it.',
  );
  /*
   * The payment window, as two independent rules.
   *
   * Kept apart because they answer different questions and will move
   * separately: one is how long a person needs to find their card, the other is
   * how little notice a tutor may be given. A single combined "minimum lead
   * time" would make either change silently alter the other.
   */
  await setRuleSetting(
    'payments.window_minutes',
    60,
    'Approved 2026-08-26: a family gets a full hour to pay after choosing. Never shortened for a near lesson — such a selection is refused instead.',
  );
  await setRuleSetting(
    'payments.near_lesson_cutoff_minutes',
    30,
    'Approved 2026-08-26: the margin that must remain between the payment deadline and the lesson. With the 60-minute window this means a lesson must be at least 90 minutes away to be selectable.',
  );
  /*
   * Pricing, as two independently versioned rules.
   *
   * The rate and the payer policy move separately — the commission may change
   * without the policy changing, and the policy will be tested with parents
   * before launch without touching the commission. Every payment snapshots one
   * version per key for exactly that reason.
   *
   * `payments.disclosed_processing_fee_minor` is DELIBERATELY NOT SEEDED. It
   * has no meaning while Studdy absorbs the cost, and inventing a percentage
   * now would bake a guess about a provider's pricing into the product. The
   * pricing domain refuses to charge a parent-paid fee that has not been
   * configured, so the policy cannot be switched on without setting a real one.
   */
  await setRuleSetting(
    'payments.platform_fee_rate_bps',
    1000,
    "Approved 2026-08-26: Studdy's commission is 10% of the tutor's listed price. Basis points so the rate is an integer. The parent pays the listed price; nothing is added on top.",
  );
  await setRuleSetting(
    'payments.processing_fee_payer',
    'platform',
    'Approved 2026-08-26: for private alpha Studdy absorbs payment-processing costs. Configurable and versioned because the public policy is validated with parents before launch — neither policy may be hard-coded.',
  );
}

interface SeedTarget {
  requesterUserId: string;
  subjectSectionId: string;
  tutorProfileIds: string[];
}

/** Resolve the seeded parent's maths section and the seeded maths tutors. */
async function resolveTarget(): Promise<SeedTarget | null> {
  const { sql, db } = createDatabaseClient();
  try {
    const [section] = await db
      .select({
        sectionId: studentSubjectSections.id,
        subjectId: studentSubjectSections.subjectId,
        studentProfileId: studentSubjectSections.studentProfileId,
      })
      .from(studentSubjectSections)
      .innerJoin(subjects, eq(studentSubjectSections.subjectId, subjects.id))
      .where(and(eq(subjects.code, 'mathematics'), eq(studentSubjectSections.statusCode, 'active')))
      .limit(1);
    if (section === undefined) return null;

    const [student] = await db
      .select({ createdByUserId: studentProfiles.createdByUserId })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, section.studentProfileId));
    const requesterUserId = student?.createdByUserId ?? null;
    if (requesterUserId === null) return null;

    const tutors = await db
      .selectDistinct({ tutorProfileId: services.tutorProfileId })
      .from(services)
      .innerJoin(serviceVersions, eq(serviceVersions.serviceId, services.id))
      .innerJoin(tutorProfiles, eq(services.tutorProfileId, tutorProfiles.id))
      .where(
        and(
          eq(services.subjectId, section.subjectId),
          eq(services.statusCode, 'published'),
          eq(serviceVersions.statusCode, 'current'),
          eq(tutorProfiles.statusCode, 'active'),
        ),
      )
      .limit(3);

    if (tutors.length === 0) return null;
    return {
      requesterUserId,
      subjectSectionId: section.sectionId,
      tutorProfileIds: tutors.map((row) => row.tutorProfileId),
    };
  } finally {
    await sql.end();
  }
}

/**
 * `multi_tutor_request_pending` — one request fanned out to the seeded maths
 * tutors, every response still outstanding, every hold live.
 */
export async function seedMultiTutorRequestPending(): Promise<void> {
  await seedRequestRules();
  const target = await resolveTarget();
  if (target === null) {
    console.warn(
      'skipped multi_tutor_request_pending: no seeded maths section with a requester was found. ' +
        'Run the family/discovery seeds first.',
    );
    return;
  }

  const proposedStarts = await bookableStartsFor(target, 2);
  if (proposedStarts.length < 2) {
    console.warn(
      'skipped multi_tutor_request_pending: the seeded tutors have no bookable times to offer. ' +
        'Run the discovery seed so they have availability.',
    );
    return;
  }
  const created = await createIntendedLessonRequest({
    studentSubjectSectionId: target.subjectSectionId,
    requestedByUserId: target.requesterUserId,
    familyAccountId: null,
    tutorProfileIds: target.tutorProfileIds,
    proposedStarts,
    formatCode: 'online',
    timeZone: 'Pacific/Auckland',
    notesForTutors: 'Working towards an end-of-term algebra test.',
    hasPaymentMethodOnFile: false,
    paymentExemptionCode: null,
    correlationId: `cor_seed_${Date.now()}`,
  });
  console.log(
    `seeded multi_tutor_request_pending: ${created.reference} to ${created.tutorRequestReferences.length} tutors`,
  );
}

/**
 * `request_expired` — a request whose deadlines have already passed, so the
 * next expiry run closes it and releases its holds.
 */
export async function seedExpiredRequest(): Promise<void> {
  await seedRequestRules();
  const target = await resolveTarget();
  if (target === null) {
    console.warn('skipped request_expired: no seeded maths section with a requester was found.');
    return;
  }

  // Created against genuinely bookable times, then its deadlines are rewound
  // so an expiry run has something actually overdue to close.
  const singleTutor = { ...target, tutorProfileIds: target.tutorProfileIds.slice(0, 1) };
  const proposedStarts = await bookableStartsFor(singleTutor, 2);
  if (proposedStarts.length < 2) {
    console.warn('skipped request_expired: the seeded tutor has no bookable times to offer.');
    return;
  }
  const created = await createIntendedLessonRequest({
    studentSubjectSectionId: target.subjectSectionId,
    requestedByUserId: target.requesterUserId,
    familyAccountId: null,
    tutorProfileIds: singleTutor.tutorProfileIds,
    proposedStarts,
    formatCode: 'online',
    timeZone: 'Pacific/Auckland',
    notesForTutors: null,
    hasPaymentMethodOnFile: false,
    paymentExemptionCode: null,
    correlationId: `cor_seed_${Date.now()}`,
  });

  const { sql } = createDatabaseClient();
  try {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await sql`
      update bookings.tutor_requests
      set respond_by_at = ${past}
      where intended_lesson_request_id = ${created.intendedLessonRequestId}
    `;
    await sql`
      update bookings.intended_lesson_requests
      set decision_deadline_at = ${past}
      where id = ${created.intendedLessonRequestId}
    `;
  } finally {
    await sql.end();
  }
  console.log(`seeded request_expired: ${created.reference} (deadlines in the past)`);
}
