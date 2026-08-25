import 'server-only';
import {
  listBookableServices,
  listSubjects,
  searchPublicTutors,
  type BookableServiceVersion,
  type PublicTutorRow,
} from '@studdy/database';
import { formatsForVersion } from '@studdy/database';
import type { LessonFormat } from '@studdy/domain/availability';
import type {
  DiscoveryContext,
  DiscoveryStudent,
  DiscoverySubjectSection,
} from '@studdy/domain/discovery';
import { schoolYearNumber } from '@studdy/domain/students';
import { resolveDiscoveryContext } from '../discovery/context';
import {
  BOOKING_STEPS,
  parseBookingParams,
  type BookingParams,
  type BookingStep,
  type RawSearchParams,
} from './draft';

/**
 * Turning the URL into answers this user is actually allowed to have given.
 *
 * EVERY PARAMETER IS RE-CHECKED ON EVERY REQUEST, not once at the start. The
 * journey keeps its state in the URL, so there is no server-side session to
 * trust and no step that can assume an earlier step ran: a family can paste a
 * link, edit an id, or come back tomorrow to a tutor who has since withdrawn
 * the length they picked.
 *
 * An answer that no longer resolves is DROPPED, along with everything that
 * depended on it, and the family is sent to the first unanswered step. Silently
 * carrying it would be worse than an error — a stale version id is a price.
 *
 * A QUESTION WITH ONE VALID ANSWER IS NOT A QUESTION. Where the server can see
 * that exactly one child, tutor, length or format is available, it answers on
 * the family's behalf and the step never appears. The answer still shows in the
 * summary, marked, so the parent sees the whole shape of the request — they are
 * simply not asked to click through a decision that was never theirs to make.
 *
 * The one deliberate exception is SUBJECT. Every subject Studdy offers is a
 * valid answer, so there is no "only option" to settle on; a subject arrives
 * pre-answered only when the entry context supplied it explicitly, which is a
 * choice the family already made somewhere else.
 */

/** Steps the server answered because exactly one answer was ever available. */
export type SettledSteps = ReadonlySet<BookingStep>;

export interface ResolvedBooking {
  readonly context: DiscoveryContext;
  /**
   * The answers as they now stand, INCLUDING any the server settled.
   *
   * Deliberately not the raw parsed URL: every link the journey builds comes
   * from here, so a settled answer travels forward exactly as a chosen one
   * does and no caller has to remember which is which.
   */
  readonly params: BookingParams;
  readonly student: DiscoveryStudent | null;
  readonly subject: { readonly subjectId: string; readonly displayName: string } | null;
  readonly tutor: {
    readonly tutorProfileId: string;
    readonly tutorReference: string;
    readonly firstName: string;
    readonly versions: readonly BookableServiceVersion[];
  } | null;
  readonly version: BookableServiceVersion | null;
  /** Concrete formats the chosen version may be delivered as. */
  readonly formats: readonly LessonFormat[];
  readonly format: LessonFormat | null;
  readonly times: readonly Date[];
  /**
   * Public tutors who teach this subject at this student's level.
   *
   * Resolved here rather than on the tutor screen because whether there is a
   * CHOICE of tutor decides two things every screen needs: whether the tutor
   * step is asked at all, and whether the summary may offer to change it.
   */
  readonly tutorChoices: readonly PublicTutorRow[];
  /** An existing section for this child and subject, when there is one. */
  readonly existingSection: DiscoverySubjectSection | null;
  readonly settled: SettledSteps;
  /** The first step whose answer is still missing. */
  readonly nextStep: BookingStep;
}

