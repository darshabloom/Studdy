import Stripe from 'stripe';
import type { CapabilityStatus, ConnectedAccountState } from '@studdy/domain/payments';

/**
 * The Stripe Connect adapter — the ONLY file in Studdy that knows Stripe exists.
 *
 * Stripe SDK types never cross into `@studdy/domain` (brief §9). Everything
 * leaving here is a Studdy-owned shape, so the readiness rule and the database
 * stay provider-neutral and a second provider would be a sibling of this file
 * rather than a rewrite.
 *
 * ACCOUNT TYPE: EXPRESS, as approved in design §5 and re-checked against the
 * installed SDK rather than assumed — `'express'` is still a valid
 * `AccountCreateParams.Type` in v22, so nothing in current Stripe contradicts
 * the decision. Express keeps KYC and its screens on Stripe (Custom would put
 * compliance on Studdy) while leaving Studdy in control of the charge and the
 * customer relationship (Standard hands the tutor a full dashboard and takes
 * that away).
 *
 * CAPABILITIES REQUESTED: `transfers` only. Under separate charges and
 * transfers the parent's PaymentIntent is created on the PLATFORM account, so
 * the connected account never creates a charge and `card_payments` would be a
 * capability Studdy asks a tutor to be verified for and then never uses. Asking
 * for less means less KYC friction for the tutor, for no lost function.
 */

/** Studdy's Connect account type. One value, stored rather than assumed. */
export const STUDDY_CONNECT_ACCOUNT_TYPE = 'express' as const;

export const STRIPE_PROVIDER = 'stripe' as const;

export class StripeConfigurationError extends Error {
  override name = 'StripeConfigurationError';
}

/**
 * Build a client from the server-only secret key.
 *
 * Fails loudly rather than defaulting: a Stripe client with no key produces
 * authentication errors at the first call, far from the missing configuration
 * that caused them.
 */
export function stripeClient(secretKey: string | undefined): Stripe {
  if (secretKey === undefined || secretKey.trim() === '') {
    throw new StripeConfigurationError(
      'STRIPE_SECRET_KEY is not set. Connect onboarding cannot run without it.',
    );
  }
  // The SDK pins its own API version; not overriding it keeps the types and the
  // wire format in agreement, which is the failure a hand-written version string
  // eventually causes.
  return new Stripe(secretKey);
}

/**
 * The Studdy-shaped view of a Stripe account.
 *
 * `requirements` arrays are IDENTIFIERS ONLY — `individual.id_number` and the
 * like. Stripe's Account object also carries the tutor's name, date of birth
 * and address; none of that is read here, so it cannot be stored or logged by
 * accident later.
 */
export interface StripeAccountSnapshot extends ConnectedAccountState {
  readonly providerAccountId: string;
  /** Stripe's `created`-equivalent for ordering; null when not from an event. */
  readonly currentDeadline: Date | null;
}

function capabilityStatus(value: string | undefined): CapabilityStatus {
  // Stripe's types allow an open string for forward compatibility. Anything
  // unrecognised is treated as NOT active, which fails closed: an unknown
  // capability state must never be read as "this tutor can be paid".
  return value === 'active' || value === 'pending' ? value : 'inactive';
}

function requirementIdentifiers(value: readonly string[] | null | undefined): readonly string[] {
  return value === null || value === undefined ? [] : [...value];
}

/**
 * Project a Stripe Account onto exactly what Studdy stores and decides with.
 *
 * This is the data-minimisation boundary. Everything Studdy holds about a
 * tutor's Stripe account passes through this function, so the set of fields
 * below is the complete answer to "what did we copy out of Stripe".
 */
export function snapshotFromAccount(account: Stripe.Account): StripeAccountSnapshot {
  const requirements = account.requirements ?? null;
  const deadline = requirements?.current_deadline ?? null;
  return {
    providerAccountId: account.id,
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    transfersCapability: capabilityStatus(account.capabilities?.transfers),
    detailsSubmitted: account.details_submitted === true,
    currentlyDue: requirementIdentifiers(requirements?.currently_due),
    pastDue: requirementIdentifiers(requirements?.past_due),
    disabledReason: requirements?.disabled_reason ?? null,
    currentDeadline: deadline === null ? null : new Date(deadline * 1000),
  };
}

