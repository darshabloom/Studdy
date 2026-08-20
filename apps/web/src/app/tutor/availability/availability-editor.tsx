'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
  /**
   * Where focus goes if the control that opened this is gone by the time it
   * closes. Saving refreshes the week, so the very block a tutor clicked is
   * usually replaced — without a fallback their focus would land on the body
   * and a keyboard user would have to tab in from the top of the page again.
   */
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/** Everything a person can tab to. Used to keep focus inside the dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AvailabilityEditor({
  target,
  dayDates,
  busy,
  onCancel,
  onSave,
  onDelete,
  fallbackFocusRef,
}: AvailabilityEditorProps): ReactNode {
  const [value, setValue] = useState<EditorValue>(target.value);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const isExisting = target.rowId !== undefined;
  const titleId = 'availability-editor-title';
  const descriptionId = 'availability-editor-description';

  // Reopening on a different block must reset the fields, not keep the last
  // block's times: the editor is one component serving every entry point.
  useEffect(() => {
    setValue(target.value);
  }, [target]);

  /**
   * Focus management, which is most of what makes this a dialog rather than a
   * panel that happens to sit on top.
   *
   * Focus moves to the title on open, so a screen reader announces what just
   * appeared instead of leaving the user on the calendar behind it. Tab is
   * trapped, because tabbing onto a calendar the dialog is covering is how a
   * keyboard user gets silently lost. On close focus returns to whatever opened
   * this — and to the fallback when that control no longer exists, which is the
   * normal case after a save re-renders the week.
   */
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (dialog === null) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      // Wrap at both ends, and pull focus back in if it has escaped entirely —
      // which it has on open, when focus sits on the non-tabbable title.
      const active = document.activeElement;
      if (!dialog.contains(active) || (event.shiftKey && active === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const fallback = fallbackFocusRef?.current ?? null;
      if (opener !== null && opener.isConnected) opener.focus();
      else if (fallback !== null && fallback.isConnected) fallback.focus();
    };
  }, [onCancel, fallbackFocusRef]);

  const set = <K extends keyof EditorValue>(key: K, next: EditorValue[K]): void => {
    setValue((current) => ({ ...current, [key]: next }));
  };

  const scoped = value.kind !== 'blocked';
  const invalid = value.endMinutes <= value.startMinutes;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-medium)] border border-surface-border bg-surface-card p-5 shadow-lg sm:rounded-[var(--radius-medium)]"
      >
        <h2
          id={titleId}
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg font-semibold outline-none"
        >
          {isExisting ? 'Edit this time' : 'Add availability'}
        </h2>
        <p id={descriptionId} className="mt-1 text-sm text-text-secondary">
          {isExisting
            ? 'Change when this happens, or remove it. Press Escape to close without saving.'
            : 'Choose what kind of time this is and when it happens. Press Escape to close without saving.'}
        </p>

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
            {/*
             * Real radios under a segmented skin. These are three mutually
             * exclusive choices, so a radiogroup gives arrow-key movement and
             * the right announcement for free — a row of toggle buttons would
             * read as three unrelated switches, any number of which might be on.
             */}
            <div className="mt-2 inline-flex rounded-[var(--radius-medium)] border border-surface-border bg-surface-card-secondary p-0.5">
              {FORMATS.map((format) => (
                <label
                  key={format.id}
                  className={`cursor-pointer rounded-[var(--radius-gentle)] px-3 py-1.5 text-sm font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-brand-purple ${
                    value.formatCode === format.id
                      ? 'bg-surface-card text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <input
                    type="radio"
                    name="availability-format"
                    className="sr-only"
                    checked={value.formatCode === format.id}
                    onChange={() => {
                      set('formatCode', format.id);
                    }}
                  />
                  {format.label}
                </label>
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
