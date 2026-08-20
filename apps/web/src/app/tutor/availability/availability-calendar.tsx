'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Card,
  WeekCalendar,
  type CalendarBlock,
  type CalendarWindow,
} from '@studdy/design-system';
import {
  createExceptionFromCalendarAction,
  createRuleFromCalendarAction,
  deleteExceptionFromCalendarAction,
  deleteRuleFromCalendarAction,
  updateExceptionFromCalendarAction,
  updateRuleFromCalendarAction,
  type CalendarActionResult,
} from '@/lib/availability/actions';
import type { CalendarSegment } from '@/lib/availability/calendar-projection';
import type { FormatScope } from '@/lib/availability/actions';
import { AvailabilityEditor, type EditorTarget, type EditorValue } from './availability-editor';

/**
 * The tutor's availability, as a calendar they draw on.
 *
 * The old screen was a list of rules plus a form, which meant a tutor had to
 * hold their own week in their head to answer "when am I actually free?". Here
 * the week IS the answer, and every edit is direct manipulation of it.
 *
 * THIS IS THE EDITING CALENDAR ONLY, and deliberately knows nothing about the
 * family preview. The preview is a separate server render on `?preview=1`,
 * because a client-side toggle would still ship every private note and blocked
 * period in this component's serialised props — hidden on screen, but present
 * in the page. Keeping the two apart means the preview route never loads the
 * private rows at all.
 */

/** What a drag on empty grid creates. */
type Tool = 'weekly' | 'extra' | 'block';

/** Each tool carries the colour it will draw, so the choice is visible up front. */
const TOOLS: readonly { id: Tool; label: string; hint: string; swatch: string }[] = [
  {
    id: 'weekly',
    label: 'Regular availability',
    hint: 'Repeats every week until you change it.',
    swatch: 'bg-brand-purple',
  },
  {
    id: 'extra',
    label: 'One-off availability',
    hint: 'Extra hours on this date only.',
    swatch: 'bg-brand-purple/40',
  },
  {
    id: 'block',
    label: 'Block time',
    hint: 'Time you are not available on this date.',
    swatch: 'bg-text-muted/50',
  },
];

export interface AvailabilityCalendarProps {
  readonly weekLabel: string;
  readonly dayLabels: readonly string[];
  /** 'YYYY-MM-DD' per column, so a one-off change knows its date. */
  readonly dayDates: readonly string[];
  readonly blocks: readonly CalendarBlock[];
  readonly segments: readonly CalendarSegment[];
  readonly window: CalendarWindow;
  readonly timeZone: string;
  readonly hasAnyRules: boolean;
  /**
   * A week that has already finished is shown but not edited. New hours take
   * effect from today onwards and a one-off change cannot be placed in the
   * past, so a drag here would appear to do nothing at all.
   */
  readonly isPastWeek: boolean;
  /** TUTOR-ONLY. Never rendered on the family preview, which is a separate route. */
  readonly notedBlocks: readonly NotedBlock[];
  /** Present only when the week on screen contains today. */
  readonly now?: { dayIndex: number; minutes: number };
}

export interface NotedBlock {
  readonly id: string;
  readonly when: string;
  readonly note: string;
}

