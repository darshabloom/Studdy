import Link from 'next/link';
import { Card } from '@studdy/design-system';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { SignUpForm } from './sign-up-form';

export const metadata = { title: 'Join Studdy' };

export default function SignUpPage() {
  const googleEnabled = process.env.STUDDY_GOOGLE_AUTH_ENABLED === 'true';
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Join Studdy</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Create your account. You will verify your email, then set up who the tutoring is for — as a
        parent or guardian, or as an independent student.
      </p>
      {googleEnabled ? (
        <div className="mt-6">
          <GoogleSignIn next="/welcome" />
        </div>
      ) : null}
      <div className="mt-6">
        <SignUpForm />
      </div>
      <p className="mt-6 text-sm text-text-secondary">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-brand-purple hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
