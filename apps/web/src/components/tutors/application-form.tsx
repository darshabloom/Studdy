'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Field, Label, TextareaField } from '@studdy/design-system';
import type { TutorApplicationInput } from '@studdy/domain/tutors';
import { INITIAL_TUTOR_FORM_STATE, type TutorFormState } from '@/lib/tutors/form-state';

export interface ApplicationFormProps {
  readonly initial: TutorApplicationInput;
  readonly subjects: readonly { readonly subjectId: string; readonly displayName: string }[];
  readonly saveAction: (state: TutorFormState, formData: FormData) => Promise<TutorFormState>;
  readonly submitAction: (state: TutorFormState, formData: FormData) => Promise<TutorFormState>;
  /** True when a reviewer has asked for changes, so the button says resubmit. */
  readonly resubmitting: boolean;
}

const YEARS = Array.from({ length: 13 }, (_, index) => index + 1);
const REFERENCE_SLOTS = 3;

/**
 * The tutor application, on one page.
 *
 * ONE PAGE, NOT A WIZARD. Everything a reviewer needs is the same few sections,
 * and a single page lets an applicant see how much is left and go back freely. A
 * draft can be saved at any point and is never validated; only submission is, and
 * it saves first, so a mistake never costs anyone what they typed.
 *
 * Every field is controlled, because React resets an uncontrolled form after an
 * action finishes and a failed submission must not blank it.
 */
