'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { WeekCalendar, type CalendarBlock, type CalendarWindow } from '@studdy/design-system';

/**
 * EVERY CALENDAR IN THE DEMO, THROUGH ONE DOOR.
 *
 * Four rules the pages used to each get wrong on their own:
 *
 * 1. THE WINDOW IS THE HOURS THAT ARE USED, not a default day. The production
 *    `profileCalendarWindow` only ever WIDENS from an 8am–9pm base, so a tutor
 *    who teaches 15:30–19:30 was drawn on a 7am–9pm axis: fifteen hour labels,
 *    eleven of them empty.
 *
 * 2. IT FITS ITS CONTAINER, NOT THE VIEWPORT. This is what was actually broken:
 *    the column count came from `window.innerWidth`, so a 1060px browser asked
 *    for seven columns inside a 558px panel and got a horizontal scrollbar. The
 *    width is now measured off this component's own wrapper, which also fixes
 *    every future placement — a calendar in a narrow grid column simply gets
 *    fewer days without anyone having to notice.
 *
 * 3. COMPRESS BEFORE DROPPING DAYS. Squeezing columns and narrowing the hour
 *    gutter costs a little legibility; removing Thursday costs Thursday. So the
 *    fit is attempted at full width, then tight, and only then at three days
 *    and one, with paging.
 *
 * 4. NEVER A NESTED SCROLLBAR, on either axis. A calendar that scrolls inside a
 *    page that scrolls is two scrollbars competing for one gesture. Height is a
 *    budget divided by the hours on screen; width is whatever the container
 *    gives, with the day count chosen to suit. The page may scroll; this may not.
 */

export type CalendarSize = 'compact' | 'comfortable' | 'picker';

/** Height budgets, in pixels. Chosen so the calendar plus its page chrome fits a laptop. */
const BUDGET: Record<CalendarSize, number> = {
  compact: 290,
  comfortable: 380,
  picker: 440,
};

/** Below this an hour row stops being a usable target; above it, wasted space. */
const MIN_HOUR_HEIGHT = 34;
const MAX_HOUR_HEIGHT = 96;

/** Context kept either side of the used hours, so a band sits at a time of day. */
const CONTEXT_MINUTES = 30;
/** A window narrower than this reads as one block filling the frame. */
const MINIMUM_SPAN_MINUTES = 4 * 60;

/** The hour axis, at its usual width and squeezed. */
const GUTTER_WIDE = 56;
const GUTTER_TIGHT = 42;
/**
 * Narrower than this and a column stops being usable.
 *
 * Not the width at which text technically fits — 66 pixels holds "Mon" and a
 * lesson block, and reads as a barcode. This is the width at which a column is
 * worth having, which is what decides whether a phone gets five cramped days or
 * three legible ones.
 */
const MIN_COLUMN = 78;

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

interface Fit {
  readonly columns: number;
  readonly gutter: number;
  readonly perColumn: number;
}

/**
 * How many days fit, and how tightly.
 *
 * Tries the whole week at a comfortable gutter, then at a tight one, then three
 * days, then one — taking the first arrangement whose columns clear the legible
 * minimum. Nothing here is allowed to return a width the container cannot hold.
 */
function fitFor(width: number, total: number): Fit {
  for (const columns of [total, 3, 1]) {
    if (columns > total) continue;
    for (const gutter of [GUTTER_WIDE, GUTTER_TIGHT]) {
      const perColumn = (width - gutter) / columns;
      if (perColumn >= MIN_COLUMN) return { columns, gutter, perColumn };
    }
  }
  return {
    columns: 1,
    gutter: GUTTER_TIGHT,
    perColumn: Math.max(width - GUTTER_TIGHT, MIN_COLUMN),
  };
}

/** 'Mon 14 Sept' → 'Mon 14' → 'Mon', by how much room a column has. */
function labelAt(label: string, perColumn: number): string {
  if (perColumn >= 96) return label;
  const parts = label.split(' ');
  if (perColumn >= 72) return parts.slice(0, 2).join(' ');
  return parts[0] ?? label;
}

export interface DemoCalendarProps {
  readonly blocks: readonly CalendarBlock[];
  readonly dayLabels: readonly string[];
  readonly ariaLabel: string;
  readonly size?: CalendarSize;
  readonly todayIndex?: number;
  /** How many leading days have already gone. Drawn dim, never dropped. */
  readonly pastCount?: number;
  readonly familySafe?: boolean;
  /** Selection, for the booking pickers. */
  readonly mode?: 'read' | 'select';
  readonly selectedIds?: readonly string[];
  readonly onToggleBlock?: (block: CalendarBlock) => void;
  /** Which roles to explain under the grid, or omitted for none. */
  readonly legend?: { readonly held?: boolean; readonly once?: boolean };
}

