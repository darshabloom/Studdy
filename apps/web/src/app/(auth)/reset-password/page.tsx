import Link from 'next/link';
import { Card } from '@studdy/design-system';
import { ResetRequestForm } from './reset-request-form';

export const metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Enter your email address and we&rsquo;ll send you a reset link.
      </p>
      <div className="mt-6">
        <ResetRequestForm />
      </div>
      <p className="mt-6 text-sm text-text-secondary">
        Remembered it?{' '}
        <Link href="/sign-in" className="font-medium text-brand-purple hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
