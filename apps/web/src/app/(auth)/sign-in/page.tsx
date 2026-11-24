import Link from 'next/link';
import { Alert, Card } from '@studdy/design-system';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { SignInForm } from './sign-in-form';

export const metadata = { title: 'Log in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const googleEnabled = process.env.STUDDY_GOOGLE_AUTH_ENABLED === 'true';
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Log in to Studdy</h1>
      {error === 'google_unavailable' ? (
        <div className="mt-4">
          <Alert tone="critical">
            Google sign-in is currently unavailable. Please use email and password.
          </Alert>
        </div>
      ) : null}
      {googleEnabled ? (
        <div className="mt-6">
          <GoogleSignIn next={next ?? '/workspace'} />
        </div>
      ) : null}
      <div className="mt-6">
        <SignInForm next={next ?? ''} />
      </div>
      <div className="mt-6 flex flex-col gap-1 text-sm text-text-secondary">
        <p>
          New to Studdy?{' '}
          <Link href="/sign-up" className="font-medium text-brand-purple hover:underline">
            Create an account
          </Link>
        </p>
        <p>
          <Link href="/reset-password" className="font-medium text-brand-purple hover:underline">
            Forgotten your password?
          </Link>
        </p>
      </div>
    </Card>
  );
}
