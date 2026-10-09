'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Field, Label, TextareaField } from '@studdy/design-system';
import type { TutorProfileInput } from '@studdy/domain/tutors';
import { INITIAL_TUTOR_FORM_STATE, type TutorFormState } from '@/lib/tutors/form-state';

export interface ProfileFormProps {
  readonly initial: TutorProfileInput;
  readonly saveAction: (state: TutorFormState, formData: FormData) => Promise<TutorFormState>;
}

const YEARS = Array.from({ length: 13 }, (_, index) => index + 1);

const SELECT_CLASS =
  'h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted';

const ROOM_OPTIONS = [
  { value: 'accepting_new', label: 'Accepting new students' },
  { value: 'limited', label: 'Limited availability' },
] as const;

function FieldError({ message }: { message: string | undefined }) {
  return message === undefined ? null : (
    <p role="alert" className="mt-1 text-sm text-status-critical">
      {message}
    </p>
  );
}

/**
 * The part of a tutor's public profile that is theirs to change.
 *
 * The name is absent on purpose: it was checked against a real person when the
 * tutor was approved. Controlled throughout, so a failed save keeps what was typed.
 */
export function ProfileForm({ initial, saveAction }: ProfileFormProps) {
  const [values, setValues] = useState<TutorProfileInput>(initial);
  const [state, save, saving] = useActionState(saveAction, INITIAL_TUTOR_FORM_STATE);
  const issues = state.issues;

  const set = <K extends keyof TutorProfileInput>(key: K, value: TutorProfileInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form action={save} className="flex flex-col gap-6" noValidate>
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}
      {state.message !== null ? <Alert tone="success">{state.message}</Alert> : null}

      <Field
        label="Headline"
        name="headline"
        value={values.headline}
        onChange={(event) => set('headline', event.target.value)}
        error={issues['headline']}
        helper="One line families see first, for example “Patient maths tutor for years 7 to 10”."
      />
      <TextareaField
        label="How you teach"
        name="teachingApproach"
        rows={6}
        value={values.teachingApproach}
        onChange={(event) => set('teachingApproach', event.target.value)}
        error={issues['teachingApproach']}
        helper="Shown on your profile as “What a lesson is like”."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-year-from">Youngest year level</Label>
          <select
            id="profile-year-from"
            name="yearLevelFrom"
            value={values.yearLevelFrom}
            onChange={(event) => set('yearLevelFrom', event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Choose</option>
            {YEARS.map((year) => (
              <option key={year} value={String(year)}>
                Year {year}
              </option>
            ))}
          </select>
          <FieldError message={issues['yearLevelFrom']} />
        </div>
        <div>
          <Label htmlFor="profile-year-to">Oldest year level</Label>
          <select
            id="profile-year-to"
            name="yearLevelTo"
            value={values.yearLevelTo}
            onChange={(event) => set('yearLevelTo', event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Choose</option>
            {YEARS.map((year) => (
              <option key={year} value={String(year)}>
                Year {year}
              </option>
            ))}
          </select>
          <FieldError message={issues['yearLevelTo']} />
        </div>
      </div>

      <div role="group" aria-label="Lesson formats">
        <Label htmlFor="profile-format-online">How you teach lessons</Label>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              id="profile-format-online"
              type="checkbox"
              name="offersOnline"
              checked={values.offersOnline}
              onChange={(event) => set('offersOnline', event.target.checked)}
            />
            Online
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="offersInPerson"
              checked={values.offersInPerson}
              onChange={(event) => set('offersInPerson', event.target.checked)}
            />
            In person
          </label>
        </div>
        <FieldError message={issues['formats']} />
      </div>

      <div>
        <Label htmlFor="profile-room">Room for new students</Label>
        <select
          id="profile-room"
          name="availabilityLabelCode"
          value={values.availabilityLabelCode}
          onChange={(event) => set('availabilityLabelCode', event.target.value)}
          className={SELECT_CLASS}
        >
          {ROOM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-text-secondary">
          A label on your profile. The times families can actually ask for come from your
          availability.
        </p>
        <FieldError message={issues['availabilityLabelCode']} />
      </div>

      <div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}
