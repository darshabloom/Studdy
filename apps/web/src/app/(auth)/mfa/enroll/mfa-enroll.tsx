'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, LoadingState } from '@studdy/design-system';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

interface EnrollmentState {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
}

export function MfaEnroll() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function enroll(): Promise<void> {
      const supabase = createSupabaseBrowserClient();
      // Reuse an unverified factor if one exists, otherwise enrol a new one.
      const { data } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Studdy authenticator',
      });
      if (cancelled) return;
      if (data === null) {
        setError('We could not start MFA setup. Refresh the page to try again.');
        return;
      }
      setEnrollment({
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
      });
    }
    void enroll();
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify(): Promise<void> {
    if (enrollment === null) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId,
      });
      if (challengeError !== null || challenge === null) {
        setError('We could not verify the authenticator yet. Try again.');
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError !== null) {
        setError('That code was not accepted. Check the app and try again.');
        return;
      }
      router.push('/workspace');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && enrollment === null) {
    return <Alert tone="critical">{error}</Alert>;
  }
  if (enrollment === null) {
    return <LoadingState label="Preparing your authenticator setup" />;
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
      <div
        className="mx-auto rounded-[var(--radius-medium)] border border-surface-border bg-white p-3"
        // Supabase returns the QR as an SVG string for exactly this purpose.
        dangerouslySetInnerHTML={{ __html: enrollment.qrCodeSvg }}
      />
      <details className="text-sm text-text-secondary">
        <summary className="cursor-pointer font-medium text-text-primary">
          Can&rsquo;t scan? Enter the code manually
        </summary>
        <code className="mt-2 block rounded bg-surface-card-secondary p-2 text-xs break-all">
          {enrollment.secret}
        </code>
      </details>
      <Field
        label="6-digit code from your app"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
      />
      <Button type="submit" disabled={busy || code.trim().length < 6}>
        {busy ? 'Verifying…' : 'Confirm and finish setup'}
      </Button>
    </form>
  );
}
