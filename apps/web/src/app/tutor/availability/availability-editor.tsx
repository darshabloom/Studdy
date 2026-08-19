'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@studdy/design-system';
import type { FormatScope } from '@/lib/availability/actions';

/**
 * ONE editor for every way of entering availability.
 *
 * The calendar gives experienced tutors direct manipulation, which is fast and
 * completely undiscoverable: nothing on a grid says "you may drag me", and
 * nothing says a time can be online-only. So the same values are also editable
 * as a form — and it is deliberately the SAME form. Dragging opens it prefilled,
 * "+ Add" opens it empty, clicking a block opens it on that block. Two entry
 * systems would drift apart in what they allow and in what they validate.
 *
 * Resize stays outside this: it is a single-purpose gesture that needs no
 * confirmation, and going through a dialog would make the fast path slow.
 */

export type EditorKind = 'weekly' | 'once' | 'blocked';

export interface EditorValue {
  readonly kind: EditorKind;
  /** Which column, 0 = Monday. A weekly rule uses this and ignores `date`. */
  readonly dayIndex: number;
  /** 'YYYY-MM-DD' for a one-off or a block. */
  readonly date: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly formatCode: FormatScope;
  readonly privateNote: string;
}

export interface EditorTarget {
  /** Absent when creating. */
  readonly rowId?: string;
  readonly value: EditorValue;
  /** An existing row can be removed from inside the editor. */
  readonly canDelete: boolean;
}

const KINDS: readonly { id: EditorKind; label: string; hint: string }[] = [
  {
    id: 'weekly',
    label: 'Regular availability',
    hint: 'Repeats every week on this day until you change it.',
  },
  { id: 'once', label: 'One-off availability', hint: 'Extra hours on this date only.' },
  { id: 'blocked', label: 'Block time', hint: 'Time you are not available on this date.' },
];

