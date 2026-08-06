import { Card } from '@studdy/design-system';
import { MfaChallenge } from './mfa-challenge';

export const metadata = { title: 'Multi-factor authentication' };

/**
 * TOTP challenge. Required for Platform Manager and Platform Owner
 * workspaces (approved 6 Aug 2026); other roles are not prompted, though the
 * mechanism is role-agnostic for later extension.
 */
export default function MfaPage() {
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Enter your verification code</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Open your authenticator app and enter the 6-digit code for Studdy.
      </p>
      <div className="mt-6">
        <MfaChallenge />
      </div>
    </Card>
  );
}
