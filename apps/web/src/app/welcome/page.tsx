import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Button, Card, StatusBadge } from '@studdy/design-system';
import { resolveIdentity } from '@/lib/identity/resolve';
import { WelcomeForm } from './welcome-form';

export const metadata = { title: 'Welcome to Studdy' };

/**
 * Post-verification account setup. One shared flow — role-specific behaviour
 * comes from the chosen role assignment, never from a separate auth system.
 */
export default async function WelcomePage() {
  const identity = await resolveIdentity();
  if (identity === null) redirect('/sign-in?next=%2Fwelcome');

  // Already set up with a workspace → nothing to do here.
  if (!identity.needsSetup && identity.workspaces.length > 0) redirect('/workspace');

  const tutorPending = identity.pendingRoleCodes.includes('tutor');
  const noActiveWorkspace =
    !identity.needsSetup && identity.workspaces.length === 0 && !tutorPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-10">
      <div className="w-full max-w-lg">
        {noActiveWorkspace ? (
          <Card>
            <h1 className="text-2xl font-semibold">Your account has no active workspace</h1>
            <div className="mt-4 flex flex-col gap-4">
              <Alert tone="warning" title="Access restricted">
                Your role on Studdy is currently inactive or suspended. If you believe this is a
                mistake, contact the Studdy team through the support details shared with your
                account.
              </Alert>
              <Button variant="secondary" asChild>
                <Link href="/">Back to Studdy home</Link>
              </Button>
            </div>
          </Card>
        ) : tutorPending && !identity.needsSetup ? (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-2xl font-semibold">Thanks, {identity.displayName}</h1>
              <StatusBadge family="pending">Application pending</StatusBadge>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <Alert tone="information" title="Your tutor interest is registered">
                Tutor applications open with the tutor-onboarding release. We&rsquo;ll email you
                when you can complete your application, interview and verification. Until approval,
                tutor tools stay locked.
              </Alert>
              <p className="text-sm text-text-secondary">
                Also here as a parent or student? You can add that later from your account.
              </p>
              <Button variant="secondary" asChild>
                <Link href="/">Back to Studdy home</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <h1 className="text-2xl font-semibold">Welcome to Studdy</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Two quick things and you&rsquo;re in.
            </p>
            <div className="mt-6">
              <WelcomeForm />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
