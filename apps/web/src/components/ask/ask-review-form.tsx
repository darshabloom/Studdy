'use client';

import { useActionState, type ReactNode } from 'react';
import { Alert, Button, Label } from '@studdy/design-system';
import { sendAskRequestAction, type AskFormState } from '@/lib/ask/actions';

const initialState: AskFormState = { error: null };

export interface AskReviewFormProps {
  readonly subjectSectionId: string;
  readonly duration: number;
  readonly format: string;
  readonly times: readonly string[];
  readonly tutorCount: number;
}

/**
 * The last screen, and the honest one.
 *
 * The button says SEND REQUESTS, because that is what happens. Every tutor
 * still has to accept, and calling this "Book" would be telling a family they
 * have a lesson when what they have is a question outstanding.
 *
 * The form carries ANSWERS, never the tutors. Who receives the request is
 * re-derived server-side from the shortlist and these answers, so a crafted
 * form cannot add a tutor the family never saved or pin one to a price they
 * were never shown.
 */
export function AskReviewForm({
  subjectSectionId,
  duration,
  format,
  times,
  tutorCount,
}: AskReviewFormProps): ReactNode {
  const [state, formAction, pending] = useActionState(sendAskRequestAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="subjectSectionId" value={subjectSectionId} />
      <input type="hidden" name="duration" value={String(duration)} />
      <input type="hidden" name="format" value={format} />
      {times.map((iso) => (
        <input key={iso} type="hidden" name="time" value={iso} />
      ))}

      <div>
        <Label htmlFor="notesForTutors">
          Anything you&rsquo;d like the tutors to know? (optional)
        </Label>
        <textarea
          id="notesForTutors"
          name="notesForTutors"
          rows={3}
          maxLength={1000}
          placeholder="What you are hoping to work on, or anything that would help them prepare."
          className="mt-1 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple"
        />
        <p className="mt-1 text-xs text-text-muted">Every tutor you ask will see this.</p>
      </div>

      {state.error !== null ? (
        <Alert tone="warning" title="Nothing was sent">
          {state.error}
        </Alert>
      ) : null}

      <div>
        <Button size="lg" type="submit" disabled={pending}>
          {pending
            ? 'Sending…'
            : `Send request to ${String(tutorCount)} ${tutorCount === 1 ? 'tutor' : 'tutors'}`}
        </Button>
        <p className="mt-2 text-xs text-text-muted">
          Nothing is booked yet. Each tutor can accept one of your times or decline.
        </p>
      </div>
    </form>
  );
}