export function ApplicationForm({
  initial,
  subjects,
  saveAction,
  submitAction,
  resubmitting,
}: ApplicationFormProps) {
  const [values, setValues] = useState<TutorApplicationInput>(initial);
  const [saveState, save, saving] = useActionState(saveAction, INITIAL_TUTOR_FORM_STATE);
  const [submitState, submit, submitting] = useActionState(submitAction, INITIAL_TUTOR_FORM_STATE);

  const issues = submitState.issues;
  const set = <K extends keyof TutorApplicationInput>(key: K, value: TutorApplicationInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const setReference = (index: number, key: 'fullName' | 'email' | 'relationship', value: string) =>
    setValues((current) => ({
      ...current,
      references: Array.from({ length: REFERENCE_SLOTS }, (_, slot) => {
        const existing = current.references[slot] ?? { fullName: '', email: '', relationship: '' };
        return slot === index ? { ...existing, [key]: value } : existing;
      }),
    }));

  const toggleSubject = (subjectId: string) =>
    set(
      'subjectIds',
      values.subjectIds.includes(subjectId)
        ? values.subjectIds.filter((id) => id !== subjectId)
        : [...values.subjectIds, subjectId],
    );

  const busy = saving || submitting;

  return (
    <form className="flex flex-col gap-8" noValidate>
      {submitState.error !== null ? <Alert tone="critical">{submitState.error}</Alert> : null}
      {saveState.error !== null ? <Alert tone="critical">{saveState.error}</Alert> : null}
      {saveState.message !== null && submitState.error === null ? (
        <Alert tone="success">{saveState.message}</Alert>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Legal first name"
            name="legalFirstName"
            autoComplete="given-name"
            value={values.legalFirstName}
            onChange={(event) => set('legalFirstName', event.target.value)}
            error={issues['legalFirstName']}
            helper="Used to check who you are. Families never see it."
          />
          <Field
            label="Legal family name"
            name="legalFamilyName"
            autoComplete="family-name"
            value={values.legalFamilyName}
            onChange={(event) => set('legalFamilyName', event.target.value)}
            error={issues['legalFamilyName']}
          />
          <Field
            label="First name families will see"
            name="preferredFirstName"
            value={values.preferredFirstName}
            onChange={(event) => set('preferredFirstName', event.target.value)}
            error={issues['preferredFirstName']}
            helper="Families see this name only, never your family name."
          />
          <Field
            label="Phone (optional)"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => set('phone', event.target.value)}
            error={issues['phone']}
            helper="Only so Studdy can arrange your interview."
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">What you teach</h2>
        <div>
          <Label htmlFor="subject-list">Subjects</Label>
          <div
            id="subject-list"
            role="group"
            aria-label="Subjects"
            className="grid gap-2 sm:grid-cols-2"
          >
            {subjects.map((subject) => (
              <label key={subject.subjectId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="subjectId"
                  value={subject.subjectId}
                  checked={values.subjectIds.includes(subject.subjectId)}
                  onChange={() => toggleSubject(subject.subjectId)}
                />
                {subject.displayName}
              </label>
            ))}
          </div>
          {issues['subjectIds'] !== undefined ? (
            <p role="alert" className="mt-1 text-sm text-status-critical">
              {issues['subjectIds']}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="year-from">Lowest year level</Label>
            <select
              id="year-from"
              name="yearLevelFrom"
              value={values.yearLevelFrom}
              onChange={(event) => set('yearLevelFrom', event.target.value)}
              className="h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted"
            >
              <option value="">Choose</option>
              {YEARS.map((year) => (
                <option key={year} value={String(year)}>
                  Year {year}
                </option>
              ))}
            </select>
            {issues['yearLevelFrom'] !== undefined ? (
              <p role="alert" className="mt-1 text-sm text-status-critical">
                {issues['yearLevelFrom']}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="year-to">Highest year level</Label>
            <select
              id="year-to"
              name="yearLevelTo"
              value={values.yearLevelTo}
              onChange={(event) => set('yearLevelTo', event.target.value)}
              className="h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted"
            >
              <option value="">Choose</option>
              {YEARS.map((year) => (
                <option key={year} value={String(year)}>
                  Year {year}
                </option>
              ))}
            </select>
            {issues['yearLevelTo'] !== undefined ? (
              <p role="alert" className="mt-1 text-sm text-status-critical">
                {issues['yearLevelTo']}
              </p>
            ) : null}
          </div>
        </div>

        <div role="group" aria-label="Lesson formats">
          <Label htmlFor="format-online">Lesson formats</Label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                id="format-online"
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
          {issues['formats'] !== undefined ? (
            <p role="alert" className="mt-1 text-sm text-status-critical">
              {issues['formats']}
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Your teaching</h2>
        <Field
          label="Headline"
          name="headline"
          value={values.headline}
          onChange={(event) => set('headline', event.target.value)}
          error={issues['headline']}
          helper="One line families will see on your profile, for example “Patient maths tutor for years 7 to 10”."
        />
        <TextareaField
          label="How you teach"
          name="teachingApproach"
          rows={5}
          value={values.teachingApproach}
          onChange={(event) => set('teachingApproach', event.target.value)}
          error={issues['teachingApproach']}
          helper="Families see this on your profile."
        />
        <TextareaField
          label="Your experience"
          name="experienceSummary"
          rows={5}
          value={values.experienceSummary}
          onChange={(event) => set('experienceSummary', event.target.value)}
          error={issues['experienceSummary']}
          helper="Teaching, tutoring and anything else relevant. Only Studdy sees this."
        />
        <TextareaField
          label="Qualifications (optional)"
          name="qualificationsSummary"
          rows={3}
          value={values.qualificationsSummary}
          onChange={(event) => set('qualificationsSummary', event.target.value)}
          error={issues['qualificationsSummary']}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Referees</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Two or three people who can speak to your teaching or character. Studdy will contact
            them, so tell them to expect an email.
          </p>
          {issues['references'] !== undefined ? (
            <p role="alert" className="mt-1 text-sm text-status-critical">
              {issues['references']}
            </p>
          ) : null}
        </div>
        {Array.from({ length: REFERENCE_SLOTS }, (_, index) => {
          const reference = values.references[index] ?? {
            fullName: '',
            email: '',
            relationship: '',
          };
          return (
            <div
              key={index}
              className="grid gap-4 rounded-[var(--radius-gentle)] border border-surface-border p-4 sm:grid-cols-3"
            >
              <Field
                label={`Referee ${String(index + 1)}${index === 2 ? ' (optional)' : ''}`}
                name={`references.${String(index)}.fullName`}
                value={reference.fullName}
                onChange={(event) => setReference(index, 'fullName', event.target.value)}
                error={issues[`references.${String(index)}.fullName`]}
              />
              <Field
                label="Their email"
                name={`references.${String(index)}.email`}
                type="email"
                value={reference.email}
                onChange={(event) => setReference(index, 'email', event.target.value)}
                error={issues[`references.${String(index)}.email`]}
              />
              <Field
                label="How they know you"
                name={`references.${String(index)}.relationship`}
                value={reference.relationship}
                onChange={(event) => setReference(index, 'relationship', event.target.value)}
                error={issues[`references.${String(index)}.relationship`]}
              />
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Declarations</h2>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="declarationsAccepted"
            className="mt-1"
            checked={values.declarationsAccepted}
            onChange={(event) => set('declarationsAccepted', event.target.checked)}
          />
          <span>
            I confirm that I am 18 or over, that what I have written is accurate, that I agree to
            Studdy&rsquo;s terms for tutors, and that I accept Studdy&rsquo;s safeguarding
            requirements for working with children, including any checks Studdy asks me to complete.
          </span>
        </label>
        {issues['declarationsAccepted'] !== undefined ? (
          <p role="alert" className="text-sm text-status-critical">
            {issues['declarationsAccepted']}
          </p>
        ) : null}
        <p className="text-sm text-text-secondary">
          Studdy checks who you are, and the safeguarding requirements, in a conversation. You are
          never asked to upload an identity document here.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" formAction={submit} disabled={busy}>
          {submitting
            ? 'Submitting…'
            : resubmitting
              ? 'Resubmit application'
              : 'Submit application'}
        </Button>
        <Button type="submit" variant="secondary" formAction={save} disabled={busy}>
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
      </div>
    </form>
  );
}
