'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field } from '@studdy/design-system';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function MfaChallenge() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: factorData, error: listError } = await supabase.auth.mfa.listFactors();
      const factor = factorData?.totp?.[0];
      if (listError !== null || factor === undefined) {
        setError('No authenticator is set up for this account yet.');
        router.push('/mfa/enroll');
        return;
      }
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (challengeError !== null || challenge === null) {
        setError('We could not start the verification. Please try again.');
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError !== null) {
        setError('That code was not accepted. Check your authenticator app and try again.');
        return;
      }
      router.push('/workspace');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void verify();
      }}
    >
      {error !== null ? <Alert tone="critical">{error}</Alert> : null}
      <Field
        label="6-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
      />
      <Button type="submit" disabled={busy || code.trim().length < 6}>
        {busy ? 'Verifying…' : 'Verify'}
      </Button>
    </form>
  );
}
