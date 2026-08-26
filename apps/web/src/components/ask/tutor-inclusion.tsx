import type { ReactNode } from 'react';
import { exclusionLabel, type FanOutEligibility } from '@studdy/domain/bookings';
import type { LessonFormat } from '@studdy/domain/availability';

export interface TutorInclusionProps {
  readonly eligibility: FanOutEligibility;
  readonly durationMinutes: number;
  readonly format: LessonFormat;
  readonly subjectDisplayName: string;
}

/**
 * Who this request reaches, and who it does not.
 *
 * NOBODY IS SILENTLY DROPPED. The family put every one of these tutors on the
 * list deliberately, so a tutor who cannot take the request is shown with a
 * plain reason rather than quietly omitted — a tutor missing from a request is,
 * to the family, indistinguishable from one who declined it.
 *
 * The reasons describe the LESSON, never the tutor: "Doesn't offer 60-minute
 * Mathematics lessons" is a fact about what they publish, where anything about
 * their diary would be a fact about them.
 */
export function TutorInclusion({
  eligibility,
  durationMinutes,
  format,
  subjectDisplayName,
}: TutorInclusionProps): ReactNode {
  const { included, excluded } = eligibility;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          {included.length === 0
            ? 'No tutors can take this request'
            : `Asking ${String(included.length)} ${included.length === 1 ? 'tutor' : 'tutors'}`}
        </h3>
        {included.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {included.map((entry) => (
              <li
                key={entry.tutorReference}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-medium)] border border-brand-purple/40 bg-brand-lavender/30 px-3 py-2.5"
              >
                <span className="font-medium text-text-primary">{entry.firstName}</span>
                <span className="shrink-0 text-xs font-medium text-brand-purple-deep tabular-nums">
                  {String(entry.durationMinutes)} minutes ·{' '}
                  {format === 'online' ? 'Online' : 'In person'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {excluded.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Not included{' '}
            <span className="font-normal text-text-muted">
              ({String(excluded.length)} of {String(included.length + excluded.length)} shortlisted)
            </span>
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {excluded.map((entry) => (
              <li
                key={entry.tutorReference}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[var(--radius-medium)] border border-dashed border-surface-border px-3 py-2.5"
              >
                <span className="font-medium text-text-secondary">{entry.firstName}</span>
                <span className="shrink-0 text-xs text-text-muted">
                  {exclusionLabel(entry.reason, durationMinutes, format, subjectDisplayName)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-muted">
            They stay on your shortlist. Change the length or the format above, or ask them on their
            own.
          </p>
        </div>
      ) : null}
    </div>
  );
}
