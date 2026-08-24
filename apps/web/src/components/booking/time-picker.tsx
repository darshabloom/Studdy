'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  WeekCalendar,
  type CalendarBlock,
  type CalendarWindow,
} from '@studdy/design-system';
import {
  REQUEST_TIME_OPTIONS_MAX,
  TIME_OPTIONS_GUIDANCE,
  validateChosenTimes,
} from '@studdy/domain/availability';

export interface TimePickerProps {
  readonly tutorName: string;
  /** Derived positive slots, UNMERGED: each is one bookable start. */
  readonly blocks: readonly CalendarBlock[];
  readonly window: CalendarWindow;
  readonly dayLabels: readonly string[];
  readonly rangeLabel: string;
  readonly summary: readonly string[];
  readonly todayIndex: number;
  readonly previousHref: string | null;
  readonly nextHref: string | null;
  readonly horizonDays: number;
  /** e.g. "Lessons are 90 minutes long." Stated once, not redrawn per block. */
  readonly lessonLengthLabel: string;
  /** Already-chosen starts as ISO strings, from the URL. */
  readonly chosen: readonly string[];
  /**
   * Where Continue goes, WITHOUT the chosen times.
   *
   * A string rather than a function: props from a server component have to be
   * serialisable, and a callback would fail at runtime rather than at build.
   * The chosen times are appended here, in the browser, where they live.
   */
  readonly reviewHref: string;
  /** Labels for the chosen times, keyed by ISO string. */
  readonly labelFor: Readonly<Record<string, string>>;
}

/**
 * Choosing the times to ask about.
 *
 * EVERY BLOCK IS ONE START TIME, and they are deliberately not merged into
 * bands the way the read-only calendars are. A four o'clock lesson and a half
 * past four one are different things to choose between, and merging them into
 * "4 pm – 7 pm" would erase exactly the distinction this screen exists to make.
 *
 * The family may pick one. Offering several genuinely helps — it is what stops
 * a tutor's full diary ending the conversation — so the copy says so and the
 * bound permits one, which is the difference between encouraging and requiring.
 */
