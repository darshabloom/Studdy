'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@studdy/design-system';
import {
  REQUEST_TIME_OPTIONS_MAX,
  TIME_OPTIONS_GUIDANCE,
  validateChosenTimes,
} from '@studdy/domain/availability';

export interface AskTimeOption {
  readonly startAtIso: string;
  /** '4:15' — compact, because the heading has just said how long the lesson is. */
  readonly startLabel: string;
  /** 'Wed 26 Aug · 4:15–5:15 pm' — the whole lesson, for once it is chosen. */
  readonly intervalLabel: string;
  /** First names of the family's OWN included tutors who can do this time. */
  readonly tutorNames: readonly string[];
}

export interface AskTimeDay {
  readonly key: string;
  readonly label: string;
  readonly options: readonly AskTimeOption[];
}

export interface AskTimeGridProps {
  readonly days: readonly AskTimeDay[];
  /** How many tutors this request will actually reach. */
  readonly askingCount: number;
  /** Where Continue goes, WITHOUT the chosen times; they are appended here. */
  readonly reviewHref: string;
  /** Already-chosen starts, from the URL. */
  readonly chosen: readonly string[];
}

/**
 * Pick the times to ask about.
 *
 * Each option names which of the family's OWN included tutors can do it. A
 * tutor absent from an option is simply absent — this grid has no vocabulary
 * for saying a time was taken, blocked or outside their hours, because those
 * causes must stay indistinguishable from one another.
 *
 * A COMPACT START ON THE GRID, THE WHOLE INTERVAL ONCE CHOSEN. Every included
 * tutor shares one lesson length, so a start means exactly one interval for all
 * of them — which is why the length is asked first, and why a chosen time can
 * be written as `4:15–5:15 pm` here at all.
 *
 * The bound is enforced again on the server. This only lets the family see what
 * is wrong before they submit.
 */
export function AskTimeGrid({
  days,
  askingCount,
  reviewHref,
  chosen: initial,
}: AskTimeGridProps): ReactNode {
  const [chosen, setChosen] = useState<readonly string[]>(initial);
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

  const labelFor = new Map(
    days.flatMap((day) => day.options.map((option) => [option.startAtIso, option.intervalLabel])),
  );

  const separator = reviewHref.includes('?') ? '&' : '?';
  const nextHref = `${reviewHref}${chosen
    .map((iso, index) => `${index === 0 ? separator : '&'}time=${encodeURIComponent(iso)}`)
    .join('')}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-md text-sm text-text-secondary">{TIME_OPTIONS_GUIDANCE}</p>

      <div className="flex flex-col gap-5">
        {days.map((day) => (
          <div key={day.key}>
            <h3 className="text-sm font-semibold text-text-primary">{day.label}</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {day.options.map((option) => {
                const selected = chosen.includes(option.startAtIso);
                const disabled = !selected && atMax;
                return (
                  <li key={option.startAtIso}>
                    <label
                      className={[
                        'flex cursor-pointer items-center gap-3 rounded-[var(--radius-medium)] border p-3 transition-colors',
                        selected
                          ? 'border-brand-purple bg-brand-lavender/40'
                          : 'border-surface-border bg-surface-card hover:border-brand-purple/50',
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
                          {option.startLabel}
                        </span>
                        <span className="block text-sm text-text-secondary">
                          {option.tutorNames.length} of {askingCount}
                          {askingCount === 1 ? ' tutor' : ' tutors'} can do this ·{' '}
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

      {/*
       * STAYS IN VIEW. Quarter-hour starts across a fortnight make this list
       * thousands of pixels long, so a selection summary and a Continue button
       * that scroll away with it are effectively unreachable — a family would
       * choose a time and then have to hunt for the way on. The grid it
       * replaced kept its action bar pinned for exactly this reason; dropping
       * that in the rewrite was an accident rather than a decision.
       */}
      <div className="sticky bottom-0 z-10 rounded-[var(--radius-medium)] border border-surface-border bg-surface-card-secondary p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <p className="text-sm font-semibold text-text-primary" role="status">
          {chosen.length === 0
            ? 'No preferred times chosen yet'
            : `${String(chosen.length)} preferred time${chosen.length === 1 ? '' : 's'} chosen`}
        </p>
        {chosen.length > 1 ? (
          // The one thing a list of times gets misread as, said beside the list.
          <p className="mt-0.5 text-xs text-text-muted">
            These are alternatives — one tutor can accept any one of them.
          </p>
        ) : null}
        {chosen.length > 0 ? (
          // One per line: several full intervals flowing together read as one
          // long span rather than as separate choices.
          <ul className="mt-2 flex flex-col items-start gap-1.5">
            {chosen.map((iso) => (
              <li key={iso}>
                <button
                  type="button"
                  onClick={() => {
                    toggle(iso);
                  }}
                  className="rounded-[var(--radius-pill)] border border-brand-purple bg-brand-lavender px-3 py-1 text-xs font-medium text-brand-purple-deep hover:bg-brand-lavender/70"
                >
                  {labelFor.get(iso) ?? iso} <span aria-hidden>×</span>
                  <span className="sr-only">Remove this time</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {atMax ? (
          <p className="mt-2 text-xs text-text-muted">
            That is the most you can offer. Remove one to choose a different time.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button asChild={problem === null} disabled={problem !== null}>
            {problem === null ? <Link href={nextHref}>Continue</Link> : <span>Continue</span>}
          </Button>
          {problem !== null ? <p className="text-sm text-text-secondary">{problem}</p> : null}
        </div>
      </div>
    </div>
  );
}