export function AvailabilityCalendar(props: AvailabilityCalendarProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tool, setTool] = useState<Tool>('weekly');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  // Where focus lands when the control that opened the editor is gone by the
  // time it closes, which is the normal case once a save re-renders the week.
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const segmentFor = (blockId: string): CalendarSegment | undefined =>
    props.segments.find((segment) => segment.blockId === blockId);

  /** Every edit funnels through here so the outcome is reported the same way. */
  const run = (action: () => Promise<CalendarActionResult>, success?: string): void => {
    setError(null);
    setNotice(null);
    startTransition(() => {
      void action().then((result) => {
        if (result.ok) {
          if (success !== undefined) setNotice(success);
          // The server owns the truth: refresh rather than patch local state, so
          // a rejected or adjusted edit can never linger on screen as if it took.
          router.refresh();
        } else {
          setError(result.error);
        }
      });
    });
  };

  /**
   * A drag on empty grid opens the editor prefilled rather than saving at once.
   *
   * The gesture says when; it cannot say whether this is a weekly rule or a
   * one-off, nor whether it is online-only, and guessing silently is how a
   * tutor ends up with availability they did not mean to publish. The toolbar
   * choice is carried in as the starting point, so the common case is one
   * confirming click.
   */
  const handleCreate = (dayIndex: number, startMinutes: number, endMinutes: number): void => {
    const date = props.dayDates[dayIndex];
    if (date === undefined) return;
    setError(null);
    setNotice(null);
    setEditing({
      canDelete: false,
      value: {
        kind: tool === 'weekly' ? 'weekly' : tool === 'extra' ? 'once' : 'blocked',
        dayIndex,
        date,
        startMinutes,
        endMinutes,
        formatCode: 'any',
        privateNote: '',
      },
    });
  };

  /** The "+ Add" path: no gesture to read, so it opens on a sensible default. */
  const openBlankEditor = (): void => {
    setError(null);
    setNotice(null);
    const dayIndex = props.now?.dayIndex ?? 0;
    const date = props.dayDates[dayIndex] ?? props.dayDates[0] ?? '';
    const startMinutes = Math.min(Math.max(props.now?.minutes ?? 9 * 60, 6 * 60), 21 * 60);
    setEditing({
      canDelete: false,
      value: {
        kind: tool === 'weekly' ? 'weekly' : tool === 'extra' ? 'once' : 'blocked',
        dayIndex,
        date,
        // Snap to the half hour so the times read like a calendar entry.
        startMinutes: Math.round(startMinutes / 30) * 30,
        endMinutes: Math.round(startMinutes / 30) * 30 + 60,
        formatCode: 'any',
        privateNote: '',
      },
    });
  };

  /** Clicking a block opens the same editor on that row. */
  const handleOpenBlock = (blockId: string): void => {
    const segment = segmentFor(blockId);
    if (segment === undefined) return;

    if (segment.kind === 'hold' || segment.kind === 'lesson') {
      setError(
        segment.kind === 'hold'
          ? 'That time is held for a family who is deciding. It clears itself when they do.'
          : 'That is a confirmed lesson. It is changed from the lesson, not from your hours.',
      );
      return;
    }
    if (!segment.editable) {
      setError('That period runs across several days. Remove it and add it again to change it.');
      return;
    }

    setError(null);
    setNotice(null);
    setEditing({
      rowId: segment.rowId,
      canDelete: true,
      value: {
        kind:
          segment.kind === 'rule'
            ? 'weekly'
            : props.blocks.find((block) => block.id === blockId)?.role === 'blocked'
              ? 'blocked'
              : 'once',
        dayIndex: Math.max(props.dayDates.indexOf(segment.date), 0),
        date: segment.date,
        startMinutes: segment.startMinutes,
        endMinutes: segment.endMinutes,
        formatCode: (segment.formatCode === 'online' || segment.formatCode === 'in_person'
          ? segment.formatCode
          : 'any') as FormatScope,
        privateNote: '',
      },
    });
  };

  /** One save path for every entry point into the editor. */
  const saveFromEditor = (value: EditorValue, rowId: string | undefined): void => {
    setEditing(null);

    if (value.kind === 'weekly') {
      if (rowId === undefined) {
        run(
          () =>
            createRuleFromCalendarAction(
              value.dayIndex,
              value.startMinutes,
              value.endMinutes,
              value.formatCode,
            ),
          'Regular availability added.',
        );
        return;
      }
      run(
        () =>
          updateRuleFromCalendarAction(
            rowId,
            value.dayIndex,
            value.startMinutes,
            value.endMinutes,
            value.formatCode,
          ),
        'Regular availability updated.',
      );
      return;
    }

    const effect = value.kind === 'blocked' ? 'removes' : 'adds';
    if (rowId === undefined) {
      run(
        () =>
          createExceptionFromCalendarAction(
            value.date,
            value.startMinutes,
            value.endMinutes,
            effect,
            value.privateNote,
            value.formatCode,
          ),
        value.kind === 'blocked' ? 'Time blocked.' : 'One-off availability added.',
      );
      return;
    }
    run(
      () =>
        updateExceptionFromCalendarAction(
          rowId,
          value.date,
          value.startMinutes,
          value.endMinutes,
          value.formatCode,
        ),
      'Updated.',
    );
  };

  const handleResize = (blockId: string, startMinutes: number, endMinutes: number): void => {
    const segment = segmentFor(blockId);
    if (segment === undefined) return;

    if (segment.kind === 'hold' || segment.kind === 'lesson') {
      setError(
        segment.kind === 'hold'
          ? 'That time is held for a family who is deciding. It clears itself when they do.'
          : 'That is a confirmed lesson. Availability changes will not move it.',
      );
      router.refresh();
      return;
    }
    if (!segment.editable) {
      setError('That period runs across several days. Remove it and add it again to change it.');
      router.refresh();
      return;
    }
    if (segment.kind === 'rule') {
      // A resize changes the hours, never the column, so the rule keeps the day
      // it already had rather than the drag inferring one.
      const dayIndex = props.dayDates.indexOf(segment.date);
      if (dayIndex < 0) return;
      run(() => updateRuleFromCalendarAction(segment.rowId, dayIndex, startMinutes, endMinutes));
      return;
    }
    run(() =>
      updateExceptionFromCalendarAction(segment.rowId, segment.date, startMinutes, endMinutes),
    );
  };

  const handleDelete = (blockId: string): void => {
    const segment = segmentFor(blockId);
    if (segment === undefined) return;

    if (segment.kind === 'hold' || segment.kind === 'lesson') {
      setError(
        segment.kind === 'hold'
          ? 'A hold is released automatically. You cannot remove it from here.'
          : 'A confirmed lesson is cancelled from the lesson itself, not from your hours.',
      );
      return;
    }
    if (segment.kind === 'rule') {
      run(() => deleteRuleFromCalendarAction(segment.rowId), 'Weekly hours removed.');
      return;
    }
    run(() => deleteExceptionFromCalendarAction(segment.rowId), 'One-off change removed.');
  };

  return (
    <div className="mt-4">
      {props.isPastWeek ? (
        <p className="text-sm text-text-secondary">
          This week has already been. You can look back at it, but new hours start from today and a
          one-off change cannot be put in the past.
        </p>
      ) : null}

      {props.isPastWeek ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/*
           * A segmented control, not three buttons. These are modes of one tool
           * — what a drag will draw — and only one can be active, which a row of
           * separate buttons does not say. Joining them into a single track with
           * one filled segment is the shape a person already reads as a mode.
           */}
          <div
            role="radiogroup"
            aria-label="What dragging on the calendar creates"
            className="inline-flex rounded-[var(--radius-medium)] border border-surface-border bg-surface-card-secondary p-0.5"
          >
            {TOOLS.map((option) => {
              const active = tool === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setTool(option.id);
                  }}
                  className={`flex items-center gap-1.5 rounded-[var(--radius-gentle)] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple ${
                    active
                      ? 'bg-surface-card text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${option.swatch}`} />
                  {option.label}
                </button>
              );
            })}
          </div>
          <Button ref={addButtonRef} size="sm" onClick={openBlankEditor}>
            + Add
          </Button>

          <p className="text-sm text-text-secondary">
            {TOOLS.find((option) => option.id === tool)?.hint}
          </p>
        </div>
      )}

      {error === null ? null : (
        <div className="mt-4">
          <Alert tone="warning" title="That change did not stick">
            {error}
          </Alert>
        </div>
      )}
      {notice === null || error !== null ? null : (
        <div className="mt-4">
          <Alert tone="success" title="Saved">
            {notice}
          </Alert>
        </div>
      )}

      <div className="mt-4" aria-busy={pending}>
        <WeekCalendar
          blocks={props.blocks}
          window={props.window}
          mode={props.isPastWeek ? 'read' : 'edit'}
          dayLabels={props.dayLabels}
          ariaLabel={`Your availability, week of ${props.weekLabel}`}
          {...(props.now === undefined ? {} : { now: props.now })}
          {...(props.isPastWeek
            ? {}
            : {
                onCreate: handleCreate,
                onResize: handleResize,
                onDelete: handleDelete,
                onOpenBlock: handleOpenBlock,
              })}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <Legend />
          {props.isPastWeek ? null : (
            <p className="text-xs text-text-muted">
              Drag to add · drag the bottom edge to resize · × to remove · times in {props.timeZone}
            </p>
          )}
        </div>

        {props.hasAnyRules ? null : (
          <p className="mt-3 text-sm text-text-secondary">
            Nothing set yet. Drag across a weekday above to add the hours you normally teach — they
            will repeat every week until you change them.
          </p>
        )}

        {props.notedBlocks.length === 0 ? null : (
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">Your notes on blocked time</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Only you can see these. No family is ever told that a time is blocked, or why.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {props.notedBlocks.map((noted) => (
                <li key={noted.id}>
                  <Card>
                    <p className="text-sm font-medium">{noted.when}</p>
                    <p className="mt-1 text-sm text-text-muted">Private note: {noted.note}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {editing === null ? null : (
        <AvailabilityEditor
          target={editing}
          dayDates={props.dayDates}
          busy={pending}
          fallbackFocusRef={addButtonRef}
          onCancel={() => {
            setEditing(null);
          }}
          onSave={saveFromEditor}
          onDelete={(rowId) => {
            setEditing(null);
            const segment = props.segments.find((candidate) => candidate.rowId === rowId);
            if (segment?.kind === 'rule') {
              run(() => deleteRuleFromCalendarAction(rowId), 'Regular availability removed.');
              return;
            }
            run(() => deleteExceptionFromCalendarAction(rowId), 'Removed.');
          }}
        />
      )}
    </div>
  );
}

/** The five things a block can be, in the same colours the grid uses. */
function Legend(): ReactNode {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-secondary">
      <LegendItem className="border-brand-purple/30 bg-brand-lavender/70" label="Regular" />
      <LegendItem className="border-brand-purple/30 bg-brand-lavender/40" label="One-off" />
      <LegendItem
        className="border-surface-border bg-surface-card-secondary"
        label="Blocked (private)"
      />
      <LegendItem
        className="border-status-warning-border bg-status-warning-bg"
        label="Held, temporarily"
      />
      <LegendItem
        className="border-status-success-border bg-status-success-bg"
        label="Confirmed lesson"
      />
    </ul>
  );
}

function LegendItem({ className, label }: { className: string; label: string }): ReactNode {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-[3px] border ${className}`} aria-hidden />
      {label}
    </li>
  );
}