export function DemoCalendar({
  blocks,
  dayLabels,
  ariaLabel,
  size = 'comfortable',
  todayIndex = -1,
  pastCount = 0,
  familySafe = false,
  mode = 'read',
  selectedIds = [],
  onToggleBlock,
  legend,
}: DemoCalendarProps): ReactNode {
  const frame = useRef<HTMLDivElement>(null);
  /*
   * Null until measured, and the full week until then.
   *
   * Server-rendered markup has no container to measure, so the first paint is
   * the whole week and the first client pass corrects it. Guessing narrow
   * instead would make every desktop load flash a one-day calendar, which is
   * the more visible of the two wrong answers.
   */
  const [width, setWidth] = useState<number | null>(null);
  // Null until the viewer pages. Until then the view opens on TODAY — a phone
  // showing three days should show the three that matter, not Monday to
  // Wednesday of a week that is half gone.
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (element === null) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured !== undefined && measured > 0) setWidth(measured);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const total = dayLabels.length;
  const fit = width === null ? null : fitFor(width, total);
  const visible = fit === null ? total : Math.min(fit.columns, total);

  // Keep the view from paging past the end when the container widens.
  const maxOffset = Math.max(0, total - visible);
  const anchor = todayIndex >= 0 ? todayIndex : Math.min(pastCount, total - 1);
  const start = Math.max(0, Math.min(offset ?? anchor, maxOffset));

  const shownLabels = dayLabels
    .slice(start, start + visible)
    .map((label) => (fit === null ? label : labelAt(label, fit.perColumn)));

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
  /*
   * A PICKER ON A PHONE NEEDS FINGER-SIZED ROWS.
   *
   * The height budget divides a fixed number of pixels by the hours on screen,
   * so paging onto a day with a morning in it (Saturday's one-off 9am) squeezed
   * every half-hour start down to a sliver. When choosing, and paged down to a
   * few days, an hour never drops below 64px: the page grows instead, which is
   * allowed — it is still the page that scrolls, never the calendar.
   */
  const paged = fit !== null && fit.columns < total;
  const minHour = mode === 'select' && paged ? 64 : MIN_HOUR_HEIGHT;
  const hourHeight = Math.round(
    Math.min(MAX_HOUR_HEIGHT, Math.max(minHour, BUDGET[size] / spanHours)),
  );

  const relativeToday = todayIndex - start;
  const relativePast = Math.max(0, Math.min(pastCount - start, visible));

  return (
    <div ref={frame} className="flex min-w-0 flex-col gap-3">
      {visible < total ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={start === 0}
            onClick={() => {
              setOffset(Math.max(0, start - visible));
            }}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] border border-surface-border bg-surface-card px-3.5 py-2 text-[13.5px] font-medium text-text-primary transition-colors hover:border-brand/40 disabled:opacity-35"
          >
            <span aria-hidden>‹</span> Earlier
          </button>
          <p className="min-w-0 truncate text-center text-[13px] font-semibold tabular-nums text-text-primary">
            {/* The shortened labels the columns use, so the range fits between
                the two buttons on a phone instead of ending in an ellipsis. */}
            {shownLabels[0]}
            {visible > 1 ? ` – ${shownLabels[visible - 1] ?? ''}` : ''}
          </p>
          <button
            type="button"
            disabled={start >= maxOffset}
            onClick={() => {
              setOffset(Math.min(maxOffset, start + visible));
            }}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] border border-surface-border bg-surface-card px-3.5 py-2 text-[13.5px] font-medium text-text-primary transition-colors hover:border-brand/40 disabled:opacity-35"
          >
            Later <span aria-hidden>›</span>
          </button>
        </div>
      ) : null}

      <WeekCalendar
        blocks={shownBlocks}
        window={calendarWindow}
        dayLabels={shownLabels}
        dayCount={visible}
        // The count was chosen from the space available, so a minimum here
        // could only reintroduce the overflow it exists to prevent.
        minColumnWidth={null}
        gutterWidth={`${String(fit?.gutter ?? GUTTER_WIDE)}px`}
        pastDayCount={relativePast}
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
function CalendarLegend({ held, once }: { held: boolean; once: boolean }): ReactNode {
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