export async function resolveBooking(raw: RawSearchParams): Promise<ResolvedBooking | null> {
  const context = await resolveDiscoveryContext();
  if (context === null) return null;

  const params = parseBookingParams(raw);
  const settled = new Set<BookingStep>();

  // ---- Child. The only question is whether this user may act for them, and
  //      where they may act for exactly one child there is nothing to ask.
  const soleStudent = context.students.length === 1 ? (context.students[0] ?? null) : null;
  const student =
    context.students.find((candidate) => candidate.studentProfileId === params.child) ??
    soleStudent;
  if (student !== null && soleStudent !== null) settled.add('child');

  // ---- Subject. Real, active, and named for the review screen. -------------
  //      Never settled by count: every subject is a valid answer.
  const subjects = student === null ? [] : await listSubjects();
  const subjectRow =
    student === null ? undefined : subjects.find((row) => row.subjectId === params.subject);
  const subject =
    subjectRow === undefined
      ? null
      : { subjectId: subjectRow.subjectId, displayName: subjectRow.displayName };

  // ---- Tutor. Who could teach this subject at this student's level. --------
  const tutorChoices =
    student === null || subject === null ? [] : await eligibleTutors(student, subject.displayName);
  const soleTutorReference =
    tutorChoices.length === 1 ? (tutorChoices[0]?.tutorReference ?? null) : null;

  /**
   * Resolved through the bookable allow-list, which is the authority — the
   * public search above only decides WHICH tutor to put to it, never whether
   * that tutor may be booked.
   *
   * The retry exists for one narrow case: a stale or edited `tutor` parameter
   * where the subject has only one tutor anyway. Without it the family would be
   * shown a tutor step listing a single option, which is exactly the fake
   * decision this resolution is meant to remove.
   */
  const requested = params.tutor ?? soleTutorReference;
  let services =
    subject === null || requested === null
      ? null
      : await listBookableServices({ tutorReference: requested, subjectId: subject.subjectId });
  if (
    services === null &&
    subject !== null &&
    soleTutorReference !== null &&
    requested !== soleTutorReference
  ) {
    services = await listBookableServices({
      tutorReference: soleTutorReference,
      subjectId: subject.subjectId,
    });
  }
  const tutor =
    services === null
      ? null
      : {
          tutorProfileId: services.tutorProfileId,
          tutorReference: services.tutorReference,
          firstName: services.tutorFirstName,
          versions: services.versions,
        };
  if (tutor !== null && soleTutorReference !== null) settled.add('tutor');

  // ---- Length. Must be one of THIS tutor's versions for THIS subject. ------
  //      A tutor who publishes one length is not offering a choice of length.
  const soleVersion =
    tutor !== null && tutor.versions.length === 1 ? (tutor.versions[0] ?? null) : null;
  const version =
    tutor === null
      ? null
      : (tutor.versions.find((row) => row.serviceVersionId === params.version) ?? soleVersion);
  if (version !== null && soleVersion !== null) settled.add('length');

  // ---- Format. Only what the chosen version can actually be delivered as. --
  const formats = version === null ? [] : formatsForVersion(version);
  const format =
    params.format !== null && formats.includes(params.format)
      ? params.format
      : // Exactly one possibility is not a question. Carrying it forward here
        // means the format step can be skipped without any other code having to
        // know that it sometimes does not exist.
        formats.length === 1
        ? (formats[0] ?? null)
        : null;
  if (format !== null && formats.length === 1) settled.add('format');

  // ---- Times. Instants, kept only while everything they depend on holds. ---
  const times =
    version === null || format === null
      ? []
      : params.times
          .map((raw) => new Date(raw))
          .filter((at) => !Number.isNaN(at.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());

  const existingSection =
    student === null || subject === null
      ? null
      : (context.subjectSections.find(
          (section) =>
            section.studentProfileId === student.studentProfileId &&
            section.subjectId === subject.subjectId,
        ) ?? null);

  return {
    context,
    // Settled answers folded back in, so every href built downstream carries
    // them and a settled step is never re-derived by accident.
    params: {
      ...params,
      child: student?.studentProfileId ?? null,
      subject: subject?.subjectId ?? null,
      tutor: tutor?.tutorReference ?? null,
      version: version?.serviceVersionId ?? null,
      format,
    },
    student,
    subject,
    tutor,
    version,
    formats,
    format,
    times,
    tutorChoices,
    existingSection,
    settled,
    nextStep: firstUnanswered({ student, subject, tutor, version, format, times }),
  };
}

/**
 * Public tutors teaching this subject at this student's level.
 *
 * Matched on the subject's display name because that is what the public
 * projection carries; `listBookableServices` still decides, afterwards, whether
 * the chosen one may actually be booked.
 */
async function eligibleTutors(
  student: DiscoveryStudent,
  subjectDisplayName: string,
): Promise<readonly PublicTutorRow[]> {
  const rows = await searchPublicTutors({
    subjectCode: null,
    schoolYearNumber:
      student.schoolYearCode === null ? null : schoolYearNumber(student.schoolYearCode),
    formatCode: null,
    maxPriceAmountMinor: null,
  });

  // One entry per tutor. A tutor publishing several lengths for the subject
  // must not read as several tutors — that would turn "only one tutor" into a
  // choice, and put a step back that should never have appeared.
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (row.subjectDisplayName !== subjectDisplayName) return false;
    if (seen.has(row.tutorReference)) return false;
    seen.add(row.tutorReference);
    return true;
  });
}

function firstUnanswered(state: {
  student: unknown;
  subject: unknown;
  tutor: unknown;
  version: unknown;
  format: unknown;
  times: readonly unknown[];
}): BookingStep {
  if (state.student === null) return 'child';
  if (state.subject === null) return 'subject';
  if (state.tutor === null) return 'tutor';
  if (state.version === null) return 'length';
  if (state.format === null) return 'format';
  if (state.times.length === 0) return 'times';
  return 'review';
}

/**
 * May a family be on this step yet?
 *
 * A step is reachable once everything before it is answered. Going BACK is
 * always allowed — that is how an answer gets changed — so only steps ahead of
 * the frontier are refused, and the family is moved to the frontier rather than
 * shown an error about a URL they did not type.
 */
export function stepIsReachable(step: BookingStep, nextStep: BookingStep): boolean {
  return BOOKING_STEPS.indexOf(step) <= BOOKING_STEPS.indexOf(nextStep);
}
