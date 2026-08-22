import Link from 'next/link';
import {
  WeekCalendar,
  clockLabel,
  type CalendarBlock,
  type CalendarWindow,
} from '@studdy/design-system';
import type { ReactNode } from 'react';
import type { AvailabilityPrompt } from '@/lib/discovery/availability-view';

export interface TutorAvailabilityMiniProps {
  readonly tutorName: string;
  /**
   * Derived positive bookable slots ONLY, already projected by
   * `bookableSlotBlocks`. Undefined means this visitor is not entitled to
   * derived availability at all — which is not the same as having none.
   */
  readonly blocks: readonly CalendarBlock[] | undefined;
  /** Shared across every card on the page, so cards can be compared by eye. */
  readonly window: CalendarWindow;
  readonly dayLabels: readonly string[];
  readonly rangeLabel: string;
  /** Screen-reader equivalent of the picture, from `availabilitySummary`. */
  readonly summary: readonly string[];
  /** Which column is today, or -1 when today is not in this window. */
  readonly todayIndex: number;
  /** Shown INSTEAD of a calendar when `blocks` is undefined. */
  readonly prompt: AvailabilityPrompt;
}

/**
 * A tutor's next seven days, at a glance, on a discovery card.
 *
 * The question this answers is "does this tutor generally fit our schedule?",
 * and that is a question about SHAPE — weekday evenings, weekend mornings. So
 * this is a real week grid shrunk, not a density heatmap: a block sits at its
 * own day and its own hour, and every card shares one vertical scale, so a
 * parent scanning a page of tutors is comparing like with like.
 *
 * NOTHING HERE CAN EXPLAIN A GAP, because nothing here knows why one exists.
 * The blocks arrive as derived positive slots and `familySafe` refuses anything
 * else, so a full calendar, a private block, a holiday and ordinary time off
 * all render identically: as absence.
 */
export function TutorAvailabilityMini({
  tutorName,
  blocks,
  window,
  dayLabels,
  rangeLabel,
  summary,
  todayIndex,
  prompt,
}: TutorAvailabilityMiniProps): ReactNode {
  // NOT an empty calendar. Seven empty columns would read as "this tutor has
  // nothing free", which is a claim we have not made and may not be true — a
  // signed-out visitor is simply not shown derived availability at all.
  if (blocks === undefined) {
    return (
      <div className="rounded-[var(--radius-medium)] border border-dashed border-surface-border bg-surface-card-secondary px-3 py-3">
        <p className="text-sm text-text-secondary">
          <Link
            href={prompt.href}
            className="font-medium text-brand-purple-deep underline underline-offset-2 hover:text-brand-purple"
          >
            {prompt.linkLabel}
          </Link>{' '}
          {prompt.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-text-primary">Next 7 days</p>
        <p className="truncate text-[11px] tabular-nums text-text-muted">{rangeLabel}</p>
      </div>

      {blocks.length === 0 ? (
        // Honest and specific: this IS the derived answer for these seven days,
        // so it may say so — but only about the days on screen, and without
        // offering a reason for any of them.
        <div className="rounded-[var(--radius-medium)] border border-surface-border bg-surface-card-secondary px-3 py-4">
          <p className="text-xs text-text-muted">No bookable times in the next 7 days.</p>
        </div>
      ) : (
        <div className="flex items-stretch gap-1.5">
          {/* Mini drops the time axis, so the range is stated once at the edge
              rather than lost — a shape with no hours attached is a pattern
              nobody can act on. */}
          <div
            aria-hidden
            className="flex w-8 shrink-0 flex-col justify-between pb-1 pt-5 text-right text-[10px] leading-none tabular-nums text-text-muted"
          >
            <span>{clockLabel(window.dayStartMinutes)}</span>
            <span>{clockLabel(window.dayEndMinutes)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <WeekCalendar
              blocks={blocks}
              window={window}
              mode="read"
              density="mini"
              dayLabels={dayLabels}
              familySafe
              {...(todayIndex >= 0
                ? // Marks today's column heading. Mini has no room for a
                  // 'Today' label, and none to lose a column to one.
                  { now: { dayIndex: todayIndex, minutes: window.dayStartMinutes } }
                : {})}
              ariaLabel={`Bookable times for ${tutorName}, next 7 days`}
            />
          </div>
        </div>
      )}

      <p className="sr-only">
        {summary.length === 0
          ? `No bookable times for ${tutorName} in the next 7 days.`
          : `Bookable times for ${tutorName}: ${summary.join('. ')}.`}
      </p>
    </div>
  );
}
