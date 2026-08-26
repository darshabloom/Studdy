import 'server-only';
import { formatsForCode, listBookableServices, listShortlist } from '@studdy/database';
import type { LessonFormat } from '@studdy/domain/availability';
import {
  durationChoices,
  formatChoices,
  resolveFanOutEligibility,
  type DurationChoice,
  type EligibilityCandidate,
  type FanOutEligibility,
  type FormatChoice,
} from '@studdy/domain/bookings';
import type { DiscoveryContext, DiscoverySubjectSection } from '@studdy/domain/discovery';
import { resolveDiscoveryContext } from '../discovery/context';
import {
  ASK_STEPS,
  parseAskParams,
  type AskParams,
  type AskStep,
  type RawSearchParams,
} from './draft';

/**
 * Turning the URL into a multi-tutor request this family may actually send.
 *
 * EVERY PARAMETER IS RE-CHECKED ON EVERY REQUEST. The section must belong to
 * this user, the tutors must be on that section's shortlist, and the duration
 * and format must be ones the shortlist can actually deliver. An answer that no
 * longer resolves is dropped along with everything downstream, exactly as the
 * single-tutor journey does.
 *
 * ONE ELIGIBLE OPTION IS STILL A QUESTION. As in `/book`, nothing is answered
 * on the family's behalf because only one choice remains — that a single
 * duration reaches their shortlist is a fact about those tutors' published
 * services, not a preference this family expressed.
 */

export interface ResolvedAsk {
  readonly context: DiscoveryContext;
  readonly section: DiscoverySubjectSection;
  readonly studentName: string | null;
  /** Validated answers; anything that no longer resolves is cleared. */
  readonly params: AskParams;
  /** Every shortlisted tutor, with their published versions for this subject. */
  readonly candidates: readonly EligibilityCandidate[];
  readonly durations: readonly DurationChoice[];
  /** Formats worth offering at the chosen duration; empty until one is chosen. */
  readonly formats: readonly FormatChoice[];
  /**
   * Who receives this request and who does not, once duration and format are
   * chosen. Empty-handed before that, because eligibility is a consequence of
   * those answers rather than a property of the shortlist.
   */
  readonly eligibility: FanOutEligibility | null;
  readonly times: readonly Date[];
  readonly nextStep: AskStep;
}

export async function resolveAsk(
  subjectSectionId: string,
  raw: RawSearchParams,
): Promise<ResolvedAsk | null> {
  const context = await resolveDiscoveryContext();
  if (context === null) return null;

  // Server-authoritative: the section must belong to this user. A shortlist is
  // reached only through the section that owns it.
  const section = context.subjectSections.find(
    (candidate) => candidate.subjectSectionId === subjectSectionId,
  );
  if (section === undefined) return null;

  const params = parseAskParams(raw);
  const student = context.students.find(
    (candidate) => candidate.studentProfileId === section.studentProfileId,
  );

  /**
   * The shortlist, resolved through the bookable allow-list.
   *
   * `listShortlist` says who the family saved; `listBookableServices` says what
   * each of them may actually be booked for now. A tutor who has withdrawn the
   * subject since being shortlisted resolves to no versions and is reported as
   * excluded rather than quietly disappearing.
   */
  const entries = await listShortlist(subjectSectionId);
  const candidates: EligibilityCandidate[] = [];
  const priceByVersion = new Map<string, bigint>();

  for (const entry of entries) {
    const services = await listBookableServices({
      tutorReference: entry.tutorReference,
      subjectId: section.subjectId,
    });

    for (const version of services?.versions ?? []) {
      priceByVersion.set(version.serviceVersionId, version.priceAmountMinor);
    }

    candidates.push({
      tutorReference: entry.tutorReference,
      tutorProfileId: services?.tutorProfileId ?? '',
      firstName: entry.firstName,
      versions: (services?.versions ?? []).map((version) => ({
        serviceVersionId: version.serviceVersionId,
        durationMinutes: version.durationMinutes,
        formats: formatsForCode(version.formatCode),
      })),
    });
  }

  const durations = durationChoices(candidates);

  // A duration only counts as answered when the shortlist can still deliver it.
  const duration =
    params.duration !== null && durations.some((row) => row.durationMinutes === params.duration)
      ? params.duration
      : null;

  const formats = duration === null ? [] : formatChoices(candidates, duration);
  const format: LessonFormat | null =
    duration !== null &&
    params.format !== null &&
    formats.some((row) => row.format === params.format)
      ? params.format
      : null;

  const eligibility =
    duration === null || format === null
      ? null
      : resolveFanOutEligibility(candidates, duration, format, (version) =>
          Number(priceByVersion.get(version.serviceVersionId) ?? 0n),
        );

  const times =
    duration === null || format === null
      ? []
      : params.times
          .map((value) => new Date(value))
          .filter((at) => !Number.isNaN(at.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());

  return {
    context,
    section,
    studentName: student?.preferredName ?? null,
    // Cleared answers never travel forward in a link. `week` is not an answer
    // — it is which seven days the times calendar is drawing — so it passes
    // through untouched.
    params: { duration, format, times: times.map((at) => at.toISOString()), week: params.week },
    candidates,
    durations,
    formats,
    eligibility,
    times,
    nextStep: firstUnanswered(duration, format, eligibility, times),
  };
}

function firstUnanswered(
  duration: number | null,
  format: LessonFormat | null,
  eligibility: FanOutEligibility | null,
  times: readonly Date[],
): AskStep {
  if (duration === null) return 'length';
  if (format === null) return 'format';
  // With nobody left to ask, there is no point choosing times: the review
  // screen explains who was excluded and why, which is what the family needs.
  if ((eligibility?.included.length ?? 0) === 0) return 'review';
  if (times.length === 0) return 'times';
  return 'review';
}

export { ASK_STEPS };
