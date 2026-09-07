'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { WeekCalendar, type CalendarBlock, type CalendarWindow } from '@studdy/design-system';

/**
 * EVERY CALENDAR IN THE DEMO, THROUGH ONE DOOR.
 *
 * Three rules the pages used to each get wrong on their own:
 *
 * 1. THE WINDOW IS THE HOURS THAT ARE USED, not a default day. The production
 *    `profileCalendarWindow` only ever WIDENS from an 8am–9pm base, so a tutor
 *    who teaches 15:30–19:30 was drawn on a 7am–9pm axis: fifteen hour labels,
 *    eleven of them empty. Here the axis is fitted to the blocks, rounded out
 *    to the hour with a little context, and only stretched to a floor so a
 *    single lesson does not fill the frame.
 *
 * 2. THE CALENDAR FITS THE VIEWPORT. Its height is a budget divided by the
 *    hours on screen, not a fixed pixels-per-hour multiplied by however many
 *    hours the data happens to span — which is how the times picker reached
 *    1,618 pixels. NEVER SOLVED WITH A NESTED SCROLLBAR: a calendar that
 *    scrolls inside a page that scrolls is two scrollbars competing for the
 *    same gesture. The page may scroll; this may not.
 *
 * 3. SEVEN COLUMNS NEED ROOM. Below roughly 1024px the week becomes three days,
 *    and below 640px a single day, with the caller paging between them. The
 *    alternative is columns narrower than the words inside them.
 */

export type CalendarSize = 'compact' | 'comfortable' | 'picker';

/** Height budgets, in pixels. Chosen so the calendar plus its page chrome fits a laptop. */
const BUDGET: Record<CalendarSize, number> = {
  compact: 300,
  comfortable: 400,
  picker: 460,
};

/** Below this an hour row stops being a usable target; above it, wasted space. */
const MIN_HOUR_HEIGHT = 34;
const MAX_HOUR_HEIGHT = 96;

/** Context kept either side of the used hours, so a band sits at a time of day. */
const CONTEXT_MINUTES = 30;
/** A window narrower than this reads as one block filling the frame. */
const MINIMUM_SPAN_MINUTES = 4 * 60;

/**
 * The hours actually in use, rounded out to whole hours with a little context.
 *
 * Falls back to a late-afternoon window when there is nothing to fit, because
 * an empty calendar still has to be a calendar of some particular hours.
 */
export function demoWindow(blocks: readonly CalendarBlock[]): CalendarWindow {
  if (blocks.length === 0) return { dayStartMinutes: 15 * 60, dayEndMinutes: 20 * 60 };

  let start = Math.min(...blocks.map((block) => block.startMinutes)) - CONTEXT_MINUTES;
  let end = Math.max(...blocks.map((block) => block.endMinutes)) + CONTEXT_MINUTES;
  start = Math.floor(start / 60) * 60;
  end = Math.ceil(end / 60) * 60;

  const short = MINIMUM_SPAN_MINUTES - (end - start);
  if (short > 0) {
    start -= Math.floor(short / 2);
    end += Math.ceil(short / 2);
  }
  // Push back off either end of the day rather than clipping the span short.
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > 24 * 60) {
    start -= end - 24 * 60;
    end = 24 * 60;
  }
  return { dayStartMinutes: Math.max(start, 0), dayEndMinutes: Math.min(end, 24 * 60) };
}

/** How many columns fit at this width. */
function columnsFor(width: number): number {
  if (width >= 1024) return 7;
  if (width >= 640) return 3;
  return 1;
}

export interface DemoCalendarProps {
  readonly blocks: readonly CalendarBlock[];
  readonly dayLabels: readonly string[];
  readonly ariaLabel: string;
  readonly size?: CalendarSize;
  readonly todayIndex?: number;
  readonly familySafe?: boolean;
  /** Selection, for the booking pickers. */
  readonly mode?: 'read' | 'select';
  readonly selectedIds?: readonly string[];
  readonly onToggleBlock?: (block: CalendarBlock) => void;
  /**
   * Which roles to explain under the grid, or omitted for none.
   *
   * A description rather than an element. Passing the legend in as JSX meant a
   * server component handing a React element to a client one on every page,
   * which React warns about and which buys nothing — the legend belongs to the
   * calendar, and the calendar knows what it is drawing.
   */
  readonly legend?: { readonly held?: boolean; readonly once?: boolean };
}

