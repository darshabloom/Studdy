'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Field } from '@studdy/design-system';
import { completeAccountSetupAction, type AuthFormState } from '@/lib/auth/actions';

const initialState: AuthFormState = { error: null, message: null };

const ROLE_OPTIONS = [
  {
    value: 'parent_guardian',
    title: 'I’m a parent or guardian',
    description: 'Set up tutoring for children in your family.',
  },
  {
    value: 'independent_student',
    title: 'I’m a student booking for myself',
    description: 'You manage and pay for your own lessons (18+).',
  },
  {
    value: 'tutor',
    title: 'I want to tutor on Studdy',
    description: 'Register your interest — applications open soon.',
  },
] as const;

export function WelcomeForm() {
  const [state, formAction, pending] = useActionState(completeAccountSetupAction, initialState);
  const [roleChoice, setRoleChoice] = useState<string>('');
  // Controlled values: React 19 resets uncontrolled form fields after a
  // server action, which would wipe the user's input on a validation error.
  const [preferredName, setPreferredName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [declared, setDeclared] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="roleChoice" value={roleChoice} />
      <input type="hidden" name="declaredEighteenPlus" value={declared ? 'on' : ''} />
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}

      <Field
        label="Preferred name"
        name="preferredName"
        autoComplete="given-name"
        required
        helper="What we call you across Studdy."
        error={state.issues?.['preferredName']}
        value={preferredName}
        onChange={(event) => setPreferredName(event.target.value)}
      />
      <Field
        label="Family name"
        name="familyName"
        autoComplete="family-name"
        required
        error={state.issues?.['familyName']}
        value={familyName}
        onChange={(event) => setFamilyName(event.target.value)}
      />

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-text-primary">
          Who is Studdy for?
        </legend>
        {state.issues?.['roleChoice'] !== undefined ? (
          <p role="alert" className="mb-2 text-sm text-status-critical">
            {state.issues['roleChoice']}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-medium)] border p-4 ${
                roleChoice === option.value
                  ? 'border-brand-purple bg-brand-lavender/50'
                  : 'border-surface-border bg-surface-card hover:border-text-muted'
              }`}
            >
              <input
                type="radio"
                name="roleChoiceDisplay"
                value={option.value}
                checked={roleChoice === option.value}
                onChange={() => setRoleChoice(option.value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-text-primary">{option.title}</span>
                <span className="block text-sm text-text-secondary">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {roleChoice === 'independent_student' ? (
        <div className="rounded-[var(--radius-medium)] border border-surface-border bg-surface-card-secondary p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="declaredEighteenPlusDisplay"
              className="mt-0.5"
              checked={declared}
              onChange={(event) => setDeclared(event.target.checked)}
            />
            <span>
              I confirm I am <strong>18 or older</strong> and financially responsible for my
              lessons.
            </span>
          </label>
          {state.issues?.['declaredEighteenPlus'] !== undefined ? (
            <p role="alert" className="mt-2 text-sm text-status-critical">
              {state.issues['declaredEighteenPlus']}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-text-secondary">
            Under 18? A parent or guardian creates a family account and adds you as a student.
          </p>
        </div>
      ) : null}

      {roleChoice === 'tutor' ? (
        <Alert tone="information" title="About tutor accounts">
          This registers your interest. Tutor applications, interviews and verification open with
          the tutor-onboarding release — tutoring tools unlock after approval.
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Setting up…' : 'Continue'}
      </Button>
    </form>
  );
}
