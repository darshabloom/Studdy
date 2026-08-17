'use client';

import { useActionState, type ReactNode } from 'react';
import { Alert, Button, Field, Label } from '@studdy/design-system';
import { WEEKDAY_LABELS } from '@studdy/domain/availability';
import {
  addAvailabilityRuleAction,
  addBlockedPeriodAction,
  type AvailabilityFormState,
} from '@/lib/availability/actions';

const INITIAL: AvailabilityFormState = { error: null, message: null };

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A labelled <select>, since Field renders its own <input>. */
function SelectField({
  id,
  name,
  label,
  defaultValue,
  error,
  children,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error?: string | undefined;
  children: ReactNode;
}): ReactNode {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-describedby={error !== undefined ? errorId : undefined}
        aria-invalid={error !== undefined}
        className="h-11 w-full rounded-[var(--radius-medium)] border border-border-default bg-surface-raised px-3"
      >
        {children}
      </select>
      {error !== undefined ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-status-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AddAvailabilityRuleForm({ timeZone }: { timeZone: string }): ReactNode {
  const [state, formAction, pending] = useActionState(addAvailabilityRuleAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="ianaTimeZone" value={timeZone} />

      {state.error !== null ? (
        <Alert tone="critical" title="That did not save">
          {state.error}
        </Alert>
      ) : null}
      {state.message !== null ? (
        <Alert tone="success" title="Saved">
          {state.message}
        </Alert>
      ) : null}

      <SelectField
        id="dayOfWeek"
        name="dayOfWeek"
        label="Day"
        defaultValue="1"
        error={state.issues?.['dayOfWeek']}
      >
        {WEEKDAY_LABELS.map((label, index) => (
          <option key={label} value={index}>
            {label}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="From"
          name="localStartTime"
          type="time"
          defaultValue="16:00"
          error={state.issues?.['localStartTime']}
        />
        <Field
          label="Until"
          name="localEndTime"
          type="time"
          defaultValue="18:00"
          error={state.issues?.['localEndTime']}
        />
      </div>

      <p className="text-sm text-text-secondary">
        These are your regular hours in <strong>{timeZone}</strong>. They repeat every week, and
        they stay at the same local time when the clocks change.
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add these hours'}
        </Button>
      </div>
    </form>
  );
}

export function AddBlockedPeriodForm({ timeZone }: { timeZone: string }): ReactNode {
  const [state, formAction, pending] = useActionState(addBlockedPeriodAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="ianaTimeZone" value={timeZone} />

      {state.error !== null ? (
        <Alert tone="critical" title="That did not save">
          {state.error}
        </Alert>
      ) : null}
      {state.message !== null ? (
        <Alert tone="success" title="Saved">
          {state.message}
        </Alert>
      ) : null}

      <SelectField id="effectCode" name="effectCode" label="What is this?" defaultValue="removes">
        <option value="removes">Block this time — I am not available</option>
        <option value="adds">Extra time — available on top of my usual hours</option>
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={todayValue()}
          error={state.issues?.['startDate']}
        />
        <Field
          label="Start time"
          name="startTime"
          type="time"
          defaultValue="09:00"
          error={state.issues?.['startTime']}
        />
        <Field
          label="End date"
          name="endDate"
          type="date"
          defaultValue={todayValue()}
          error={state.issues?.['endDate']}
        />
        <Field
          label="End time"
          name="endTime"
          type="time"
          defaultValue="17:00"
          error={state.issues?.['endTime']}
        />
      </div>

      <Field label="Private note (optional)" name="privateNote" maxLength={200} />

      {/*
        Said plainly, because a tutor deciding whether to record a real reason
        needs to know who can read it. Families receive only the times you are
        free — never a gap, and never why.
      */}
      <p className="text-sm text-text-secondary">
        Your note and your reason stay private to you. Families never see why you are unavailable —
        only the times you are free.
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
