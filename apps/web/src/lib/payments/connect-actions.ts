'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  applyProviderAccountState,
  connectedAccountForTutor,
  recordConnectedAccount,
  tutorProfileForUser,
} from '@studdy/database';
import {
  createAccountLink,
  createConnectAccount,
  retrieveConnectAccount,
  STRIPE_PROVIDER,
  stripeClient,
  STUDDY_CONNECT_ACCOUNT_TYPE,
} from '@studdy/integrations/payments/stripe';
import { createLogger } from '@studdy/observability';
import { resolveIdentity } from '../identity/resolve';

/**
 * Tutor payout setup — Studdy's half of Stripe Connect onboarding.
 *
 * SERVER-AUTHORITATIVE THROUGHOUT. The browser supplies NOTHING: no account id,
 * no capability state, no payout status, no verification claim. Every one of
 * those values arrives from Stripe or is computed from what Stripe said. The
 * only thing a tutor's click contributes is the intent to start, and even that
 * is scoped to the tutor the SESSION resolves to.
 *
 * The tutor id is never a parameter. It comes from `resolveIdentity()` on every
 * call, which is what makes it impossible to act on another tutor's account:
 * there is no argument to tamper with.
 */

const logger = createLogger({ job: 'stripe-connect-onboarding' });

const PAYMENTS_PATH = '/tutor/payments';

async function requireTutorProfileId(): Promise<string> {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    redirect(`/sign-in?next=${encodeURIComponent(PAYMENTS_PATH)}`);
  }
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) redirect('/tutor');
  return profile.id;
}

async function tutorEmail(): Promise<string | null> {
  const identity = await resolveIdentity();
  return identity?.email ?? null;
}

/**
 * Absolute URLs for Stripe to send the tutor back to.
 *
 * THEY CARRY NO IDENTIFIER, and that is the whole defence against an
 * account-link return being used to bind somebody else's Stripe account. There
 * is no account id, tutor id or token in either URL — nothing to swap. On
 * return, Studdy resolves the tutor from the session and reads THAT tutor's own
 * account. A tutor who pastes another tutor's return URL lands on their own
 * payments page and learns nothing.
 */
function onboardingUrls(): { refreshUrl: string; returnUrl: string } {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL === undefined
      ? 'http://localhost:3000'
      : `https://${process.env.VERCEL_URL}`);
  return {
    refreshUrl: `${base}${PAYMENTS_PATH}?stripe=refresh`,
    returnUrl: `${base}${PAYMENTS_PATH}?stripe=return`,
  };
}

/**
 * Start or resume Connect onboarding.
 *
 * IDEMPOTENT IN TWO PLACES, because one is not enough:
 *
 *   - Studdy reads the tutor's existing account first and reuses it, so an
 *     ordinary second click never creates a second Stripe account;
 *   - the create call carries an idempotency key derived from the tutor id, and
 *     the table has a one-live-account-per-tutor unique index, so even two
 *     genuinely concurrent requests cannot produce two accounts.
 *
 * The account link itself is deliberately NOT reused: Stripe's links are
 * single-use and short-lived, so a fresh one is generated per click. That is
 * also what makes "resume" the same code path as "start".
 */
export async function startConnectOnboarding(): Promise<void> {
  const tutorProfileId = await requireTutorProfileId();
  const stripe = stripeClient(process.env.STRIPE_SECRET_KEY);

  let account = await connectedAccountForTutor(tutorProfileId);

  if (account === null) {
    const snapshot = await createConnectAccount(stripe, {
      tutorProfileId,
      email: await tutorEmail(),
      // Stable for this tutor, so a retried request reaches the same account.
      idempotencyKey: `connect-account:${tutorProfileId}`,
    });
    account = await recordConnectedAccount({
      tutorProfileId,
      provider: STRIPE_PROVIDER,
      accountTypeCode: STUDDY_CONNECT_ACCOUNT_TYPE,
      snapshot,
    });
    logger.info('connect account created');
  }

  const link = await createAccountLink(stripe, {
    providerAccountId: account.providerAccountId,
    ...onboardingUrls(),
  });

  // Outside the try/catch semantics of an action: redirect throws by design.
  redirect(link.url);
}

/**
 * Refresh a tutor's account state from Stripe.
 *
 * CALLED ON RETURN FROM ONBOARDING, because arriving at the return URL proves
 * only that the tutor closed the Stripe tab. It is not evidence that Stripe
 * accepted them, and treating it as such is exactly how a platform ends up
 * telling somebody they are ready to be paid when they are not.
 *
 * `account.updated` is the authoritative long-run channel; this read covers the
 * gap between the tutor returning and the webhook arriving, so the page they
 * land on is truthful immediately rather than a few seconds stale.
 */
export async function refreshConnectStatus(): Promise<void> {
  const tutorProfileId = await requireTutorProfileId();
  const account = await connectedAccountForTutor(tutorProfileId);
  if (account === null) return;

  const stripe = stripeClient(process.env.STRIPE_SECRET_KEY);
  const snapshot = await retrieveConnectAccount(stripe, account.providerAccountId);

  await applyProviderAccountState({
    providerAccountId: account.providerAccountId,
    snapshot,
    // A direct read is by definition current, so it does not compete with the
    // webhook ordering guard — it neither advances nor is blocked by it.
    eventCreatedAt: null,
  });
  revalidatePath(PAYMENTS_PATH);
}
