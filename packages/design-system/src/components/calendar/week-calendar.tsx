'use client';

import { clsx } from 'clsx';
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  assertFamilySafe,
  blockPosition,
  clockLabel,
  draggedRange,
  hourMarks,
  minutesAtOffset,
  WEEKDAY_COLUMN_LABELS,
  type CalendarBlock,
  type CalendarBlockRole,
  type CalendarWindow,
} from './geometry';

/**
 * One week calendar for the whole product.
 *
 * The same grid serves the tutor editing their hours, a family glancing at a
 * discovery card, a tutor profile, the booking journey and the combined
 * multi-tutor view. Four separate time pickers would drift apart in behaviour
 * and in what they leak; one component with modes cannot.
 *
 * LAID OUT AS A WEEK, NOT AS SEVEN LISTS. Days are columns, time runs down a
 * gutter on the left, and a block sits at its own start and end. The header and
 * the scrolling body are two grids sharing one column template, so the day
 * headings stay above their columns as the hours scroll under them.
 *
 * Row height is expressed in PIXELS PER HOUR rather than as a fixed height for
 * the whole day. A calendar showing eight hours and one showing fourteen then
 * read at the same scale, and neither leaves a screen of empty space behind.
 *
 * THE PRIVACY BOUNDARY IS THE PROJECTION, NOT THE COMPONENT. This grid renders
 * whatever blocks it is given and cannot tell a derived bookable slot from a
 * raw availability rule. `familySafe` turns passing the wrong one into a loud
 * failure — set it on every family-facing calendar, including the tutor's own
 * "preview as a family" view, which must be fed the same derived projection a
 * family gets rather than the rules behind it.
 */
export type WeekCalendarMode = 'read' | 'select' | 'edit';

/**
 * Roles are separated by weight and hue, not by shouting.
 *
 * A tutor scanning their week needs to tell bookable time from time that has
 * gone, at a glance and without reading. Bookable time is the subject, so it
 * carries the brand colour; everything that removes time is quieter and greyer,
 * with the left edge doing most of the identifying work.
 */
const roleClasses: Record<CalendarBlockRole, string> = {
  available: 'border-brand-purple/30 bg-brand-lavender/70 text-brand-purple-deep',
  // Lighter, and dashed: a one-off reads as the exception it is.
  available_once:
    'border-dashed border-brand-purple/40 bg-brand-lavender/40 text-brand-purple-deep',
  blocked:
    'border-surface-border bg-surface-card-secondary text-text-muted [background-image:repeating-linear-gradient(135deg,transparent,transparent_5px,var(--color-surface-border)_5px,var(--color-surface-border)_6px)]',
  hold: 'border-status-warning-border bg-status-warning-bg text-status-warning',
  lesson: 'border-status-success-border bg-status-success-bg text-status-success',
  selected: 'border-brand-purple-deep bg-brand-purple text-white',
  candidate: 'border-dashed border-brand-purple/50 bg-surface-card text-text-secondary',
};

/** The left edge that identifies a block before its label is read. */
const roleAccent: Record<CalendarBlockRole, string> = {
  available: 'bg-brand-purple',
  available_once: 'bg-brand-purple/40',
  blocked: 'bg-text-muted/40',
  hold: 'bg-status-warning',
  lesson: 'bg-status-success',
  selected: 'bg-white',
  candidate: 'bg-brand-purple/40',
};

export interface WeekCalendarProps {
  blocks: readonly CalendarBlock[];
  window: CalendarWindow;
  mode?: WeekCalendarMode;
  /** Mini drops labels and shrinks rows; it still shows real geometry. */
  density?: 'mini' | 'comfortable';
  /**
   * Pixels per hour, overriding the comfortable default.
   *
   * Exists for the booking grid, where a block is one half-hour START rather
   * than a whole lesson: at the default scale those are 22px tall, too short to
   * carry their own time and a poor target for a thumb. Raising the scale is
   * the honest fix — the geometry stays real, there is just more of it.
   */
  hourHeight?: number;
  stepMinutes?: number;
  /** Column headings, e.g. ['Mon 1', 'Tue 2', …]. Defaults to weekday names. */
  dayLabels?: readonly string[];
  selectedIds?: readonly string[];
  /** Refuse tutor-private roles. Set on every family-facing calendar. */
  familySafe?: boolean;
  ariaLabel: string;
  /**
   * Where "now" sits, when the week on screen is the current one. Drawn as the
   * thin line every calendar user already reads without being taught.
   */
  now?: { dayIndex: number; minutes: number };
  onToggleBlock?: (block: CalendarBlock) => void;
  /**
   * Clicking a block in edit mode. The grid stays a pure surface: it reports
   * which block was opened and lets the screen decide what an editor looks
   * like, so a discovery card and a tutor workspace can share this component
   * without sharing an editor.
   */
  onOpenBlock?: (blockId: string) => void;
  onCreate?: (dayIndex: number, startMinutes: number, endMinutes: number) => void;
  onResize?: (id: string, startMinutes: number, endMinutes: number) => void;
  onDelete?: (id: string) => void;
}

