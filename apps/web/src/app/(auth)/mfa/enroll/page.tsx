import { Card } from '@studdy/design-system';
import { MfaEnroll } from './mfa-enroll';

export const metadata = { title: 'Set up multi-factor authentication' };

export default function MfaEnrollPage() {
  return (
    <Card>
      <h1 className="text-2xl font-semibold">Set up multi-factor authentication</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Platform Manager and Platform Owner accounts require an authenticator app. Scan the code
        with your authenticator (1Password, Google Authenticator, Authy…), then enter the 6-digit
        code it shows.
      </p>
      <div className="mt-6">
        <MfaEnroll />
      </div>
    </Card>
  );
}
