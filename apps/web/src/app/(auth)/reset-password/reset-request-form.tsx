'use client';

import { useActionState } from 'react';
import { Alert, Button, Field } from '@studdy/design-system';
import { requestPasswordResetAction, type AuthFormState } from '@/lib/auth/actions';

const initialState: AuthFormState = { error: null, message: null };

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}
      {state.message !== null ? <Alert tone="success">{state.message}</Alert> : null}
      <Field label="Email address" name="email" type="email" autoComplete="email" required />
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
