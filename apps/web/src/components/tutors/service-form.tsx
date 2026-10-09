'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Label, TextareaField } from '@studdy/design-system';
import {
  SERVICE_DURATION_MINUTES,
  SERVICE_OPTIONS_MAX,
  type ServiceOptionInput,
  type TutorServiceInput,
} from '@studdy/domain/tutors';
import { INITIAL_TUTOR_FORM_STATE, type TutorFormState } from '@/lib/tutors/form-state';

export interface ServiceFormProps {
  readonly initial: TutorServiceInput;
  /** Present when editing an existing service; absent when creating one. */
  readonly reference?: string;
  readonly subjects: readonly { readonly subjectId: string; readonly displayName: string }[];
  /** What the tutor's profile offers, which is all a service may be taught as. */
  readonly offersOnline: boolean;
  readonly offersInPerson: boolean;
  readonly saveAction: (state: TutorFormState, formData: FormData) => Promise<TutorFormState>;
}

const YEARS = Array.from({ length: 13 }, (_, index) => index + 1);

const SELECT_CLASS =
  'h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted';

function FieldError({ message }: { message: string | undefined }) {
  return message === undefined ? null : (
    <p role="alert" className="mt-1 text-sm text-status-critical">
      {message}
    </p>
  );
}

/**
 * A tutor's service, on one page: what it teaches, who for, how, and what it
 * costs at each lesson length.
 *
 * Every field is controlled, because React resets an uncontrolled form after an
 * action finishes and a failed save must not blank what was typed.
 *
 * The option rows are always rendered as `options.N.*` for N up to the maximum,
 * with the unused ones simply absent, so the server reads a fixed set of names
 * and never has to trust a count the browser sent.
 */
export function ServiceForm({
  initial,
  reference,
  subjects,
  offersOnline,
  offersInPerson,
  saveAction,
}: ServiceFormProps) {
  const [values, setValues] = useState<TutorServiceInput>(initial);
  const [state, save, saving] = useActionState(saveAction, INITIAL_TUTOR_FORM_STATE);
  const issues = state.issues;

  const set = <K extends keyof TutorServiceInput>(key: K, value: TutorServiceInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const setOption = (index: number, key: keyof ServiceOptionInput, value: string) =>
    setValues((current) => ({
      ...current,
      options: current.options.map((option, slot) =>
        slot === index ? { ...option, [key]: value } : option,
      ),
    }));

  const addOption = () =>
    setValues((current) => {
      const used = new Set(current.options.map((option) => option.durationMinutes));
      const next = SERVICE_DURATION_MINUTES.find((minutes) => !used.has(String(minutes)));
      return {
        ...current,
        options: [...current.options, { durationMinutes: String(next ?? ''), price: '' }],
      };
    });

  const removeOption = (index: number) =>
    setValues((current) => ({
      ...current,
      options: current.options.filter((_, slot) => slot !== index),
    }));

  /*
   * SUBMITTED BY HAND, NOT THROUGH `action=`. React resets a form after its
   * action finishes, and a reset puts every <select> back to its first option
   * even though it is controlled: after a failed save the dropdowns read
   * "Choose" while the typed text stayed. Calling the action ourselves skips the
   * reset, so what is on screen is always what the state holds.
   */
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => save(formData));
  };

  const formats = [
    offersOnline ? { value: 'online', label: 'Online' } : null,
    offersInPerson ? { value: 'in_person', label: 'In person' } : null,
    offersOnline && offersInPerson ? { value: 'either', label: 'Online or in person' } : null,
  ].filter((format): format is { value: string; label: string } => format !== null);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      {reference !== undefined ? <input type="hidden" name="reference" value={reference} /> : null}
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">What you are offering</h2>
        <div>
          <Label htmlFor="service-subject">Subject</Label>
          <select
            id="service-subject"
            name="subjectId"
            value={values.subjectId}
            onChange={(event) => set('subjectId', event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Choose</option>
            {subjects.map((subject) => (
              <option key={subject.subjectId} value={subject.subjectId}>
                {subject.displayName}
              </option>
            ))}
          </select>
          <FieldError message={issues['subjectId']} />
        </div>
        <Field
          label="Service name"
          name="displayName"
          value={values.displayName}
          onChange={(event) => set('displayName', event.target.value)}
          error={issues['displayName']}
          helper="What families see, for example “Year 9 and 10 maths”."
        />
        <TextareaField
          label="What a family gets"
          name="description"
          rows={5}
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          error={issues['description']}
          helper="What you cover and how a lesson runs. Families see this on your profile."
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Who it is for</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="service-year-from">Youngest year level</Label>
            <select
              id="service-year-from"
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
            <Label htmlFor="service-year-to">Oldest year level</Label>
            <select
              id="service-year-to"
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
        <div>
          <Label htmlFor="service-format">How it is taught</Label>
          <select
            id="service-format"
            name="formatCode"
            value={values.formatCode}
            onChange={(event) => set('formatCode', event.target.value)}
            className={SELECT_CLASS}
          >
            {formats.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-text-secondary">
            Only the formats on your profile are offered here.
          </p>
          <FieldError message={issues['formatCode']} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Lesson lengths and prices</h2>
          <p className="mt-1 text-sm text-text-secondary">
            The price a family pays for one lesson of that length, in New Zealand dollars.
            Studdy&rsquo;s fee comes out of this amount.
          </p>
          <FieldError message={issues['options']} />
        </div>
        {values.options.map((option, index) => (
          <div
            key={index}
            className="grid items-start gap-4 rounded-[var(--radius-gentle)] border border-surface-border p-4 sm:grid-cols-[1fr_1fr_auto]"
          >
            <div>
              <Label htmlFor={`option-duration-${String(index)}`}>Lesson length</Label>
              <select
                id={`option-duration-${String(index)}`}
                name={`options.${String(index)}.durationMinutes`}
                value={option.durationMinutes}
                onChange={(event) => setOption(index, 'durationMinutes', event.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Choose</option>
                {SERVICE_DURATION_MINUTES.map((minutes) => (
                  <option key={minutes} value={String(minutes)}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
              <FieldError message={issues[`options.${String(index)}.durationMinutes`]} />
            </div>
            <Field
              label="Price ($)"
              name={`options.${String(index)}.price`}
              inputMode="decimal"
              value={option.price}
              onChange={(event) => setOption(index, 'price', event.target.value)}
              error={issues[`options.${String(index)}.price`]}
            />
            {values.options.length > 1 ? (
              <div className="sm:pt-6">
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  onClick={() => removeOption(index)}
                  aria-label={`Remove lesson length ${String(index + 1)}`}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        {values.options.length < SERVICE_OPTIONS_MAX ? (
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={addOption}>
              Add another lesson length
            </Button>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : reference === undefined ? 'Save as a draft' : 'Save changes'}
        </Button>
        <p className="text-sm text-text-secondary">
          Saving does not publish anything. You send it to Studdy for review as a separate step.
        </p>
      </div>
    </form>
  );
}
