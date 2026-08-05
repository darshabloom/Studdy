'use client';

import { useActionState } from 'react';
import { Alert, Button, Field } from '@studdy/design-system';
import { signInAction, type AuthFormState } from '@/lib/auth/actions';

const initialState: AuthFormState = { error: null, message: null };

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      <Field label="Email address" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Log in'}
      </Button>
    </form>
  );
}
