'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Alert, Button, Label, StatusBadge } from '@studdy/design-system';
import { sendLessonRequestAction, type RequestFormState } from '@/lib/requests/actions';

const initialState: RequestFormState = { error: null };

export interface ComposerTutor {
  tutorProfileId: string;
  tutorFirstName: string;
  /** Serialised: BigInt cannot cross the server/client boundary. */
  priceAmountMinor: string;
  currencyCode: string;
  /** Which of the chosen times this tutor can actually do, already formatted. */
  canDoLabels: readonly string[];
}

export interface ChosenTime {
  iso: string;
  label: string;
}

export interface RequestComposerProps {
  subjectSectionId: string;
  subjectDisplayName: string;
  studentName: string;
  fanOutCap: number;
  timesHref: string;
  chosenTimes: readonly ChosenTime[];
  shortlist: readonly ComposerTutor[];
}

function formatMoney(amountMinor: string, currencyCode: string): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: currencyCode }).format(
    Number(amountMinor) / 100,
  );
}

/**
 * The last look before a request goes out.
 *
 * The times are already decided — they came from the availability grid, where
 * they were real bookable slots. What is left is who to ask, and the honest
 * statement of what each tutor will actually be asked about.
 *
 * A tutor who can do none of the chosen times is shown as such and cannot be
 * selected: sending them a request they can only decline wastes their time and
 * leaves the family waiting out a deadline for an answer that was never
 * possible (D-2).
 */
export function RequestComposer({
  subjectSectionId,
  subjectDisplayName,
  studentName,
  fanOutCap,
  timesHref,
  chosenTimes,
  shortlist,
}: RequestComposerProps) {
  const [state, formAction, pending] = useActionState(sendLessonRequestAction, initialState);
  const askable = shortlist.filter((tutor) => tutor.canDoLabels.length > 0);
  const [selected, setSelected] = useState<readonly string[]>(
    askable.slice(0, fanOutCap).map((tutor) => tutor.tutorProfileId),
  );
  const [formatCode, setFormatCode] = useState('online');
  const [notes, setNotes] = useState('');

  function toggle(tutorProfileId: string): void {
    setSelected((current) =>
      current.includes(tutorProfileId)
        ? current.filter((id) => id !== tutorProfileId)
        : current.length >= fanOutCap
          ? current
          : [...current, tutorProfileId],
    );
  }

  const chosen = shortlist.filter((tutor) => selected.includes(tutor.tutorProfileId));
  const unavailable = shortlist.filter((tutor) => tutor.canDoLabels.length === 0);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="subjectSectionId" value={subjectSectionId} />
      {chosen.map((tutor) => (
        <input
          key={tutor.tutorProfileId}
          type="hidden"
          name="tutorProfileId"
          value={tutor.tutorProfileId}
        />
      ))}
      {/*
        Only tutor ids and the chosen instants are submitted. The priced service
        version is resolved server-side from the subject, so the browser cannot
        influence pricing, and each tutor's offered subset is recomputed against
        live availability rather than trusted from here.
      */}
      {chosenTimes.map((time) => (
        <input key={time.iso} type="hidden" name="time" value={time.iso} />
      ))}
      <input type="hidden" name="formatCode" value={formatCode} />
      <input type="hidden" name="notesForTutors" value={notes} />

      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}
      {state.issues?.['times'] !== undefined ? (
        <Alert tone="critical">{state.issues['times']}</Alert>
      ) : null}

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-text-primary">
            Times you chose ({chosenTimes.length})
          </h2>
          <Button variant="quiet" size="sm" asChild>
            <Link href={timesHref}>Change times</Link>
          </Button>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {chosenTimes.map((time) => (
            <li
              key={time.iso}
              className="rounded-md bg-surface-muted px-2 py-1 text-sm tabular-nums text-text-secondary"
            >
              {time.label}
            </li>
          ))}
        </ul>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-text-primary">
          Which tutors should we ask? (up to {fanOutCap})
        </legend>
        {state.issues?.['targets'] !== undefined ? (
          <p role="alert" className="mb-2 text-sm text-status-critical">
            {state.issues['targets']}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {shortlist.map((tutor) => {
            const isSelected = selected.includes(tutor.tutorProfileId);
            const canDoNone = tutor.canDoLabels.length === 0;
            const atCap = !isSelected && selected.length >= fanOutCap;
            const disabled = canDoNone || atCap;
            return (
              <label
                key={tutor.tutorProfileId}
                className={`flex items-start gap-3 rounded-[var(--radius-medium)] border p-4 ${
                  canDoNone
                    ? 'cursor-not-allowed border-surface-border bg-surface-card-secondary opacity-70'
                    : isSelected
                      ? 'cursor-pointer border-brand-purple bg-brand-lavender/50'
                      : atCap
                        ? 'cursor-not-allowed border-surface-border bg-surface-card-secondary opacity-60'
                        : 'cursor-pointer border-surface-border bg-surface-card hover:border-text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={isSelected && !canDoNone}
                  disabled={disabled}
                  onChange={() => {
                    toggle(tutor.tutorProfileId);
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text-primary">{tutor.tutorFirstName}</span>
                    {canDoNone ? (
                      <StatusBadge family="pending">None of your times</StatusBadge>
                    ) : (
                      <StatusBadge family="active">
                        {tutor.canDoLabels.length} of your {chosenTimes.length}
                      </StatusBadge>
                    )}
                  </span>
                  <span className="block text-sm text-text-secondary">
                    {formatMoney(tutor.priceAmountMinor, tutor.currencyCode)} for this lesson
                  </span>
                  {canDoNone ? null : (
                    <span className="mt-1 block text-sm text-text-muted">
                      Will be asked about: {tutor.canDoLabels.join(' · ')}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {unavailable.length > 0 ? (
        <Alert tone="warning" title="Some tutors cannot do any of your times">
          {unavailable.map((tutor) => tutor.tutorFirstName).join(' and ')}{' '}
          {unavailable.length === 1 ? 'is' : 'are'} not free at any of the times you chose, so they
          will not be asked. You can{' '}
          <Link className="underline" href={timesHref}>
            add a time they can do
          </Link>{' '}
          or send without them.
        </Alert>
      ) : null}

      <div className="flex flex-col sm:max-w-xs">
        <Label htmlFor="format">Where</Label>
        <select
          id="format"
          className="h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted"
          value={formatCode}
          onChange={(event) => {
            setFormatCode(event.target.value);
          }}
        >
          <option value="online">Online</option>
          <option value="in_person">In person</option>
        </select>
        {state.issues?.['formatCode'] !== undefined ? (
          <p role="alert" className="mt-1 text-sm text-status-critical">
            {state.issues['formatCode']}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col">
        <Label htmlFor="notes">Anything the tutors should know? (optional)</Label>
        <textarea
          id="notes"
          rows={3}
          className="w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card p-3 text-base text-text-primary hover:border-text-muted"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
        <p className="mt-1 text-sm text-text-secondary">
          Every tutor you ask sees this, along with {studentName}&rsquo;s year level and{' '}
          {subjectDisplayName}.
        </p>
      </div>

      {state.issues?.['paymentMethod'] !== undefined ? (
        <Alert tone="warning" title="Payment method needed">
          {state.issues['paymentMethod']}
        </Alert>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || chosen.length === 0}>
          {pending
            ? 'Sending…'
            : `Send request to ${chosen.length} ${chosen.length === 1 ? 'tutor' : 'tutors'}`}
        </Button>
      </div>
    </form>
  );
}
