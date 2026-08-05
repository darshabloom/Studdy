import Link from 'next/link';
import { Card } from '@studdy/design-system';
import { SignInForm } from './sign-in-form';

export const metadata = { title: 'Log in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Log in to Studdy</h1>
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
