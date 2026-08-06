'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Field, Label } from '@studdy/design-system';
import { sendLessonRequestAction, type RequestFormState } from '@/lib/requests/actions';

const initialState: RequestFormState = { error: null };

export interface ComposerTutor {
  tutorProfileId: string;
  tutorFirstName: string;
  /** Serialised: BigInt cannot cross the server/client boundary. */
  priceAmountMinor: string;
  currencyCode: string;
}

export interface RequestComposerProps {
  subjectSectionId: string;
  subjectDisplayName: string;
  studentName: string;
  fanOutCap: number;
  minimumNoticeHours: number;
  shortlist: readonly ComposerTutor[];
}

function formatMoney(amountMinor: string, currencyCode: string): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: currencyCode }).format(
    Number(amountMinor) / 100,
  );
}

export function RequestComposer({
  subjectSectionId,
  subjectDisplayName,
  studentName,
  fanOutCap,
  minimumNoticeHours,
  shortlist,
}: RequestComposerProps) {
  const [state, formAction, pending] = useActionState(sendLessonRequestAction, initialState);
  const [selected, setSelected] = useState<readonly string[]>(
    shortlist.slice(0, fanOutCap).map((tutor) => tutor.tutorProfileId),
  );
  const [lessonDate, setLessonDate] = useState('');
  const [lessonTime, setLessonTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
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
        Only tutor ids are submitted. The priced service version is resolved
        server-side from the subject, so the browser cannot influence pricing.
      */}
      <input type="hidden" name="lessonDate" value={lessonDate} />
      <input type="hidden" name="lessonTime" value={lessonTime} />
      <input type="hidden" name="durationMinutes" value={durationMinutes} />
      <input type="hidden" name="formatCode" value={formatCode} />
      <input type="hidden" name="notesForTutors" value={notes} />

      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}

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
            const atCap = !isSelected && selected.length >= fanOutCap;
            return (
              <label
                key={tutor.tutorProfileId}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-medium)] border p-4 ${
                  isSelected
                    ? 'border-brand-purple bg-brand-lavender/50'
                    : atCap
                      ? 'border-surface-border bg-surface-card-secondary opacity-60'
                      : 'border-surface-border bg-surface-card hover:border-text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={isSelected}
                  disabled={atCap}
                  onChange={() => toggle(tutor.tutorProfileId)}
                />
                <span>
                  <span className="block font-medium text-text-primary">
                    {tutor.tutorFirstName}
                  </span>
                  <span className="block text-sm text-text-secondary">
                    {formatMoney(tutor.priceAmountMinor, tutor.currencyCode)} for this lesson
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Lesson date"
          name="lessonDateInput"
          type="date"
          required
          value={lessonDate}
          onChange={(event) => setLessonDate(event.target.value)}
          error={state.issues?.['lessonDate'] ?? state.issues?.['proposedStartAt']}
          helper={`At least ${minimumNoticeHours} hours from now.`}
        />
        <Field
          label="Start time"
          name="lessonTimeInput"
          type="time"
          required
          value={lessonTime}
          onChange={(event) => setLessonTime(event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <Label htmlFor="duration">How long</Label>
          <select
            id="duration"
            className="h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted"
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
          >
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1 hour 30 minutes</option>
            <option value="120">2 hours</option>
          </select>
        </div>
        <div className="flex flex-col">
          <Label htmlFor="format">Where</Label>
          <select
            id="format"
            className="h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted"
            value={formatCode}
            onChange={(event) => setFormatCode(event.target.value)}
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
      </div>

      <div className="flex flex-col">
        <Label htmlFor="notes">Anything the tutors should know? (optional)</Label>
        <textarea
          id="notes"
          rows={3}
          className="w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card p-3 text-base text-text-primary hover:border-text-muted"
          placeholder=""
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
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
