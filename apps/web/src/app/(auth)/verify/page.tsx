import Link from 'next/link';
import { Alert, Button, Card } from '@studdy/design-system';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata = { title: 'Verify your email' };

/**
 * Email verification landing. Supabase appends `code` (PKCE) or error params
 * to the redirect; exchange happens server-side here.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error_description?: string }>;
}) {
  const { code, error_description: errorDescription } = await searchParams;
  let outcome: 'verified' | 'failed' | 'pending' = 'pending';

  if (code !== undefined) {
    const supabase = await createSupabaseServerClient();
    if (supabase !== null) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      outcome = error === null ? 'verified' : 'failed';
    } else {
      outcome = 'failed';
    }
  } else if (errorDescription !== undefined) {
    outcome = 'failed';
  }

  return (
    <Card>
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <div className="mt-4 flex flex-col gap-4">
        {outcome === 'verified' ? (
          <>
            <Alert tone="success" title="Email verified">
              Your email address is confirmed and you are signed in.
            </Alert>
            <Button asChild>
              <Link href="/workspace">Continue to Studdy</Link>
            </Button>
          </>
        ) : null}
        {outcome === 'failed' ? (
          <>
            <Alert tone="critical" title="We could not verify this link">
              The verification link may have expired or already been used. Sign in to request a new
              one.
            </Alert>
            <Button variant="secondary" asChild>
              <Link href="/sign-in">Go to sign in</Link>
            </Button>
          </>
        ) : null}
        {outcome === 'pending' ? (
          <p className="text-sm text-text-secondary">
            We sent a verification link to your email address. Open it on this device to finish
            creating your account.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
