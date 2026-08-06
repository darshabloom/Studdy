'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Field, Label } from '@studdy/design-system';
import { SCHOOL_YEAR_CODES, schoolYearLabel } from '@studdy/domain/students';
import type { FormState } from '@/lib/discovery/actions';

const initialState: FormState = { error: null, message: null };

export interface StudentFormProps {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Copy differs between "add my child" and "set up my own profile". */
  variant: 'dependent' | 'self';
  submitLabel: string;
}

/** Shared by the guardian's add-student flow and the independent student's setup. */
export function StudentForm({ action, variant, submitLabel }: StudentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [preferredName, setPreferredName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [schoolYearCode, setSchoolYearCode] = useState('');
  const [school, setSchool] = useState('');

  const isSelf = variant === 'self';

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="schoolYearCode" value={schoolYearCode} />
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}

      <Field
        label={isSelf ? 'Your first name' : "Student's first name"}
        name="preferredName"
        autoComplete={isSelf ? 'given-name' : 'off'}
        required
        value={preferredName}
        onChange={(event) => setPreferredName(event.target.value)}
        error={state.issues?.['preferredName']}
        helper={isSelf ? undefined : 'What this student is usually called.'}
      />
      <Field
        label="Family name"
        name="familyName"
        autoComplete={isSelf ? 'family-name' : 'off'}
        value={familyName}
        onChange={(event) => setFamilyName(event.target.value)}
        error={state.issues?.['familyName']}
      />

      <div>
        <Label htmlFor="school-year">School year</Label>
        <select
          id="school-year"
          value={schoolYearCode}
          onChange={(event) => setSchoolYearCode(event.target.value)}
          className="h-10 w-full rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-3 text-base text-text-primary hover:border-text-muted"
        >
          <option value="">Choose a year level</option>
          {SCHOOL_YEAR_CODES.map((code) => (
            <option key={code} value={code}>
              {schoolYearLabel(code)}
            </option>
          ))}
        </select>
        {state.issues?.['schoolYearCode'] !== undefined ? (
          <p role="alert" className="mt-1 text-sm text-status-critical">
            {state.issues['schoolYearCode']}
          </p>
        ) : null}
      </div>

      <Field
        label="School (optional)"
        name="schoolOrProviderName"
        value={school}
        onChange={(event) => setSchool(event.target.value)}
      />

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
