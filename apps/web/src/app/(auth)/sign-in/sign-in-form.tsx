'use client';

import { useActionState } from 'react';
import { Alert, Button, Field } from '@studdy/design-system';
import { resendVerificationAction, signInAction, type AuthFormState } from '@/lib/auth/actions';

const initialState: AuthFormState = { error: null, message: null };

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [resendState, resendAction, resendPending] = useActionState(
    resendVerificationAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-4">
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

      {state.unverifiedEmail !== undefined ? (
        <form action={resendAction} className="flex flex-col gap-2">
          {resendState.message !== null ? (
            <Alert tone="success">{resendState.message}</Alert>
          ) : null}
          {resendState.error !== null ? <Alert tone="critical">{resendState.error}</Alert> : null}
          <input type="hidden" name="email" value={state.unverifiedEmail} />
          <Button type="submit" variant="secondary" disabled={resendPending}>
            {resendPending ? 'Sending…' : 'Resend verification email'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
