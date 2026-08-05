import { Card } from '@studdy/design-system';

export const metadata = { title: 'Multi-factor authentication' };

export default function MfaPage() {
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Multi-factor authentication</h1>
      <p className="mt-4 text-sm text-text-secondary">
        Multi-factor authentication ships with the identity and authentication release. It is
        mandatory for Platform Owner and privileged manager accounts from launch.
      </p>
    </Card>
  );
}
