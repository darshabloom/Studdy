import type { LessonFormat } from '../availability/index';

/**
 * Who a multi-tutor request can actually go to, and why anyone is left out.
 *
 * ONE REQUEST MEANS ONE LESSON. A family asking three tutors is asking for one
 * lesson, so a chosen start has to mean the same interval for every tutor who
 * receives it. Letting 4:15 be a 60-minute lesson for one tutor and a 90-minute
 * lesson for another would make the request unanswerable: whichever tutor
 * accepted, the family would have agreed to something they never saw.
 *
 * So the family chooses the duration and the format FIRST, and those choices
 * decide who is eligible — not the other way round.
 *
 * NOBODY IS EVER SILENTLY DROPPED. A shortlisted tutor who cannot take the
 * request is reported with a plain reason, because the family put them on that
 * list deliberately and is entitled to know what became of them. A tutor
 * quietly missing from a request is indistinguishable, to the family, from a
 * tutor who declined.
 *
 * Pure and free of any database: this is a rule about what a request may
 * contain, and it is worth testing without one.
 */

export interface EligibilityVersion {
  readonly serviceVersionId: string;
  readonly durationMinutes: number;
  /** What this version may be delivered as. */
  readonly formats: readonly LessonFormat[];
}

export interface EligibilityCandidate {
  readonly tutorReference: string;
  readonly tutorProfileId: string;
  readonly firstName: string;
  /** This tutor's published, current versions for the subject in question. */
  readonly versions: readonly EligibilityVersion[];
}

/** Why a shortlisted tutor is not receiving this request. */
export type ExclusionReason = 'duration' | 'format' | 'subject';

export interface IncludedTutor {
  readonly tutorReference: string;
  readonly tutorProfileId: string;
  readonly firstName: string;
  /** The exact version this tutor would be asked about. */
  readonly serviceVersionId: string;
  readonly durationMinutes: number;
}

export interface ExcludedTutor {
  readonly tutorReference: string;
  readonly firstName: string;
  readonly reason: ExclusionReason;
}

export interface FanOutEligibility {
  readonly included: readonly IncludedTutor[];
  readonly excluded: readonly ExcludedTutor[];
}

/** A duration the family could choose, and how much of their shortlist it reaches. */
export interface DurationChoice {
  readonly durationMinutes: number;
  /** Shortlisted tutors who publish this duration for the subject. */
  readonly tutorCount: number;
  /** Shortlisted tutors offering the subject at all — the honest denominator. */
  readonly ofTutors: number;
}

/** A format the family could choose, given a duration already chosen. */
export interface FormatChoice {
  readonly format: LessonFormat;
  readonly tutorCount: number;
  readonly ofTutors: number;
}

function teachesSubject(candidate: EligibilityCandidate): boolean {
  return candidate.versions.length > 0;
}

/**
 * The lesson lengths worth offering, longest-reaching first is NOT the order —
 * they are ordered by duration, because a family is choosing a lesson, not
 * optimising coverage. The counts are shown beside each so the trade-off is
 * visible without being made for them.
 */
export function durationChoices(
  candidates: readonly EligibilityCandidate[],
): readonly DurationChoice[] {
  const offering = candidates.filter(teachesSubject);
  const counts = new Map<number, number>();

  for (const candidate of offering) {
    // A tutor publishing the same length twice still counts once: this is
    // "how many tutors could take a 60-minute lesson", not how many rows exist.
    const durations = new Set(candidate.versions.map((version) => version.durationMinutes));
    for (const duration of durations) {
      counts.set(duration, (counts.get(duration) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([durationMinutes, tutorCount]) => ({
      durationMinutes,
      tutorCount,
      ofTutors: offering.length,
    }))
    .sort((a, b) => a.durationMinutes - b.durationMinutes);
}

/**
 * The formats worth offering, once a duration is chosen.
 *
 * Only formats at least one otherwise-compatible tutor can deliver: offering
 * "in person" when nobody left teaches that way would be inviting the family to
 * empty their own request.
 */
export function formatChoices(
  candidates: readonly EligibilityCandidate[],
  durationMinutes: number,
): readonly FormatChoice[] {
  const atDuration = candidates.filter((candidate) =>
    candidate.versions.some((version) => version.durationMinutes === durationMinutes),
  );

  const counts = new Map<LessonFormat, number>();
  for (const candidate of atDuration) {
    const formats = new Set<LessonFormat>();
    for (const version of candidate.versions) {
      if (version.durationMinutes !== durationMinutes) continue;
      for (const format of version.formats) formats.add(format);
    }
    for (const format of formats) counts.set(format, (counts.get(format) ?? 0) + 1);
  }

  return (['online', 'in_person'] as const)
    .filter((format) => (counts.get(format) ?? 0) > 0)
    .map((format) => ({
      format,
      tutorCount: counts.get(format) ?? 0,
      ofTutors: atDuration.length,
    }));
}

/**
 * Split the shortlist into who receives this request and who does not.
 *
 * The reason reported is the FIRST thing that rules a tutor out, in the order
 * the family made the choices: subject, then duration, then format. That keeps
 * the explanation the one the family can act on — being told "doesn't teach it
 * in person" is useless if they do not teach the subject at all any more.
 *
 * Where a tutor has several versions matching the duration and format, the
 * cheapest is taken, so an unstated preference is never the dearest option a
 * tutor happens to publish.
 */
export function resolveFanOutEligibility(
  candidates: readonly EligibilityCandidate[],
  durationMinutes: number,
  format: LessonFormat,
  priceOf?: (version: EligibilityVersion) => number,
): FanOutEligibility {
  const included: IncludedTutor[] = [];
  const excluded: ExcludedTutor[] = [];

  for (const candidate of candidates) {
    if (!teachesSubject(candidate)) {
      excluded.push({
        tutorReference: candidate.tutorReference,
        firstName: candidate.firstName,
        reason: 'subject',
      });
      continue;
    }

    const atDuration = candidate.versions.filter(
      (version) => version.durationMinutes === durationMinutes,
    );
    if (atDuration.length === 0) {
      excluded.push({
        tutorReference: candidate.tutorReference,
        firstName: candidate.firstName,
        reason: 'duration',
      });
      continue;
    }

    const usable = atDuration.filter((version) => version.formats.includes(format));
    if (usable.length === 0) {
      excluded.push({
        tutorReference: candidate.tutorReference,
        firstName: candidate.firstName,
        reason: 'format',
      });
      continue;
    }

    const chosen =
      priceOf === undefined ? usable[0]! : [...usable].sort((a, b) => priceOf(a) - priceOf(b))[0]!;

    included.push({
      tutorReference: candidate.tutorReference,
      tutorProfileId: candidate.tutorProfileId,
      firstName: candidate.firstName,
      serviceVersionId: chosen.serviceVersionId,
      durationMinutes: chosen.durationMinutes,
    });
  }

  return { included, excluded };
}

/** Neutral, and about the lesson rather than about the tutor. */
export function exclusionLabel(
  reason: ExclusionReason,
  durationMinutes: number,
  format: LessonFormat,
  subjectDisplayName: string,
): string {
  if (reason === 'subject') return `No longer offers ${subjectDisplayName}`;
  if (reason === 'duration') {
    return `Doesn't offer ${String(durationMinutes)}-minute ${subjectDisplayName} lessons`;
  }
  return format === 'online'
    ? `Doesn't teach this lesson online`
    : `Doesn't teach this lesson in person`;
}
