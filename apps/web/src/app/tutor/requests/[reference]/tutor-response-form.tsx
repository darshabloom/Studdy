'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Label } from '@studdy/design-system';
import {
  acceptTimeAction,
  declineRequestAction,
  type TutorResponseFormState,
} from '@/lib/requests/tutor-actions';

const initialState: TutorResponseFormState = { error: null };

export interface TutorResponseOption {
  id: string;
  label: string;
}

export interface TutorResponseFormProps {
  reference: string;
  options: readonly TutorResponseOption[];
}

const DECLINE_REASONS = [
  { code: '', label: 'No reason (optional)' },
  { code: 'not_available', label: 'Not available at those times' },
  { code: 'outside_my_subjects', label: 'Outside what I teach' },
  { code: 'too_far_away', label: 'Too far away' },
  { code: 'at_capacity', label: 'Taking no new students right now' },
] as const;

/**
 * Accept exactly one offered time, or decline.
 *
 * Accepting is a single choice by design (D-4) — a radio group, not
 * checkboxes — and the database enforces the same thing underneath, so a
 * crafted form cannot claim two.
 */
export function TutorResponseForm({ reference, options }: TutorResponseFormProps) {
  const [acceptState, acceptAction, accepting] = useActionState(acceptTimeAction, initialState);
  const [declineState, declineAction, declining] = useActionState(
    declineRequestAction,
    initialState,
  );
  const [chosen, setChosen] = useState<string>(options[0]?.id ?? '');
  const [reasonCode, setReasonCode] = useState('');

  return (
    <div className="mt-4 flex flex-col gap-5">
      {acceptState.error !== null ? <Alert tone="critical">{acceptState.error}</Alert> : null}
      {declineState.error !== null ? <Alert tone="critical">{declineState.error}</Alert> : null}

      {options.length === 0 ? (
        <Alert tone="information" title="None of these times are still open">
          You can still decline this request.
        </Alert>
      ) : (
        <form action={acceptAction} className="flex flex-col gap-3">
          <input type="hidden" name="reference" value={reference} />
          <input type="hidden" name="tutorRequestTimeOptionId" value={chosen} />
          <fieldset>
            <legend className="sr-only">Choose a time to accept</legend>
            <div className="flex flex-col gap-2">
              {options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-medium)] border p-3 ${
                    chosen === option.id
                      ? 'border-brand-purple bg-brand-lavender/50'
                      : 'border-surface-border hover:border-text-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="chosenTime"
                    value={option.id}
                    checked={chosen === option.id}
                    onChange={() => {
                      setChosen(option.id);
                    }}
                  />
                  <span className="font-medium tabular-nums text-text-primary">{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Button type="submit" disabled={accepting || chosen === ''}>
              {accepting ? 'Accepting…' : 'Accept this time'}
            </Button>
          </div>
        </form>
      )}

      <form
        action={declineAction}
        className="flex flex-col gap-3 border-t border-surface-border pt-4"
      >
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="declineReasonCode" value={reasonCode} />
        <div className="flex flex-col sm:max-w-sm">
          <Label htmlFor="decline-reason">If you cannot take it</Label>
          <select
            id="decline-reason"
            className="h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted"
            value={reasonCode}
            onChange={(event) => {
              setReasonCode(event.target.value);
            }}
          >
            {DECLINE_REASONS.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Button type="submit" variant="secondary" disabled={declining}>
            {declining ? 'Declining…' : 'Decline this request'}
          </Button>
        </div>
      </form>
    </div>
  );
}