export function DemoCalendar({
  blocks,
  dayLabels,
  ariaLabel,
  size = 'comfortable',
  todayIndex = -1,
  familySafe = false,
  mode = 'read',
  selectedIds = [],
  onToggleBlock,
  legend,
}: DemoCalendarProps): ReactNode {
  /*
   * Starts at the full week and narrows once mounted.
   *
   * Server-rendered markup has no viewport, so it renders the desktop week and
   * the first client pass corrects it. Guessing narrow instead would make every
   * desktop load flash a one-day calendar, which is the more visible wrong
   * answer of the two.
   */
  const [columns, setColumns] = useState(7);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const measure = (): void => {
      setColumns(columnsFor(window.innerWidth));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);

  const total = dayLabels.length;
  const visible = Math.min(columns, total);
  // Keep the page from paging past the end when the viewport widens.
  const maxOffset = Math.max(0, total - visible);
  const start = Math.min(offset, maxOffset);

  const shownLabels = dayLabels.slice(start, start + visible);
  const shownBlocks = blocks
    .filter((block) => block.dayIndex >= start && block.dayIndex < start + visible)
    .map((block) => ({ ...block, dayIndex: block.dayIndex - start }));

  // Fitted to what is ON SCREEN, so paging to a quiet day does not keep a busy
  // day's axis and draw four empty hours.
  const calendarWindow = demoWindow(shownBlocks.length > 0 ? shownBlocks : blocks);
  const spanHours = Math.max(
    (calendarWindow.dayEndMinutes - calendarWindow.dayStartMinutes) / 60,
    1,
  );
  const hourHeight = Math.round(
    Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, BUDGET[size] / spanHours)),
  );

  const relativeToday = todayIndex - start;

  return (
    <div className="flex flex-col gap-3">
      {visible < total ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={start === 0}
            onClick={() => {
              setOffset(Math.max(0, start - visible));
            }}
            className="rounded-[4px] border border-surface-border px-3 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-brand/40 hover:text-text-primary disabled:opacity-40"
          >
            ← Earlier
          </button>
          <p className="text-[12.5px] font-medium tabular-nums text-text-secondary">
            {shownLabels[0]}
            {visible > 1 ? ` – ${shownLabels[shownLabels.length - 1] ?? ''}` : ''}
          </p>
          <button
            type="button"
            disabled={start >= maxOffset}
            onClick={() => {
              setOffset(Math.min(maxOffset, start + visible));
            }}
            className="rounded-[4px] border border-surface-border px-3 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-brand/40 hover:text-text-primary disabled:opacity-40"
          >
            Later →
          </button>
        </div>
      ) : null}

      <WeekCalendar
        blocks={shownBlocks}
        window={calendarWindow}
        dayLabels={shownLabels}
        dayCount={visible}
        hourHeight={hourHeight}
        mode={mode}
        selectedIds={selectedIds}
        familySafe={familySafe}
        ariaLabel={ariaLabel}
        {...(onToggleBlock === undefined ? {} : { onToggleBlock })}
        {...(relativeToday >= 0 && relativeToday < visible
          ? { now: { dayIndex: relativeToday, minutes: calendarWindow.dayStartMinutes } }
          : {})}
      />

      {legend === undefined ? null : (
        <CalendarLegend held={legend.held ?? false} once={legend.once ?? false} />
      )}
    </div>
  );
}

/** What the colours mean. Rendered by `DemoCalendar` when it is asked for. */
function CalendarLegend({
  held = false,
  once = false,
}: {
  held?: boolean;
  once?: boolean;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-text-secondary">
      <Key className="border border-brand/25 bg-brand-tint">Bookable</Key>
      <Key className="bg-brand">Booked lesson</Key>
      {once ? (
        <Key className="border border-dashed border-brand/50 bg-brand-tint/50">One-off hours</Key>
      ) : null}
      {held ? (
        <Key className="border border-dashed border-status-warning bg-status-warning-bg">
          Held, awaiting a decision
        </Key>
      ) : null}
    </div>
  );
}

function Key({ className, children }: { className: string; children: ReactNode }): ReactNode {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={`h-[12px] w-[20px] rounded-[2px] ${className}`} />
      {children}
    </span>
  );
}
