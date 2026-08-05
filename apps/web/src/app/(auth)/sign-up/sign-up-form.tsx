'use client';

import { useActionState } from 'react';
import { Alert, Button, Field } from '@studdy/design-system';
import { signUpAction, type AuthFormState } from '@/lib/auth/actions';

const initialState: AuthFormState = { error: null, message: null };

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}
      {state.message !== null ? <Alert tone="success">{state.message}</Alert> : null}
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        helper="We will send a verification email to this address."
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        helper="At least 10 characters."
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
