'use client';

import { useActionState } from 'react';
import { Alert, Button, Field } from '@studdy/design-system';
import { completePasswordResetAction, type AuthFormState } from '@/lib/auth/actions';

const initialState: AuthFormState = { error: null, message: null };

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(completePasswordResetAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error !== null ? <Alert tone="critical">{state.error}</Alert> : null}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        helper="At least 10 characters. Long passphrases are welcome."
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Updating…' : 'Update password and continue'}
      </Button>
    </form>
  );
}
