import 'server-only';
import { listBookableServices, listSubjects, type BookableServiceVersion } from '@studdy/database';
import { formatsForVersion } from '@studdy/database';
import type { LessonFormat } from '@studdy/domain/availability';
import type {
  DiscoveryContext,
  DiscoveryStudent,
  DiscoverySubjectSection,
} from '@studdy/domain/discovery';
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
 */

export interface ResolvedBooking {
  readonly context: DiscoveryContext;
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
  /** An existing section for this child and subject, when there is one. */
  readonly existingSection: DiscoverySubjectSection | null;
  /** The first step whose answer is still missing. */
  readonly nextStep: BookingStep;
}

export async function resolveBooking(raw: RawSearchParams): Promise<ResolvedBooking | null> {
  const context = await resolveDiscoveryContext();
  if (context === null) return null;

  const params = parseBookingParams(raw);

  // ---- Child. The only question is whether this user may act for them. -----
  const student =
    context.students.find((candidate) => candidate.studentProfileId === params.child) ?? null;

  // ---- Subject. Real, active, and named for the review screen. -------------
  const subjects = student === null ? [] : await listSubjects();
  const subjectRow =
    student === null ? undefined : subjects.find((row) => row.subjectId === params.subject);
  const subject =
    subjectRow === undefined
      ? null
      : { subjectId: subjectRow.subjectId, displayName: subjectRow.displayName };

  // ---- Tutor. Resolved through the bookable allow-list, which also gives us
  //      the internal profile id the public projection deliberately withholds.
  const services =
    subject === null || params.tutor === null
      ? null
      : await listBookableServices({ tutorReference: params.tutor, subjectId: subject.subjectId });
  const tutor =
    services === null
      ? null
      : {
          tutorProfileId: services.tutorProfileId,
          tutorReference: services.tutorReference,
          firstName: services.tutorFirstName,
          versions: services.versions,
        };

  // ---- Length. Must be one of THIS tutor's versions for THIS subject. ------
  const version =
    tutor === null
      ? null
      : (tutor.versions.find((row) => row.serviceVersionId === params.version) ?? null);

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
    params,
    student,
    subject,
    tutor,
    version,
    formats,
    format,
    times,
    existingSection,
    nextStep: firstUnanswered({ student, subject, tutor, version, format, times }),
  };
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