export interface CreateConnectAccountInput {
  /** Correlates the Stripe account back to Studdy without carrying identity. */
  readonly tutorProfileId: string;
  /** The tutor's sign-in email, so Stripe can reach them about verification. */
  readonly email: string | null;
  /**
   * Stable across retries, so a repeated request cannot create a second Stripe
   * account. The database's one-live-account-per-tutor index is the other half
   * of this guarantee; this half stops a duplicate ever reaching Stripe.
   */
  readonly idempotencyKey: string;
}

/**
 * Create an Express account for a tutor.
 *
 * NZ is hard-coded as the country because both parties are New Zealand and the
 * same-country requirement for separate charges and transfers depends on it.
 * A tutor elsewhere is a product decision, not a configuration change.
 */
export async function createConnectAccount(
  stripe: Stripe,
  input: CreateConnectAccountInput,
): Promise<StripeAccountSnapshot> {
  const account = await stripe.accounts.create(
    {
      type: STUDDY_CONNECT_ACCOUNT_TYPE,
      country: 'NZ',
      // Spread rather than `email: undefined`: the repo runs
      // `exactOptionalPropertyTypes`, so an explicitly-undefined optional is a
      // type error rather than an omitted field.
      ...(input.email === null ? {} : { email: input.email }),
      capabilities: {
        // Only what the charge pattern actually needs. See the header.
        transfers: { requested: true },
      },
      // Studdy's own id, so an account found in the Stripe dashboard can be
      // traced back. A profile id, never a name or an email in metadata.
      metadata: { studdy_tutor_profile_id: input.tutorProfileId },
    },
    { idempotencyKey: input.idempotencyKey },
  );
  return snapshotFromAccount(account);
}

/** Read authoritative state. Used after onboarding return, never trusting the URL. */
export async function retrieveConnectAccount(
  stripe: Stripe,
  providerAccountId: string,
): Promise<StripeAccountSnapshot> {
  const account = await stripe.accounts.retrieve(providerAccountId);
  return snapshotFromAccount(account);
}

export interface AccountLinkInput {
  readonly providerAccountId: string;
  /** Where Stripe sends a tutor whose link expired. Must restart the flow. */
  readonly refreshUrl: string;
  /** Where Stripe sends a tutor who finished — or merely stopped. */
  readonly returnUrl: string;
}

/**
 * A Stripe-hosted onboarding link.
 *
 * `account_onboarding` is correct for both the first run and a resume: Stripe
 * shows whatever is still outstanding. `account_update` is not usable here —
 * the SDK's own documentation restricts it to accounts where the platform
 * collects requirements, which excludes Express accounts with dashboard access.
 *
 * Links are SINGLE-USE and short-lived by Stripe's design, which is why Studdy
 * generates one per click rather than storing it.
 */
export async function createAccountLink(
  stripe: Stripe,
  input: AccountLinkInput,
): Promise<{ readonly url: string; readonly expiresAt: Date }> {
  const link = await stripe.accountLinks.create({
    account: input.providerAccountId,
    type: 'account_onboarding',
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    // Collect everything Stripe will eventually want, rather than the minimum
    // for today. A tutor sent back a second time for a threshold they were
    // always going to cross is a worse experience than one longer form.
    collection_options: { fields: 'eventually_due' },
  });
  return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
}

export class StripeSignatureError extends Error {
  override name = 'StripeSignatureError';
}

/**
 * Verify a webhook signature and parse the event. NOTHING is written before
 * this succeeds.
 *
 * Takes the RAW body as a string or Buffer. A parsed-and-restringified body
 * will not verify, because the signature covers the exact bytes Stripe sent.
 *
 * `constructEventAsync` rather than the sync form: the async variant uses the
 * SubtleCrypto provider where one exists, which is what keeps this route usable
 * outside a Node runtime later.
 */
export async function verifyWebhookEvent(
  stripe: Stripe,
  rawBody: string | Buffer,
  signatureHeader: string | null,
  webhookSecret: string | undefined,
): Promise<Stripe.Event> {
  if (webhookSecret === undefined || webhookSecret.trim() === '') {
    throw new StripeConfigurationError(
      'STRIPE_CONNECT_WEBHOOK_SECRET is not set. Refusing to process an unverifiable webhook.',
    );
  }
  if (signatureHeader === null || signatureHeader === '') {
    throw new StripeSignatureError('Missing Stripe-Signature header.');
  }
  try {
    return await stripe.webhooks.constructEventAsync(rawBody, signatureHeader, webhookSecret);
  } catch {
    // The provider's message can name the secret's shape; never surface it,
    // and never chain the cause — an error chain is a log line waiting to
    // happen.
    throw new StripeSignatureError('Stripe webhook signature verification failed.');
  }
}
