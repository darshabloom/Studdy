import { Card } from '@studdy/design-system';

export const metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-4 text-sm text-text-secondary">
        Password reset ships with the identity and authentication release. For now, contact the
        Studdy team if you are locked out of a development account.
      </p>
    </Card>
  );
}