const FORMATS: readonly { id: FormatScope; label: string }[] = [
  { id: 'any', label: 'Both' },
  { id: 'online', label: 'Online' },
  { id: 'in_person', label: 'In person' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function toClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(Math.min(hours, 23)).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function fromClock(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

export interface AvailabilityEditorProps {
  readonly target: EditorTarget;
  /** Column dates, so changing the day of a one-off keeps a real date. */
  readonly dayDates: readonly string[];
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSave: (value: EditorValue, rowId: string | undefined) => void;
  readonly onDelete: (rowId: string) => void;
}

export function AvailabilityEditor({
  target,
  dayDates,
  busy,
  onCancel,
  onSave,
  onDelete,
}: AvailabilityEditorProps): ReactNode {
  const [value, setValue] = useState<EditorValue>(target.value);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const isExisting = target.rowId !== undefined;

  // Reopening on a different block must reset the fields, not keep the last
  // block's times: the editor is one component serving every entry point.
  useEffect(() => {
    setValue(target.value);
  }, [target]);

  // Send focus into the dialog so a keyboard user is not left behind on the
  // calendar, and let Escape close it the way a dialog is expected to.
  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  const set = <K extends keyof EditorValue>(key: K, next: EditorValue[K]): void => {
    setValue((current) => ({ ...current, [key]: next }));
  };

  const scoped = value.kind !== 'blocked';
  const invalid = value.endMinutes <= value.startMinutes;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isExisting ? 'Edit this time' : 'Add availability'}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-medium)] border border-surface-border bg-surface-card p-5 shadow-lg sm:rounded-[var(--radius-medium)]"
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg font-semibold outline-none"
        >
          {isExisting ? 'Edit this time' : 'Add to your calendar'}
        </h2>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">What is this?</legend>
          <div className="mt-2 flex flex-col gap-1.5">
            {KINDS.map((kind) => (
              <label
                key={kind.id}
                className={`flex cursor-pointer items-start gap-2 rounded-[var(--radius-gentle)] border p-2.5 text-sm transition-colors ${
                  value.kind === kind.id
                    ? 'border-brand-purple bg-brand-lavender/40'
                    : 'border-surface-border hover:bg-surface-card-secondary'
                }`}
              >
                <input
                  type="radio"
                  name="availability-kind"
                  className="mt-0.5"
                  checked={value.kind === kind.id}
                  // Changing an existing row's kind would mean moving it between
                  // two different tables, so it is fixed once created.
                  disabled={isExisting}
                  onChange={() => {
                    set('kind', kind.id);
                  }}
                />
                <span>
                  <span className="block font-medium">{kind.label}</span>
                  <span className="block text-text-secondary">{kind.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {isExisting ? (
            <p className="mt-2 text-xs text-text-muted">
              To change what kind of time this is, remove it and add it again.
            </p>
          ) : null}
        </fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="block font-medium">{value.kind === 'weekly' ? 'Day' : 'Date'}</span>
            {value.kind === 'weekly' ? (
              <select
                className="mt-1 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-2 py-1.5 text-sm"
                value={value.dayIndex}
                onChange={(event) => {
                  set('dayIndex', Number(event.target.value));
                }}
              >
                {DAY_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                className="mt-1 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-2 py-1.5 text-sm"
                value={value.date}
                onChange={(event) => {
                  const date = event.target.value;
                  const index = dayDates.indexOf(date);
                  setValue((current) => ({
                    ...current,
                    date,
                    // Keep the column in step when the date is in this week, so
                    // saving puts the block where the tutor expects to see it.
                    dayIndex: index >= 0 ? index : current.dayIndex,
                  }));
                }}
              />
            )}
          </label>

          <label className="text-sm">
            <span className="block font-medium">Starts</span>
            <input
              type="time"
              step={900}
              className="mt-1 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-2 py-1.5 text-sm"
              value={toClock(value.startMinutes)}
              onChange={(event) => {
                set('startMinutes', fromClock(event.target.value));
              }}
            />
          </label>

          <label className="text-sm">
            <span className="block font-medium">Ends</span>
            <input
              type="time"
              step={900}
              className="mt-1 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-2 py-1.5 text-sm"
              value={toClock(value.endMinutes)}
              onChange={(event) => {
                set('endMinutes', fromClock(event.target.value));
              }}
            />
          </label>
        </div>

        {scoped ? (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">How can this time be taught?</legend>
            <p className="mt-0.5 text-xs text-text-secondary">
              Families looking for the other kind will not be offered this time.
            </p>
            <div className="mt-2 inline-flex rounded-[var(--radius-medium)] border border-surface-border bg-surface-card-secondary p-0.5">
              {FORMATS.map((format) => (
                <button
                  key={format.id}
                  type="button"
                  aria-pressed={value.formatCode === format.id}
                  onClick={() => {
                    set('formatCode', format.id);
                  }}
                  className={`rounded-[var(--radius-gentle)] px-3 py-1.5 text-sm font-medium transition-colors ${
                    value.formatCode === format.id
                      ? 'bg-surface-card text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <label className="mt-4 block text-sm">
            <span className="block font-medium">Private note, just for you (optional)</span>
            <span className="block text-xs text-text-secondary">
              Only you ever see this. Families are never told a time is blocked, or why.
            </span>
            <input
              className="mt-1 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 py-2 text-sm"
              value={value.privateNote}
              placeholder="Dentist, school run, holiday…"
              onChange={(event) => {
                set('privateNote', event.target.value);
              }}
            />
          </label>
        )}

        {invalid ? (
          <p className="mt-3 text-sm text-status-critical">
            The end time needs to be after the start time.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || invalid}
              onClick={() => {
                onSave(value, target.rowId);
              }}
            >
              {isExisting ? 'Save changes' : 'Add to calendar'}
            </Button>
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          {target.canDelete && target.rowId !== undefined ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                onDelete(target.rowId as string);
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