interface DraftBlock {
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
}

/** Comfortable is a real hour row; mini is a glance, so the whole day is small. */
const COMFORTABLE_HOUR_HEIGHT = 44;
/**
 * Small, but not so small that an hour becomes a hairline.
 *
 * A discovery card shows a whole teaching day — around thirteen hours — inside
 * this height, so every pixel is roughly five minutes. At 96 a one-hour lesson
 * was seven pixels tall and read as a speck rather than as a lesson; at 132 the
 * same block is a bar a parent can actually see the shape of. The card stays
 * compact enough to browse several tutors, which is the only reason mini exists.
 */
const MINI_BODY_HEIGHT = 132;
/** Below this the labels stop fitting and the block becomes a coloured bar. */
const LABEL_MIN_HEIGHT = 28;

export function WeekCalendar({
  blocks,
  window,
  mode = 'read',
  density = 'comfortable',
  hourHeight,
  stepMinutes = 30,
  dayLabels,
  selectedIds = [],
  familySafe = false,
  ariaLabel,
  now,
  onToggleBlock,
  onOpenBlock,
  onCreate,
  onResize,
  onDelete,
}: WeekCalendarProps): ReactNode {
  if (familySafe) assertFamilySafe(blocks);

  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [draft, setDraft] = useState<DraftBlock | null>(null);
  const dragAnchor = useRef<{ dayIndex: number; minutes: number } | null>(null);
  const resizing = useRef<{ id: string; startMinutes: number; dayIndex: number } | null>(null);

  const mini = density === 'mini';
  const marks = hourMarks(window);
  const labels = dayLabels ?? WEEKDAY_COLUMN_LABELS;
  const spanMinutes = Math.max(window.dayEndMinutes - window.dayStartMinutes, 1);
  const bodyHeight = mini
    ? MINI_BODY_HEIGHT
    : Math.round((spanMinutes / 60) * (hourHeight ?? COMFORTABLE_HOUR_HEIGHT));
  const editable = mode === 'edit';

  // One template for both grids, so a heading always sits above its own column.
  const columnTemplate = `${mini ? '0px' : '3.5rem'} repeat(7, minmax(0, 1fr))`;

  const minutesFromEvent = (event: ReactPointerEvent, dayIndex: number): number => {
    const column = columnRefs.current[dayIndex];
    if (column === null || column === undefined) return window.dayStartMinutes;
    const rect = column.getBoundingClientRect();
    return minutesAtOffset(event.clientY - rect.top, rect.height, window, stepMinutes);
  };

  const onColumnPointerDown = (event: ReactPointerEvent, dayIndex: number): void => {
    if (!editable || onCreate === undefined) return;
    // Only a bare column starts a create; pointerdown on a block is its own
    // gesture (select, or grab the resize handle).
    if ((event.target as HTMLElement).closest('[data-calendar-block]') !== null) return;
    event.preventDefault();
    const minutes = minutesFromEvent(event, dayIndex);
    dragAnchor.current = { dayIndex, minutes };
    setDraft({ dayIndex, ...draggedRange(minutes, minutes, window, stepMinutes) });
  };

  const onColumnPointerMove = (event: ReactPointerEvent, dayIndex: number): void => {
    const active = resizing.current;
    if (active !== null && onResize !== undefined) {
      const minutes = minutesFromEvent(event, active.dayIndex);
      setDraft({
        dayIndex: active.dayIndex,
        ...draggedRange(active.startMinutes, minutes, window, stepMinutes),
      });
      return;
    }
    const anchor = dragAnchor.current;
    if (anchor === null || anchor.dayIndex !== dayIndex) return;
    const minutes = minutesFromEvent(event, dayIndex);
    setDraft({ dayIndex, ...draggedRange(anchor.minutes, minutes, window, stepMinutes) });
  };

  const endGesture = (): void => {
    const active = resizing.current;
    const pending = draft;
    resizing.current = null;
    dragAnchor.current = null;
    setDraft(null);
    if (pending === null) return;
    if (active !== null) {
      onResize?.(active.id, pending.startMinutes, pending.endMinutes);
      return;
    }
    onCreate?.(pending.dayIndex, pending.startMinutes, pending.endMinutes);
  };

  const topPercent = (minutes: number): number =>
    ((minutes - window.dayStartMinutes) / spanMinutes) * 100;

  return (
    <div
      className="w-full overflow-hidden rounded-[var(--radius-medium)] border border-surface-border bg-surface-card"
      role="group"
      aria-label={ariaLabel}
    >
      {/* Seven columns need room to stay legible; below that the week scrolls. */}
      <div className={clsx('overflow-x-auto', mini && 'text-[10px]')}>
        <div className={mini ? '' : 'min-w-[44rem]'}>
          {/* Day headings, held above the scrolling hours. */}
          <div
            className="sticky top-0 z-10 grid border-b border-surface-border bg-surface-card-secondary"
            style={{ gridTemplateColumns: columnTemplate }}
          >
            {/*
             * The gutter track, ALWAYS rendered — including in mini, where it
             * is zero pixels wide.
             *
             * The header and the body share one column template, and grid
             * fills tracks in order. Skipping this cell moved every heading
             * one track left, so Monday's name sat over Sunday's column and a
             * card confidently mislabelled the days it was drawing. Nothing
             * visible was missing; the calendar simply lied.
             */}
            <div aria-hidden />
            {labels.map((label, dayIndex) => (
              <div
                key={label}
                // Marks a heading so a test can prove it sits over its own
                // column; the alignment bug it guards was invisible to text.
                data-calendar-heading
                className={clsx(
                  'min-w-0 truncate border-l border-surface-border text-center font-medium first:border-l-0',
                  mini ? 'py-1 text-[10px] text-text-muted' : 'py-2 text-xs text-text-secondary',
                  now !== undefined && now.dayIndex === dayIndex && 'text-brand-purple-deep',
                )}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: columnTemplate, height: bodyHeight }}>
            {/*
             * The gutter track, ALWAYS occupied — exactly as in the header.
             *
             * Mini shows no hour labels, but it still has a zero-width gutter
             * TRACK, and grid fills tracks in order. Leaving this cell out put
             * the first day into the zero-width track and pushed the seventh
             * off the end: Monday was invisible and shared a left edge with
             * Tuesday, so a card silently dropped a day the tutor teaches.
             * Nothing looked broken — the week was simply one column short.
             */}
            {mini ? <div aria-hidden /> : null}

            {/* Time axis. Hidden in mini: the shape carries the meaning there. */}
            {mini ? null : (
              <div className="relative border-r border-surface-border">
                {marks.map((minute) => {
                  // Centred on its own gridline, except at the two edges, where
                  // half the label would sit outside the calendar and be cut in
                  // two. There it tucks inside instead.
                  const atTop = minute <= window.dayStartMinutes;
                  const atBottom = minute >= window.dayEndMinutes;
                  return (
                    <span
                      key={minute}
                      className={clsx(
                        'absolute right-2 whitespace-nowrap text-[11px] tabular-nums text-text-muted',
                        atTop
                          ? 'translate-y-0'
                          : atBottom
                            ? '-translate-y-full'
                            : '-translate-y-1/2',
                      )}
                      style={{ top: `${String(topPercent(minute))}%` }}
                    >
                      {clockLabel(minute)}
                    </span>
                  );
                })}
              </div>
            )}

            {labels.map((label, dayIndex) => (
              <div
                key={label}
                // Marks a day column so a test can prove it has real width.
                // A zero-width column is a day nobody can see or click.
                data-calendar-day
                ref={(node) => {
                  columnRefs.current[dayIndex] = node;
                }}
                className={clsx(
                  'relative min-w-0 border-l border-surface-border first:border-l-0',
                  editable && 'cursor-crosshair',
                )}
                onPointerDown={(event) => {
                  onColumnPointerDown(event, dayIndex);
                }}
                onPointerMove={(event) => {
                  onColumnPointerMove(event, dayIndex);
                }}
                onPointerUp={endGesture}
                onPointerLeave={() => {
                  if (dragAnchor.current !== null || resizing.current !== null) endGesture();
                }}
              >
                {/* Hour rules, so the eye can read roughly when a block sits. */}
                {marks.map((minute) => (
                  <div
                    key={minute}
                    aria-hidden
                    className={clsx(
                      'absolute inset-x-0 border-t',
                      // At mini scale an hour rule is a quarter of a block's
                      // height, so full-strength lines read as structure inside
                      // the block rather than behind it.
                      mini ? 'border-surface-border/40' : 'border-surface-border/70',
                    )}
                    style={{ top: `${String(topPercent(minute))}%` }}
                  />
                ))}

                {now !== undefined && now.dayIndex === dayIndex && !mini ? (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 z-[5] border-t border-status-critical"
                    style={{ top: `${String(topPercent(now.minutes))}%` }}
                  >
                    <span className="absolute -left-0.5 -top-[3px] block h-1.5 w-1.5 rounded-full bg-status-critical" />
                  </div>
                ) : null}

                {blocks
                  .filter((block) => block.dayIndex === dayIndex)
                  .map((block) => {
                    const position = blockPosition(block, window);
                    if (position === null) return null;
                    const isSelected = selectedIds.includes(block.id);
                    const role = isSelected ? 'selected' : block.role;
                    const selectable = mode === 'select' && onToggleBlock !== undefined;
                    const openable = editable && onOpenBlock !== undefined;
                    const interactive = selectable || openable;
                    const Tag = interactive ? 'button' : 'div';
                    const heightPx = (position.heightPercent / 100) * bodyHeight;
                    const roomForLabel = !mini && heightPx >= LABEL_MIN_HEIGHT;

                    return (
                      <Tag
                        key={block.id}
                        data-calendar-block
                        {...(selectable
                          ? {
                              type: 'button' as const,
                              'aria-pressed': isSelected,
                              onClick: () => {
                                onToggleBlock(block);
                              },
                            }
                          : {})}
                        {...(openable && !selectable
                          ? {
                              type: 'button' as const,
                              onClick: () => {
                                onOpenBlock(block.id);
                              },
                            }
                          : {})}
                        className={clsx(
                          'group/block absolute overflow-hidden border text-left',
                          mini
                            ? 'inset-x-px rounded-[2px]'
                            : 'inset-x-1 rounded-[var(--radius-gentle)] pl-2 pr-1',
                          roleClasses[role],
                          interactive &&
                            'cursor-pointer transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple',
                          mini ? 'text-[9px] leading-none' : 'text-[11px] leading-tight',
                        )}
                        style={{
                          top: `${String(position.topPercent)}%`,
                          height: `${String(Math.max(position.heightPercent, mini ? 6 : 2.5))}%`,
                        }}
                        title={block.label}
                      >
                        {mini ? null : (
                          <span
                            aria-hidden
                            className={clsx(
                              'absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-gentle)]',
                              roleAccent[role],
                            )}
                          />
                        )}

                        {roomForLabel && block.label !== undefined ? (
                          <span className="block truncate pt-0.5 font-medium">{block.label}</span>
                        ) : null}
                        {roomForLabel && block.count !== undefined ? (
                          <span className="block truncate">{block.count}</span>
                        ) : null}

                        {editable && onDelete !== undefined ? (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Remove this block"
                            className="absolute right-0.5 top-0 cursor-pointer rounded px-1 text-text-muted opacity-0 transition-opacity hover:text-status-critical focus-visible:opacity-100 group-hover/block:opacity-100"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(block.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') onDelete(block.id);
                            }}
                          >
                            ×
                          </span>
                        ) : null}

                        {/*
                         * A grip rather than a hover-only handle. Touch has no
                         * hover, so an affordance that only appears on hover is
                         * no affordance at all on a tablet — this stays faintly
                         * present and firms up under the pointer.
                         */}
                        {editable && onResize !== undefined ? (
                          <span
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-end justify-center pb-0.5"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              resizing.current = {
                                id: block.id,
                                startMinutes: block.startMinutes,
                                dayIndex,
                              };
                              setDraft({
                                dayIndex,
                                startMinutes: block.startMinutes,
                                endMinutes: block.endMinutes,
                              });
                            }}
                          >
                            <span className="h-[3px] w-6 rounded-full bg-current opacity-30 transition-opacity group-hover/block:opacity-70" />
                          </span>
                        ) : null}
                      </Tag>
                    );
                  })}

                {draft !== null && draft.dayIndex === dayIndex
                  ? (() => {
                      const position = blockPosition(
                        {
                          id: 'draft',
                          dayIndex,
                          startMinutes: draft.startMinutes,
                          endMinutes: draft.endMinutes,
                          role: 'candidate',
                        },
                        window,
                      );
                      if (position === null) return null;
                      return (
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-x-1 z-[6] rounded-[var(--radius-gentle)] border-2 border-brand-purple bg-brand-lavender/60"
                          style={{
                            top: `${String(position.topPercent)}%`,
                            height: `${String(position.heightPercent)}%`,
                          }}
                        />
                      );
                    })()
                  : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