export function TimePicker({
  tutorName,
  blocks,
  window,
  dayLabels,
  rangeLabel,
  summary,
  todayIndex,
  previousHref,
  nextHref,
  horizonDays,
  lessonLengthLabel,
  chosen,
  reviewHref,
  labelFor,
}: TimePickerProps): ReactNode {
  const router = useRouter();
  const [selected, setSelected] = useState<readonly string[]>(chosen);

  const atMax = selected.length >= REQUEST_TIME_OPTIONS_MAX;
  const problem = validateChosenTimes(selected.length);

  const toggle = (block: CalendarBlock): void => {
    const iso = block.id.replace(/^slot:/, '');
    setSelected((current) =>
      current.includes(iso)
        ? current.filter((entry) => entry !== iso)
        : current.length >= REQUEST_TIME_OPTIONS_MAX
          ? current
          : [...current, iso],
    );
  };

  // Selection lives in this component while the family is picking, and only
  // reaches the URL when they move on — so a week change carries it with them
  // rather than losing it, and every click is not a navigation.
  const selectedIds = selected.map((iso) => `slot:${iso}`);
  const goto = (href: string): void => {
    router.push(href);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-md text-sm text-text-secondary">{TIME_OPTIONS_GUIDANCE}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={previousHref === null}
            onClick={() => {
              if (previousHref !== null) goto(withTimes(previousHref, selected));
            }}
          >
            ← Earlier
          </Button>
          <p className="min-w-[11rem] text-center text-sm font-medium tabular-nums text-text-primary">
            {rangeLabel}
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={nextHref === null}
            onClick={() => {
              if (nextHref !== null) goto(withTimes(nextHref, selected));
            }}
          >
            Later →
          </Button>
        </div>
      </div>

      {blocks.length > 0 ? (
        // Says what a block IS, since it marks a start rather than filling the
        // lesson's length. Without this the grid quietly under-reports how much
        // of the afternoon a lesson would take.
        <p className="text-xs text-text-muted">
          Each block is a time the lesson could start. {lessonLengthLabel}
        </p>
      ) : null}

      {blocks.length === 0 ? (
        <Alert tone="information" title={`No times in these seven days`}>
          {tutorName} has nothing bookable between {rangeLabel}.{' '}
          {nextHref === null ? 'Try the earlier days.' : 'Try the later days.'}
        </Alert>
      ) : (
        <WeekCalendar
          blocks={blocks}
          window={window}
          mode="select"
          /*
           * Tall enough that a QUARTER-hour start carries its own time and is
           * a comfortable target on a phone. At the default scale a fifteen
           * minute marker is eleven pixels — too short for its own label and
           * an unkind thing to ask a thumb to hit.
           *
           * 128 rather than 112 because a marker must clear the label
           * threshold with room to spare. At 112 a quarter-hour block is
           * exactly twenty-eight pixels, the threshold itself, so whether a
           * start showed its own time came down to how the body height
           * rounded — some windows labelled, some did not, for no reason a
           * reader could see. The window is fitted to this tutor, so the extra
           * height buys legibility rather than empty hours.
           */
          hourHeight={128}
          dayLabels={dayLabels}
          selectedIds={selectedIds}
          familySafe
          {...(todayIndex >= 0
            ? { now: { dayIndex: todayIndex, minutes: window.dayStartMinutes } }
            : {})}
          onToggleBlock={toggle}
          ariaLabel={`Bookable times for ${tutorName}, ${rangeLabel}`}
        />
      )}

      {blocks.length > 0 ? (
        // Same hint the tutor profile carries, for the same reason: seven
        // columns cannot fit a phone, and said only where it is true.
        <p className="text-xs text-text-muted md:hidden">Scroll sideways to see the whole week.</p>
      ) : null}

      <p className="sr-only">
        {summary.length === 0
          ? `No bookable times for ${tutorName} between ${rangeLabel}.`
          : `Bookable times for ${tutorName}: ${summary.join('. ')}.`}
      </p>

      <div className="rounded-[var(--radius-medium)] border border-surface-border bg-surface-card-secondary p-4">
        <p className="text-sm font-semibold text-text-primary">
          {selected.length === 0
            ? 'No times chosen yet'
            : `${String(selected.length)} time${selected.length === 1 ? '' : 's'} chosen`}
        </p>
        {selected.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {selected.map((iso) => (
              <li key={iso}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected((current) => current.filter((entry) => entry !== iso));
                  }}
                  className="rounded-[var(--radius-pill)] border border-brand-purple bg-brand-lavender px-3 py-1 text-xs font-medium text-brand-purple-deep hover:bg-brand-lavender/70"
                >
                  {labelFor[iso] ?? iso} <span aria-hidden>×</span>
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
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={problem !== null}
          onClick={() => {
            goto(withTimes(reviewHref, selected));
          }}
        >
          Continue
        </Button>
        {problem !== null ? <p className="text-sm text-text-secondary">{problem}</p> : null}
      </div>

      <p className="text-xs text-text-muted">
        {tutorName} publishes availability {horizonDays} days ahead.{' '}
        <Link href="/tutors" className="text-brand-purple hover:underline">
          Browse other tutors
        </Link>
      </p>
    </div>
  );
}

/**
 * Put the current selection onto a link.
 *
 * Used for Continue and for both week controls, so paging to another week
 * carries the times already chosen instead of quietly dropping them.
 */
function withTimes(href: string, selected: readonly string[]): string {
  const url = new URL(href, 'http://placeholder.invalid');
  url.searchParams.delete('time');
  for (const iso of selected) url.searchParams.append('time', iso);
  return `${url.pathname}${url.search}`;
}
