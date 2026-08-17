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
 * THE PRIVACY BOUNDARY IS THE PROJECTION, NOT THE COMPONENT. This grid renders
 * whatever blocks it is given and cannot tell a derived bookable slot from a
 * raw availability rule. `familySafe` turns passing the wrong one into a loud
 * failure — set it on every family-facing calendar, including the tutor's own
 * "preview as a family" view, which must be fed the same derived projection a
 * family gets rather than the rules behind it.
 */
export type WeekCalendarMode = 'read' | 'select' | 'edit';

const roleClasses: Record<CalendarBlockRole, string> = {
  available: 'bg-brand-lavender/70 border-brand-purple/40 text-brand-purple-deep',
  blocked:
    'bg-status-neutral-bg border-status-neutral-border text-status-neutral [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.06)_4px,rgba(0,0,0,0.06)_8px)]',
  hold: 'bg-status-warning-bg border-status-warning-border text-status-warning',
  lesson: 'bg-status-success-bg border-status-success-border text-status-success',
  selected: 'bg-brand-purple border-brand-purple-deep text-white',
  candidate: 'bg-surface-card border-dashed border-brand-purple/50 text-text-secondary',
};

export interface WeekCalendarProps {
  blocks: readonly CalendarBlock[];
  window: CalendarWindow;
  mode?: WeekCalendarMode;
  /** Mini drops labels and shrinks rows; it still shows real geometry. */
  density?: 'mini' | 'comfortable';
  stepMinutes?: number;
  /** Column headings, e.g. ['Mon 1', 'Tue 2', …]. Defaults to weekday names. */
  dayLabels?: readonly string[];
  selectedIds?: readonly string[];
  /** Refuse tutor-private roles. Set on every family-facing calendar. */
  familySafe?: boolean;
  ariaLabel: string;
  onToggleBlock?: (block: CalendarBlock) => void;
  onCreate?: (dayIndex: number, startMinutes: number, endMinutes: number) => void;
  onResize?: (id: string, startMinutes: number, endMinutes: number) => void;
  onDelete?: (id: string) => void;
}

interface DraftBlock {
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
}

export function WeekCalendar({
  blocks,
  window,
  mode = 'read',
  density = 'comfortable',
  stepMinutes = 30,
  dayLabels,
  selectedIds = [],
  familySafe = false,
  ariaLabel,
  onToggleBlock,
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

  const minutesFromEvent = (event: ReactPointerEvent, dayIndex: number): number => {
    const column = columnRefs.current[dayIndex];
    if (column === null || column === undefined) return window.dayStartMinutes;
    const rect = column.getBoundingClientRect();
    return minutesAtOffset(event.clientY - rect.top, rect.height, window, stepMinutes);
  };

  const onColumnPointerDown = (event: ReactPointerEvent, dayIndex: number): void => {
    if (mode !== 'edit' || onCreate === undefined) return;
    // Only a bare column starts a create; pointerdown on a block is its own
    // gesture (select, or grab the resize handle).
    if ((event.target as HTMLElement).closest('[data-calendar-block]') !== null) return;
    event.preventDefault();
    const minutes = minutesFromEvent(event, dayIndex);
    dragAnchor.current = { dayIndex, minutes };
    const range = draggedRange(minutes, minutes, window, stepMinutes);
    setDraft({ dayIndex, ...range });
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

  return (
    <div
      className={clsx(
        'w-full overflow-hidden rounded-[var(--radius-medium)] border border-surface-border bg-surface-card',
        mini && 'text-[10px]',
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="flex">
        {/* Time axis. Hidden in mini: the shape carries the meaning there. */}
        {!mini ? (
          <div className="w-14 shrink-0 border-r border-surface-border pt-6">
            <div className="relative" style={{ height: mini ? 96 : 320 }}>
              {marks.map((minute) => (
                <span
                  key={minute}
                  className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-text-muted"
                  style={{
                    top: `${String(
                      ((minute - window.dayStartMinutes) /
                        (window.dayEndMinutes - window.dayStartMinutes)) *
                        100,
                    )}%`,
                  }}
                >
                  {clockLabel(minute)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid flex-1 grid-cols-7">
          {labels.map((label, dayIndex) => (
            <div key={label} className="min-w-0 border-l border-surface-border first:border-l-0">
              <div
                className={clsx(
                  'truncate border-b border-surface-border px-1 text-center font-medium text-text-secondary',
                  mini ? 'py-0.5 text-[10px]' : 'py-1 text-xs',
                )}
              >
                {label}
              </div>

              <div
                ref={(node) => {
                  columnRefs.current[dayIndex] = node;
                }}
                className={clsx('relative', mode === 'edit' && 'cursor-crosshair')}
                style={{ height: mini ? 96 : 320 }}
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
                    className="absolute inset-x-0 border-t border-surface-border/60"
                    style={{
                      top: `${String(
                        ((minute - window.dayStartMinutes) /
                          (window.dayEndMinutes - window.dayStartMinutes)) *
                          100,
                      )}%`,
                    }}
                  />
                ))}

                {blocks
                  .filter((block) => block.dayIndex === dayIndex)
                  .map((block) => {
                    const position = blockPosition(block, window);
                    if (position === null) return null;
                    const isSelected = selectedIds.includes(block.id);
                    const interactive = mode === 'select' && onToggleBlock !== undefined;
                    const Tag = interactive ? 'button' : 'div';
                    return (
                      <Tag
                        key={block.id}
                        data-calendar-block
                        {...(interactive
                          ? {
                              type: 'button' as const,
                              'aria-pressed': isSelected,
                              onClick: () => {
                                onToggleBlock(block);
                              },
                            }
                          : {})}
                        className={clsx(
                          'absolute inset-x-0.5 overflow-hidden rounded-[var(--radius-gentle)] border px-1 text-left transition-colors',
                          roleClasses[isSelected ? 'selected' : block.role],
                          interactive &&
                            'cursor-pointer hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple',
                          mini ? 'text-[9px] leading-tight' : 'text-[11px] leading-snug',
                        )}
                        style={{
                          top: `${String(position.topPercent)}%`,
                          height: `${String(Math.max(position.heightPercent, mini ? 4 : 3))}%`,
                        }}
                        title={block.label}
                      >
                        {!mini && block.label !== undefined ? (
                          <span className="block truncate">{block.label}</span>
                        ) : null}
                        {!mini && block.count !== undefined ? (
                          <span className="block truncate font-medium">{block.count}</span>
                        ) : null}

                        {mode === 'edit' && onDelete !== undefined ? (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Remove this block"
                            className="absolute right-0.5 top-0 cursor-pointer px-1 text-text-muted hover:text-status-critical"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                            }}
                            onClick={() => {
                              onDelete(block.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') onDelete(block.id);
                            }}
                          >
                            ×
                          </span>
                        ) : null}

                        {mode === 'edit' && onResize !== undefined ? (
                          <span
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize bg-brand-purple/30"
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
                          />
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
                          className="pointer-events-none absolute inset-x-0.5 rounded-[var(--radius-gentle)] border-2 border-brand-purple bg-brand-lavender/60"
                          style={{
                            top: `${String(position.topPercent)}%`,
                            height: `${String(position.heightPercent)}%`,
                          }}
                        />
                      );
                    })()
                  : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
