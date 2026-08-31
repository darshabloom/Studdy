import { tutorPayoutStatus, tutorProfileForUser } from '@studdy/database';
import type { TutorPayoutStatusView } from '@studdy/database';
import type { ConnectedAccountStatus } from '@studdy/domain/payments';
import { Alert, Button, Card, RestrictedState } from '@studdy/design-system';
import {
  refreshConnectStatus,
  startConnectOnboarding,
  syncConnectStatusFromProvider,
} from '@/lib/payments/connect-actions';
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
 * `tutorPayoutStatus`, which recomputes readiness from the stored Accounts v2
 * capability statuses rather than reading a status somebody set. The tutor's
 * Stripe account id is not in the projection at all, so it cannot reach this
 * markup even by mistake.
 */

const HEADLINES: Record<ConnectedAccountStatus, string> = {
  not_onboarded: 'Set up payouts to start getting paid',
  pending: 'Stripe is still setting up your account',
  complete: "You're set up to be paid",
  restricted: 'Stripe needs something before you can be paid',
};

const EXPLANATIONS: Record<ConnectedAccountStatus, string> = {
  not_onboarded:
    'Studdy uses Stripe to pay tutors. Stripe verifies who you are and holds your bank details, so Studdy never sees them. Setting this up takes a few minutes.',
  pending:
    'Your Stripe account exists but is not finished. You cannot be paid until Stripe can both send money to your account and pay it out to your bank.',
  complete:
    'Stripe can send your earnings to your account and pay them out to your bank. Nothing else is needed from you.',
  restricted:
    'Stripe has paused something on your account. Until it is resolved you cannot be paid, so it is worth doing now.',
};

/**
 * Stripe's reason codes, in words a tutor can act on.
 *
 * Deliberately explicit rather than a prettified version of the code: these
 * strings are the only explanation a tutor gets, and "unsupported entity type"
 * tells them nothing about what to do next.
 */
const REASONS: Record<string, string> = {
  requirements_past_due: 'Stripe needs information from you, and the deadline has passed.',
  requirements_pending_verification: 'Stripe is checking the details you provided.',
  determining_status: 'Stripe is still working out what it needs.',
  restricted_other: 'Stripe has restricted this account.',
  unsupported_business: 'Stripe cannot support this kind of business.',
  unsupported_country: 'Stripe cannot pay out to this country.',
  unsupported_entity_type: 'Stripe cannot support this kind of account holder.',
};

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
        {status.canResolveByOnboarding
          ? 'Stripe needs more information from you before you can be paid.'
          : 'This needs Stripe to resolve it — continuing setup here will not change it.'}
      </Alert>
    );
  }
  if (status.status === 'pending' && !status.canResolveByOnboarding) {
    return (
      <Alert tone="information" title="Stripe is reviewing your details">
        You have given Stripe what it asked for. Verification can take a little while, and this page
        updates itself when Stripe confirms.
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
    // The render-time variant: it reads and stores, but must not revalidate the
    // route it is currently rendering.
    await syncConnectStatusFromProvider();
  }

  const status = await tutorPayoutStatus(profile.id);
  /* One line per distinct reason: two capabilities often report the same one. */
  const reasons = [...new Set(status.statusDetails.map((detail) => detail.code))];
  /*
   * Sending a tutor round the hosted flow again cannot fix an unsupported
   * country, so a button that will not help is worse than none.
   */
  const onboardingWouldHelp = !status.canReceivePayments && status.canResolveByOnboarding;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{HEADLINES[status.status]}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{EXPLANATIONS[status.status]}</p>
      </header>

      <StatusNotice status={status} />

      {reasons.length > 0 ? (
        <Card>
          <h2 className="text-base font-semibold">What Stripe says</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {reasons.map((code) => (
              <li key={code}>{REASONS[code] ?? 'Stripe is still working on this account.'}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/*
        ONE ACTION, whatever the state. "Start" and "resume" are the same thing
        to Stripe — a fresh account link shows whatever is still outstanding —
        so offering two buttons would imply a distinction that does not exist.
      */}
      {status.status === 'not_onboarded' || onboardingWouldHelp ? (
        <form action={startConnectOnboarding}>
          <Button type="submit">
            {status.status === 'not_onboarded'
              ? 'Set up payouts with Stripe'
              : 'Continue Stripe setup'}
          </Button>
        </form>
      ) : (
        <form action={refreshConnectStatus}>
          <Button type="submit" variant="secondary">
            Check my Stripe status again
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
