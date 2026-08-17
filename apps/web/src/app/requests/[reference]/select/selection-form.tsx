'use client';

import { useActionState, useState } from 'react';
import { Alert, Button } from '@studdy/design-system';
import { selectTutorAction, type RequestFormState } from '@/lib/requests/actions';

const initialState: RequestFormState = { error: null };

export interface SelectionChoice {
  tutorRequestReference: string;
  tutorFirstName: string;
  whenLabel: string;
  priceLabel: string;
}

export interface SelectionFormProps {
  reference: string;
  choices: readonly SelectionChoice[];
}

/**
 * One choice, made once.
 *
 * A radio group rather than a button per tutor: choosing is a comparison, and
 * a row of equally-weighted "Choose" buttons invites a misclick on a decision
 * that closes every other tutor's request. The server guards it too — a second
 * submission finds the request no longer in `ready_for_selection`.
 */
export function SelectionForm({ reference, choices }: SelectionFormProps) {
  const [state, formAction, pending] = useActionState(selectTutorAction, initialState);
  const [chosen, setChosen] = useState<string>(choices[0]?.tutorRequestReference ?? '');

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="tutorRequestReference" value={chosen} />

      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}
      {state.issues?.['selection'] !== undefined ? (
        <p role="alert" className="text-sm text-status-critical">
          {state.issues['selection']}
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-text-primary">
          Accepted tutors and times
        </legend>
        <div className="flex flex-col gap-2">
          {choices.map((choice) => (
            <label
              key={choice.tutorRequestReference}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-medium)] border p-4 ${
                chosen === choice.tutorRequestReference
                  ? 'border-brand-purple bg-brand-lavender/50'
                  : 'border-surface-border bg-surface-card hover:border-text-muted'
              }`}
            >
              <input
                type="radio"
                name="choice"
                className="mt-1"
                value={choice.tutorRequestReference}
                checked={chosen === choice.tutorRequestReference}
                onChange={() => {
                  setChosen(choice.tutorRequestReference);
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-text-primary">{choice.tutorFirstName}</span>
                <span className="block text-sm tabular-nums text-text-secondary">
                  {choice.whenLabel}
                </span>
                <span className="block text-sm tabular-nums text-text-muted">
                  {choice.priceLabel} for this lesson
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Button type="submit" disabled={pending || chosen === ''}>
          {pending ? 'Confirming…' : 'Choose this tutor'}
        </Button>
      </div>
    </form>
  );
}
