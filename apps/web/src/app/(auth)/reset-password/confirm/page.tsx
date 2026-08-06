import Link from 'next/link';
import { Alert, Button, Card } from '@studdy/design-system';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NewPasswordForm } from './new-password-form';

export const metadata = { title: 'Choose a new password' };

/**
 * Reset-link landing: exchanges the emailed code for a session, then lets the
 * user set a new password.
 */
export default async function ResetPasswordConfirmPage() {
  // The emailed link is exchanged for a session by /auth/callback before the
  // user arrives here; a valid session is what authorises the reset.
  let ready = false;
  const supabase = await createSupabaseServerClient();
  if (supabase !== null) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    ready = user !== null;
  }

  return (
    <Card>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <div className="mt-4">
        {ready ? (
          <NewPasswordForm />
        ) : (
          <div className="flex flex-col gap-4">
            <Alert tone="critical" title="This reset link is not valid">
              It may have expired or already been used. Request a new one below.
            </Alert>
            <Button variant="secondary" asChild>
              <Link href="/reset-password">Request a new reset link</Link>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
