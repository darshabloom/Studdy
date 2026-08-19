'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
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

const TOOLS: readonly { id: Tool; label: string; hint: string }[] = [
  { id: 'weekly', label: 'Repeats weekly', hint: 'Your regular teaching hours, every week.' },
  { id: 'extra', label: 'Extra time, once', hint: 'Hours you can offer on this date only.' },
  { id: 'block', label: 'Block time', hint: 'Time you are not available on this date.' },
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
}

export interface NotedBlock {
  readonly id: string;
  readonly when: string;
  readonly note: string;
}

interface PendingBlock {
  readonly dayIndex: number;
  readonly date: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
}

export function AvailabilityCalendar(props: AvailabilityCalendarProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tool, setTool] = useState<Tool>('weekly');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [blockDraft, setBlockDraft] = useState<PendingBlock | null>(null);
  const [privateNote, setPrivateNote] = useState('');

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

  const handleCreate = (dayIndex: number, startMinutes: number, endMinutes: number): void => {
    const date = props.dayDates[dayIndex];
    if (date === undefined) return;

    if (tool === 'weekly') {
      run(
        () => createRuleFromCalendarAction(dayIndex, startMinutes, endMinutes),
        'Weekly hours added.',
      );
      return;
    }
    if (tool === 'extra') {
      run(
        () => createExceptionFromCalendarAction(date, startMinutes, endMinutes, 'adds'),
        'Extra time added for that date.',
      );
      return;
    }
    // Blocking is the one case worth pausing on: a private reason is the whole
    // point of the row, and it cannot be attached after the fact by dragging.
    setError(null);
    setNotice(null);
    setPrivateNote('');
    setBlockDraft({ dayIndex, date, startMinutes, endMinutes });
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

  const confirmBlock = (): void => {
    const draft = blockDraft;
    if (draft === null) return;
    setBlockDraft(null);
    run(
      () =>
        createExceptionFromCalendarAction(
          draft.date,
          draft.startMinutes,
          draft.endMinutes,
          'removes',
          privateNote,
        ),
      'Time blocked.',
    );
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {TOOLS.map((option) => (
            <Button
              key={option.id}
              variant={tool === option.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setTool(option.id);
                setBlockDraft(null);
              }}
            >
              {option.label}
            </Button>
          ))}
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

      {blockDraft === null ? null : (
        <Card className="mt-4">
          <h3 className="font-semibold">Block this time?</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {props.dayLabels[blockDraft.dayIndex]}, {clock(blockDraft.startMinutes)} –{' '}
            {clock(blockDraft.endMinutes)}. Families will simply not see this time. They are never
            told that it is blocked, or why.
          </p>
          <label className="mt-3 block text-sm font-medium" htmlFor="private-note">
            Private note, just for you (optional)
          </label>
          <input
            id="private-note"
            className="mt-1 w-full rounded-[var(--radius-gentle)] border border-border-default bg-surface-raised px-3 py-2 text-sm"
            value={privateNote}
            placeholder="Dentist, school run, holiday…"
            onChange={(event) => {
              setPrivateNote(event.target.value);
            }}
          />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={confirmBlock} disabled={pending}>
              Block this time
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setBlockDraft(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-4" aria-busy={pending}>
        <WeekCalendar
          blocks={props.blocks}
          window={props.window}
          mode={props.isPastWeek ? 'read' : 'edit'}
          dayLabels={props.dayLabels}
          ariaLabel={`Your availability, week of ${props.weekLabel}`}
          {...(props.isPastWeek
            ? {}
            : { onCreate: handleCreate, onResize: handleResize, onDelete: handleDelete })}
        />
        {props.isPastWeek ? null : (
          <p className="mt-3 text-sm text-text-secondary">
            Drag on an empty part of a day to add time. Drag the bottom edge of a block to change
            when it ends, or use × to remove it. Times are {props.timeZone}.
          </p>
        )}
        <Legend />
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
    </div>
  );
}

function Legend(): ReactNode {
  return (
    <ul className="mt-3 flex flex-wrap gap-4 text-xs text-text-secondary">
      <LegendItem className="bg-brand-lavender/70 border-brand-purple/40" label="Bookable" />
      <LegendItem
        className="bg-status-neutral-bg border-status-neutral-border"
        label="Blocked (private)"
      />
      <LegendItem
        className="bg-status-warning-bg border-status-warning-border"
        label="Held, temporarily"
      />
      <LegendItem
        className="bg-status-success-bg border-status-success-border"
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

function clock(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 < 12 ? 'am' : 'pm';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minute === 0
    ? `${String(hour12)} ${period}`
    : `${String(hour12)}:${String(minute).padStart(2, '0')} ${period}`;
}
