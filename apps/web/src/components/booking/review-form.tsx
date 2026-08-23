'use client';

import { useActionState, type ReactNode } from 'react';
import { Alert, Button, Label } from '@studdy/design-system';
import { sendBookingRequestAction, type BookingFormState } from '@/lib/booking/actions';

const initialState: BookingFormState = { error: null };

export interface ReviewFormProps {
  readonly child: string;
  readonly subject: string;
  readonly tutor: string;
  readonly version: string;
  readonly format: string;
  readonly times: readonly string[];
  readonly tutorName: string;
}

/**
 * The last screen, and the honest one.
 *
 * The button says SEND A REQUEST, because that is what happens. A tutor still
 * has to accept, and calling this "Book" or "Confirm" would be telling a family
 * they have a lesson when what they have is a question outstanding. Everything
 * about the wording here follows from that.
 *
 * Every field is re-resolved server-side in the action — this form carries
 * identifiers, never prices, durations or names.
 */
export function ReviewForm({
  child,
  subject,
  tutor,
  version,
  format,
  times,
  tutorName,
}: ReviewFormProps): ReactNode {
  const [state, formAction, pending] = useActionState(sendBookingRequestAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="child" value={child} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="tutor" value={tutor} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="format" value={format} />
      {times.map((iso) => (
        <input key={iso} type="hidden" name="time" value={iso} />
      ))}

      <div>
        <Label htmlFor="notesForTutors">
          Anything you&rsquo;d like the tutor to know? (optional)
        </Label>
        <textarea
          id="notesForTutors"
          name="notesForTutors"
          rows={3}
          maxLength={1000}
          placeholder="What you are hoping to work on, or anything that would help them prepare."
          className="mt-1 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple"
        />
      </div>

      {state.error !== null ? (
        <Alert tone="warning" title="Nothing was sent">
          {state.error}
        </Alert>
      ) : null}
      {state.issues !== undefined
        ? Object.entries(state.issues).map(([key, message]) => (
            <Alert key={key} tone="warning" title="Check this before sending">
              {message}
            </Alert>
          ))
        : null}

      {/* No second copy of "Aroha still has to accept" here — the heading above
          already says it, and repeating it beside the button reads as though it
          were a different caveat. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Sending…' : `Send request to ${tutorName}`}
        </Button>
      </div>
    </form>
  );
}
