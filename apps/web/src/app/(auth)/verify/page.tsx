import Link from 'next/link';
import { Alert, Button, Card } from '@studdy/design-system';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata = { title: 'Verify your email' };

/**
 * Email-verification status page. The actual code exchange happens in
 * /auth/callback (a route handler — Server Components cannot persist session
 * cookies); this page communicates state.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  const { error, error_description: errorDescription } = await searchParams;
  const failed = error !== undefined || errorDescription !== undefined;

  let signedIn = false;
  const supabase = await createSupabaseServerClient();
  if (supabase !== null) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = user !== null;
  }

  return (
    <Card>
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <div className="mt-4 flex flex-col gap-4">
        {failed ? (
          <>
            <Alert tone="critical" title="We could not verify this link">
              The verification link may have expired or already been used. Sign in to request a new
              one.
            </Alert>
            <Button variant="secondary" asChild>
              <Link href="/sign-in">Go to sign in</Link>
            </Button>
          </>
        ) : signedIn ? (
          <>
            <Alert tone="success" title="Email verified">
              Your email address is confirmed and you are signed in.
            </Alert>
            <Button asChild>
              <Link href="/workspace">Continue to Studdy</Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-text-secondary">
            We sent a verification link to your email address. Open it on this device to finish
            creating your account.
          </p>
        )}
      </div>
    </Card>
  );
}
