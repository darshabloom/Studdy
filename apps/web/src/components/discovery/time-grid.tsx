'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@studdy/design-system';
import {
  REQUEST_TIME_OPTIONS_MAX,
  REQUEST_TIME_OPTIONS_MIN,
  validateChosenTimes,
} from '@studdy/domain/availability';

export interface TimeGridOption {
  readonly startAtIso: string;
  /** '4:00 pm' — already formatted in the lesson zone by the server. */
  readonly label: string;
  /** First names of the family's own shortlisted tutors who can do this time. */
  readonly tutorNames: readonly string[];
}

export interface TimeGridDay {
  readonly key: string;
  readonly label: string;
  readonly options: readonly TimeGridOption[];
}

export interface TimeGridProps {
  subjectSectionId: string;
  days: readonly TimeGridDay[];
  /** How many tutors the family shortlisted, for "2 of your 3" phrasing. */
  shortlistSize: number;
}

/**
 * Pick the times to ask about.
 *
 * Each option names which of the family's *own* shortlisted tutors can do it.
 * A tutor absent from an option is simply absent — the grid has no vocabulary
 * for saying a time was taken, blocked or outside their hours, because those
 * causes must stay indistinguishable.
 *
 * The bound is enforced again on the server when the request is composed. This
 * only lets the family see what is wrong before they submit.
 */
export function TimeGrid({ subjectSectionId, days, shortlistSize }: TimeGridProps): ReactNode {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const problem = validateChosenTimes(chosen.length);
  const atMax = chosen.length >= REQUEST_TIME_OPTIONS_MAX;

  const toggle = (startAtIso: string): void => {
    setChosen((current) =>
      current.includes(startAtIso)
        ? current.filter((value) => value !== startAtIso)
        : current.length >= REQUEST_TIME_OPTIONS_MAX
          ? current
          : [...current, startAtIso],
    );
  };

  const nextHref = `/requests/new?section=${subjectSectionId}${chosen
    .map((iso) => `&time=${encodeURIComponent(iso)}`)
    .join('')}`;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-5">
        {days.map((day) => (
          <div key={day.key}>
            <h2 className="text-sm font-semibold text-text-primary">{day.label}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {day.options.map((option) => {
                const selected = chosen.includes(option.startAtIso);
                const disabled = !selected && atMax;
                return (
                  <li key={option.startAtIso}>
                    <label
                      className={[
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                        selected
                          ? 'border-brand-purple bg-brand-lavender/40'
                          : 'border-border-subtle',
                        disabled ? 'cursor-not-allowed opacity-50' : '',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-brand-purple"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => {
                          toggle(option.startAtIso);
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium tabular-nums text-text-primary">
                          {option.label}
                        </span>
                        <span className="block text-sm text-text-secondary">
                          {option.tutorNames.length} of your {shortlistSize}
                          {shortlistSize === 1 ? ' tutor' : ' tutors'} can do this ·{' '}
                          {option.tutorNames.join(', ')}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center gap-3 border-t border-surface-border bg-surface-page py-4">
        <p className="text-sm text-text-secondary" role="status">
          {chosen.length} chosen — pick {REQUEST_TIME_OPTIONS_MIN} to {REQUEST_TIME_OPTIONS_MAX}
          {problem !== null ? `. ${problem}` : ''}
        </p>
        <Button asChild={problem === null} disabled={problem !== null}>
          {problem === null ? (
            <Link href={nextHref}>Review request</Link>
          ) : (
            <span>Review request</span>
          )}
        </Button>
      </div>
    </div>
  );
}
