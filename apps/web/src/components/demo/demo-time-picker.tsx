'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { CalendarBlock } from '@studdy/design-system';
import { REQUEST_TIME_OPTIONS_MAX, validateChosenTimes } from '@studdy/domain/availability';
import { DemoCalendar } from './demo-calendar';
import { Chip } from './kit';

/**
 * CHOOSING TIMES, FOR REAL.
 *
 * DETERMINISTIC IS NOT PREDETERMINED. The previous pass pre-selected two times
 * and moved on regardless of what was clicked, which made the most interactive
 * screen in the product a picture of itself. A viewer who cannot change
 * anything has no way to find out what the thing does.
 *
 * So: click a block to choose it, click again to drop it, up to the same
 * one-to-five bound the product enforces (`validateChosenTimes`, imported
 * rather than reimplemented, so the demo cannot drift from the rule). The
 * choice is written into the URL on Continue, and every screen after this one
 * reads it back — review, payment and the confirmed booking all show the times
 * that were actually picked.
 *
 * Determinism survives because the DEFAULT is scripted: an untouched
 * click-through reaches exactly the same screens every time. Only a viewer who
 * deliberately changes something sees something different, which is the whole
 * point of letting them.
 */
export function DemoTimePicker({
  blocks,
  dayLabels,
  todayIndex,
  pastCount,
  defaultSelected,
  continueHref,
  labelFor,
  tutorFirstName,
  durationMinutes,
}: {
  blocks: readonly CalendarBlock[];
  dayLabels: readonly string[];
  todayIndex: number;
  /** Days already gone. Drawn dim so an empty Monday is not read as "busy". */
  pastCount: number;
  /** The scripted choice. Keeps an untouched walkthrough repeatable. */
  defaultSelected: readonly string[];
  continueHref: string;
  labelFor: Readonly<Record<string, string>>;
  tutorFirstName: string;
  durationMinutes: number;
}): ReactNode {
  const router = useRouter();
  const [selected, setSelected] = useState<readonly string[]>(defaultSelected);

  const problem = validateChosenTimes(selected.length);
  const atMax = selected.length >= REQUEST_TIME_OPTIONS_MAX;

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

  const goOn = (): void => {
    const query = new URLSearchParams();
    for (const iso of selected) query.append('time', iso);
    router.push(`${continueHref}?${query.toString()}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13.5px] text-text-secondary">
        Tap the times that would work. Each block is a start; lessons are {durationMinutes} minutes.
        You can offer up to {REQUEST_TIME_OPTIONS_MAX}, and {tutorFirstName} accepts one.
      </p>

      <DemoCalendar
        blocks={blocks}
        dayLabels={dayLabels}
        todayIndex={todayIndex}
        pastCount={pastCount}
        size="picker"
        mode="select"
        familySafe
        selectedIds={selected.map((iso) => `slot:${iso}`)}
        onToggleBlock={toggle}
        ariaLabel={`Bookable times for ${tutorFirstName}`}
        legend={{}}
      />

      <div className="rounded-[6px] border border-surface-border bg-surface-card px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[13.5px] font-semibold text-text-primary" role="status">
            {selected.length === 0
              ? 'No times chosen yet'
              : `${String(selected.length)} time${selected.length === 1 ? '' : 's'} chosen`}
          </p>
          {atMax ? (
            <p className="text-[12px] text-text-muted">
              That is the most you can offer. Remove one to swap it.
            </p>
          ) : null}
        </div>

        {selected.length === 0 ? (
          <p className="mt-2 text-[13px] text-text-muted">
            Pick at least one from the calendar above.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col items-start gap-2">
            {selected.map((iso) => (
              <li key={iso}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected((current) => current.filter((entry) => entry !== iso));
                  }}
                  className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-brand bg-brand-tint px-3.5 py-1 text-[13px] font-medium tabular-nums text-brand-strong transition-colors hover:bg-brand-tint/60 sm:min-h-0 sm:px-3 sm:text-[12.5px]"
                >
                  {labelFor[iso] ?? iso}
                  <span aria-hidden>×</span>
                  <span className="sr-only">Remove this time</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected.length > 1 ? (
          <p className="mt-3 text-[12px] text-text-muted">
            These are alternatives &mdash; {tutorFirstName} will accept at most one.
          </p>
        ) : null}
      </div>

      {/*
       * ON A PHONE, THE DECISION STAYS IN REACH.
       *
       * The calendar is taller than the screen, so a Continue button after it
       * is a scroll away from every tap that matters. Below `sm` this bar
       * sticks just above the bottom navigation, carrying the count and the
       * action; from `sm` up it is an ordinary row, exactly as before.
       */}
      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 -mx-4 flex items-center gap-3 border-y border-surface-border bg-surface-card/95 px-4 py-3 backdrop-blur sm:hidden">
        <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-text-primary">
          {selected.length === 0
            ? 'Tap a time to choose it'
            : `${String(selected.length)} time${selected.length === 1 ? '' : 's'} chosen`}
        </p>
        <button
          type="button"
          disabled={problem !== null}
          onClick={goOn}
          className="inline-flex min-h-[46px] items-center rounded-[6px] bg-brand px-6 text-[15px] font-medium text-brand-contrast disabled:bg-brand-tint disabled:text-brand-strong"
        >
          Continue
        </button>
      </div>

      <div className="hidden flex-wrap items-center gap-4 sm:flex">
        <button
          type="button"
          disabled={problem !== null}
          onClick={goOn}
          className="inline-flex items-center rounded-[5px] border border-transparent bg-brand px-5 py-2.5 text-[15px] font-medium text-brand-contrast transition-colors hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:bg-brand-tint disabled:text-brand-strong"
        >
          Continue
        </button>
        {problem === null ? (
          <p className="text-[13.5px] text-text-secondary">Nothing is sent until you review it.</p>
        ) : (
          <p className="text-[13.5px] text-status-warning">{problem}</p>
        )}
        <Chip tone="ghost">Your choices carry through the rest of the demo</Chip>
      </div>
    </div>
  );
}
