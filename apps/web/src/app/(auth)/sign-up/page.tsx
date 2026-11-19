import Link from 'next/link';
import { Card } from '@studdy/design-system';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { SignUpForm } from './sign-up-form';

export const metadata = { title: 'Join Studdy' };

export default function SignUpPage() {
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Join Studdy</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Join with Google or email and password. Then choose your account type.
      </p>
      <div className="mt-6">
        <GoogleSignIn />
      </div>
      <div className="mt-4">
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
