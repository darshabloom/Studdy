import { tutorPayoutStatus, tutorProfileForUser } from '@studdy/database';
import type { TutorPayoutStatusView } from '@studdy/database';
import type { ConnectedAccountStatus } from '@studdy/domain/payments';
import { Alert, Button, Card, RestrictedState } from '@studdy/design-system';
import { refreshConnectStatus, startConnectOnboarding } from '@/lib/payments/connect-actions';
import { resolveIdentity } from '@/lib/identity/resolve';

export const metadata = { title: 'Getting paid' };

/**
 * TUTOR PAYOUT SETUP.
 *
 * Small and functional on purpose — the cohesive visual pass is deferred, and
 * this screen exists to be truthful rather than handsome.
 *
 * WHAT IT MUST NEVER DO is tell a tutor they are ready when Stripe has not said
 * so. Every word on this page derives from provider-authoritative state through
 * `tutorPayoutStatus`, which recomputes readiness from the stored Stripe fields
 * rather than reading a status somebody set. The tutor's Stripe account id is
 * not in the projection at all, so it cannot reach this markup even by mistake.
 */

const HEADLINES: Record<ConnectedAccountStatus, string> = {
  not_onboarded: 'Set up payouts to start getting paid',
  pending: 'Stripe still needs a few things',
  complete: "You're set up to be paid",
  restricted: 'Stripe needs you to act',
};

const EXPLANATIONS: Record<ConnectedAccountStatus, string> = {
  not_onboarded:
    'Studdy uses Stripe to pay tutors. Stripe verifies who you are and holds your bank details, so Studdy never sees them. Setting this up takes a few minutes.',
  pending:
    'Your Stripe account exists but is not finished. You cannot be paid until Stripe has everything it asks for.',
  complete:
    'Stripe has verified your account and can pay out to your bank. Nothing else is needed from you.',
  restricted:
    'Stripe has paused something on your account. Until it is resolved you cannot be paid, so it is worth doing now.',
};

/** Requirement identifiers are Stripe's field names; make them readable. */
function humanRequirement(identifier: string): string {
  return identifier
    .split('.')
    .join(' — ')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function StatusNotice({ status }: { status: TutorPayoutStatusView }): React.JSX.Element {
  if (status.canReceivePayments && status.status === 'complete') {
    return (
      <Alert tone="success" title="Ready for payments and payouts">
        Stripe can accept transfers to your account and pay them out to your bank.
      </Alert>
    );
  }
  if (status.status === 'restricted') {
    return (
      <Alert tone="warning" title="Action required">
        {status.disabledReason === null
          ? 'Stripe is waiting on something before your account can be used.'
          : `Stripe reports: ${status.disabledReason.replace(/[._]/g, ' ')}.`}
      </Alert>
    );
  }
  if (status.status === 'pending' && status.detailsSubmitted) {
    return (
      <Alert tone="information" title="Stripe is reviewing your details">
        You have submitted everything Stripe asked for. Verification can take a little while, and
        this page updates itself when Stripe confirms.
      </Alert>
    );
  }
  return (
    <Alert tone="information" title="Setup is not finished">
      Start the Stripe setup below. You can stop and come back — Stripe keeps what you have already
      entered.
    </Alert>
  );
}

export default async function TutorPaymentsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    return <RestrictedState title="Sign in to set up payouts" />;
  }
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) {
    return (
      <RestrictedState
        title="Your tutor profile is not active yet"
        description="Payout setup opens once your tutor application is approved."
      />
    );
  }

  const searchParams = await props.searchParams;
  /*
   * RETURNING FROM STRIPE IS NOT PROOF OF ANYTHING. The `stripe=return` marker
   * says only that the tutor came back — they may have abandoned the form. It
   * triggers a READ of authoritative state, and the page then renders whatever
   * Stripe actually says, which may still be "not finished".
   */
  if (searchParams['stripe'] === 'return') {
    await refreshConnectStatus();
  }

  const status = await tutorPayoutStatus(profile.id);
  const outstanding = [...status.pastDue, ...status.currentlyDue];

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{HEADLINES[status.status]}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{EXPLANATIONS[status.status]}</p>
      </header>

      <StatusNotice status={status} />

      {outstanding.length > 0 ? (
        <Card>
          <h2 className="text-base font-semibold">What Stripe still needs</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {outstanding.map((identifier) => (
              <li key={identifier}>{humanRequirement(identifier)}</li>
            ))}
          </ul>
          {status.currentDeadline === null ? null : (
            <p className="mt-3 text-sm text-muted-foreground">
              Due by {status.currentDeadline.toLocaleDateString('en-NZ')}.
            </p>
          )}
        </Card>
      ) : null}

      {/*
        ONE ACTION, whatever the state. "Start" and "resume" are the same thing
        to Stripe — a fresh account link shows whatever is still outstanding —
        so offering two buttons would imply a distinction that does not exist.
      */}
      {status.canReceivePayments && status.status === 'complete' ? (
        <form action={refreshConnectStatus}>
          <Button type="submit" variant="secondary">
            Check my Stripe status again
          </Button>
        </form>
      ) : (
        <form action={startConnectOnboarding}>
          <Button type="submit">
            {status.status === 'not_onboarded'
              ? 'Set up payouts with Stripe'
              : 'Continue Stripe setup'}
          </Button>
        </form>
      )}

      {searchParams['stripe'] === 'refresh' ? (
        <Alert tone="information" title="That setup link expired">
          Stripe links are single use and short lived. Start again above — nothing you already
          entered is lost.
        </Alert>
      ) : null}
    </section>
  );
}
