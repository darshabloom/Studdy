import Stripe from 'stripe';
import {
  asCapabilityStatus,
  type CapabilityStatusDetail,
  type ConnectedAccountState,
} from '@studdy/domain/payments';

/**
 * The Stripe Connect adapter — the ONLY file in Studdy that knows Stripe exists.
 *
 * Stripe SDK types never cross into `@studdy/domain` (brief §9). Everything
 * leaving here is a Studdy-owned shape, so the readiness rule and the database
 * stay provider-neutral and a second provider would be a sibling of this file
 * rather than a rewrite.
 *
 * ACCOUNTS V2, NOT V1. Stripe refuses `POST /v1/accounts` for new Connect
 * platforms — "Stripe no longer recommends Accounts v1 for new Connect
 * integrations" — and Studdy is a new platform with no production accounts and
 * no money moved. The v1 compatibility flag exists but was deliberately not
 * enabled: starting on an API Stripe already discourages, then scheduling a
 * migration into the slice that carries real money, is the more expensive path.
 *
 * WHAT SURVIVED THE MIGRATION, and why the product architecture is unchanged:
 *
 *   - Stripe-hosted onboarding — still an account link, still Stripe's screens.
 *   - The Express DASHBOARD EXPERIENCE — `dashboard: 'express'`. In v2 this is
 *     a property of the account rather than an account "type", which is a
 *     renaming rather than a loss.
 *   - Separate charges and transfers — expressed by the RECIPIENT
 *     configuration. Stripe's own v2 documentation describes recipient as the
 *     configuration to use "if the Account will not be the Merchant of Record,
 *     like with Separate Charges & Transfers", which is exactly Studdy.
 *
 * WHAT CHANGED, and could not be preserved:
 *
 *   - `charges_enabled` / `payouts_enabled` booleans do not exist in v2. They
 *     are capability STATUSES now. Nothing is wrapped to fake the old shape.
 *   - The capability status enum is `active | pending | restricted |
 *     unsupported`. v1's `inactive` is gone.
 *   - Events are THIN: they carry a reference, not the account. See below.
 *
 * NO MERCHANT CONFIGURATION IS REQUESTED. A merchant configuration would make
 * the tutor the merchant of record, which is the opposite of Studdy's approved
 * money flow. Requesting only `recipient` is also what keeps KYC friction on a
 * tutor to the minimum their actual role requires.
 */

/** Studdy's Connect dashboard experience. Express, as approved. */
export const STUDDY_CONNECT_DASHBOARD = 'express' as const;

/** The v2 configuration Studdy puts a tutor under. */
export const STUDDY_CONNECT_CONFIGURATION = 'recipient' as const;

export const STRIPE_PROVIDER = 'stripe' as const;

/** Capability paths Studdy reads. Named once so nothing re-spells them. */
export const TRANSFERS_CAPABILITY = 'stripe_balance.stripe_transfers';
export const PAYOUTS_CAPABILITY = 'stripe_balance.payouts';

/**
 * What Studdy asks Stripe to return. Without `include`, the configuration is
 * absent from the response and every capability would read as unsupported —
 * failing closed, but for the wrong reason.
 */
const ACCOUNT_INCLUDE = ['configuration.recipient', 'identity'] as const;

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
  // wire format in agreement, which is the failure a hand-written version
  // string eventually causes.
  return new Stripe(secretKey);
}

/**
 * The Studdy-shaped view of a Stripe v2 account.
 *
 * `statusDetails` are Stripe's machine-readable REASON CODES, which is a
 * privacy improvement v2 hands Studdy for free: `requirements_past_due` says
 * something is outstanding without naming which identity document it is. v1
 * required storing requirement identifiers to say anything useful at all.
 */
export interface StripeAccountSnapshot extends ConnectedAccountState {
  readonly providerAccountId: string;
  /** ISO 3166-1 alpha-2, as Stripe holds it. Recorded, never decided on. */
  readonly countryCode: string | null;
}

interface CapabilityEntry {
  readonly status?: string;
  readonly status_details?: ReadonlyArray<{ code: string; resolution: string }>;
}

function detailsFor(
  capability: string,
  entry: CapabilityEntry | undefined,
): CapabilityStatusDetail[] {
  if (entry?.status_details === undefined) return [];
  return entry.status_details.map((detail) => ({
    capability,
    code: detail.code,
    resolution: detail.resolution,
  }));
}

/**
 * Project a Stripe v2 Account onto exactly what Studdy stores and decides with.
 *
 * THIS IS THE DATA-MINIMISATION BOUNDARY. Everything Studdy holds about a
 * tutor's Stripe account passes through this function, so the set of fields
 * below is the complete answer to "what did we copy out of Stripe". Identity —
 * names, dates of birth, addresses, documents — is read for nothing but the
 * country code, which is a jurisdiction rather than a personal detail.
 */
export function snapshotFromAccount(account: Stripe.V2.Core.Account): StripeAccountSnapshot {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance as
    { stripe_transfers?: CapabilityEntry; payouts?: CapabilityEntry } | undefined;

  return {
    providerAccountId: account.id,
    transfersCapability: asCapabilityStatus(balance?.stripe_transfers?.status),
    payoutsCapability: asCapabilityStatus(balance?.payouts?.status),
    statusDetails: [
      ...detailsFor(TRANSFERS_CAPABILITY, balance?.stripe_transfers),
      ...detailsFor(PAYOUTS_CAPABILITY, balance?.payouts),
    ],
    countryCode: account.identity?.country ?? null,
  };
}

export interface CreateConnectAccountInput {
  /** Correlates the Stripe account back to Studdy without carrying identity. */
  readonly tutorProfileId: string;
  /**
   * The tutor's sign-in email.
   *
   * REQUIRED, not optional — Stripe refuses a recipient configuration without
   * a contact email ("If configuration.recipient is supplied, the Account must
   * have a contact email"). It was optional in the first draft, which would
   * have turned a tutor with no email into a Stripe validation error nobody
   * could read. Null is now refused here, close to the cause.
   */
  readonly email: string | null;
  /**
   * Stable across retries, so a repeated request cannot create a second Stripe
   * account. The database's one-live-account-per-tutor index is the other half
   * of this guarantee; this half stops a duplicate ever reaching Stripe.
   */
  readonly idempotencyKey: string;
}

/**
 * Create a recipient account for a tutor.
 *
 * NZ is the country because both parties are New Zealand and the same-country
 * requirement for separate charges and transfers depends on it. A tutor
 * elsewhere is a product decision, not a configuration change.
 *
 * ONLY `stripe_transfers` IS REQUESTED. `payouts` becomes available through the
 * recipient configuration as onboarding completes; asking for capabilities
 * Studdy does not use — card payments above all — would put a tutor through
 * verification for a role they do not have.
 */
export async function createConnectAccount(
  stripe: Stripe,
  input: CreateConnectAccountInput,
): Promise<StripeAccountSnapshot> {
  if (input.email === null || input.email.trim() === '') {
    throw new StripeConfigurationError(
      'A tutor needs a contact email before Stripe can create their payout account.',
    );
  }
  const account = await stripe.v2.core.accounts.create(
    {
      dashboard: STUDDY_CONNECT_DASHBOARD,
      contact_email: input.email,
      identity: { country: 'NZ' },
      /*
       * REQUIRED BY STRIPE for a recipient holding `stripe_transfers`, and a
       * LIABILITY POSITION rather than a formality. Stripe refuses account
       * creation without both.
       *
       * BOTH ARE `application`, which is the clean Accounts v2 shape for a
       * marketplace doing separate charges and transfers. `application_express`
       * is also accepted, and was tried first on the assumption that it paired
       * with `dashboard: 'express'` — it does not. It is a legacy Express-era
       * fee-payer value the SDK still takes, and `dashboard` already carries
       * the Express decision. Verified against real Stripe test mode with this
       * exact NZ / express / recipient configuration: both are accepted, so
       * this is the deliberate choice rather than the only one that worked.
       *
       * `fees_collector: 'application'` — Studdy collects Stripe's fees, which
       * is what the approved money model already assumes: Studdy absorbs the
       * processing cost and the parent is charged exactly the tutor's listed
       * price.
       *
       * `losses_collector: 'application'` — Studdy carries a negative balance a
       * tutor cannot pay back. Owner-approved. The platform takes the parent's
       * money, holds it, and keeps disputes and refunds on its own side;
       * handing losses to Stripe would claim a protection Studdy has not
       * negotiated.
       *
       * NEITHER IS A LEGAL OR TAX ASSERTION. Merchant-of-record treatment is
       * still unconfirmed (design §5) and both remain changeable while no
       * production account exists and no money has moved.
       */
      defaults: {
        responsibilities: {
          fees_collector: 'application',
          losses_collector: 'application',
        },
      },
      configuration: {
        recipient: {
          capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
        },
      },
      include: [...ACCOUNT_INCLUDE],
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
  const account = await stripe.v2.core.accounts.retrieve(providerAccountId, {
    include: [...ACCOUNT_INCLUDE],
  });
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
 * shows whatever is still outstanding, which is what makes "start" and
 * "continue" one code path in Studdy.
 *
 * `configurations: ['recipient']` scopes the collected requirements to the only
 * role the tutor has. Collecting merchant requirements would ask a tutor to be
 * verified as something Studdy will never make them.
 *
 * Links are SINGLE-USE and short-lived by Stripe's design, which is why Studdy
 * generates one per click rather than storing it.
 */
export async function createAccountLink(
  stripe: Stripe,
  input: AccountLinkInput,
): Promise<{ readonly url: string; readonly expiresAt: Date }> {
  const link = await stripe.v2.core.accountLinks.create({
    account: input.providerAccountId,
    use_case: {
      type: 'account_onboarding',
      account_onboarding: {
        configurations: [STUDDY_CONNECT_CONFIGURATION],
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        // Collect everything Stripe will eventually want, rather than the
        // minimum for today. A tutor sent back a second time for a threshold
        // they were always going to cross is a worse experience than one
        // longer form.
        collection_options: { fields: 'eventually_due' },
      },
    },
  });
  // v2 timestamps are ISO strings, not the unix integers v1 used.
  return { url: link.url, expiresAt: new Date(link.expires_at) };
}

export class StripeSignatureError extends Error {
  override name = 'StripeSignatureError';
}

/**
 * A verified v2 event notification, reduced to what the webhook route needs.
 *
 * V2 EVENTS ARE THIN. Unlike v1, the payload does NOT contain the account — it
 * carries a `related_object` reference, and the current state is fetched
 * afterwards. That is more work, and it is also strictly better here: the
 * webhook body cannot contain KYC data, because it contains almost nothing.
 */
export interface VerifiedConnectEvent {
  readonly id: string;
  readonly type: string;
  /** Event creation time, for the out-of-order guard. */
  readonly createdAt: Date;
  /** The account the event concerns, when it names one. */
  readonly relatedAccountId: string | null;
}

/**
 * Connect events Studdy acts on.
 *
 * The recipient events are the ones that move payability.
 * `v2.core.account.updated` is included because an account-level change can
 * carry a capability change with it, and re-reading authoritative state is
 * cheap and idempotent.
 */
export const HANDLED_CONNECT_EVENT_TYPES: readonly string[] = [
  'v2.core.account[configuration.recipient].capability_status_updated',
  'v2.core.account[configuration.recipient].updated',
  'v2.core.account.updated',
];

/**
 * Verify a webhook signature and parse the event. NOTHING is written before
 * this succeeds.
 *
 * Takes the RAW body as a string. A parsed-and-restringified body will not
 * verify, because the signature covers the exact bytes Stripe sent.
 *
 * `parseEventNotification` is the v2 equivalent of v1's `constructEvent`, and
 * verifies the same signature scheme over the same header.
 */
export function verifyConnectEvent(
  stripe: Stripe,
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined,
): VerifiedConnectEvent {
  if (webhookSecret === undefined || webhookSecret.trim() === '') {
    throw new StripeConfigurationError(
      'STRIPE_CONNECT_WEBHOOK_SECRET is not set. Refusing to process an unverifiable webhook.',
    );
  }
  if (signatureHeader === null || signatureHeader === '') {
    throw new StripeSignatureError('Missing Stripe-Signature header.');
  }
  let notification;
  try {
    notification = stripe.parseEventNotification(rawBody, signatureHeader, webhookSecret);
  } catch {
    // The provider's message can name the secret's shape; never surface it,
    // and never chain the cause — an error chain is a log line waiting to
    // happen.
    throw new StripeSignatureError('Stripe webhook signature verification failed.');
  }
  const related = (notification as { related_object?: { id?: unknown } }).related_object;
  return {
    id: notification.id,
    type: notification.type,
    createdAt: new Date(notification.created),
    relatedAccountId: typeof related?.id === 'string' ? related.id : null,
  };
}

/**
 * A PaymentIntent on the PLATFORM account.
 *
 * SEPARATE CHARGES AND TRANSFERS, which is a set of deliberate omissions as
 * much as anything present:
 *
 *   - **No `transfer_data.destination`.** A destination charge would land the
 *     tutor's share in their balance at capture — days before the lesson — and
 *     admin-assisted refunds before public launch would then mean clawing money
 *     back out of a connected account rather than never having sent it.
 *   - **No `application_fee_amount`.** Under this pattern Studdy's fee is not an
 *     application fee; it is simply the part of the charge Studdy does not
 *     transfer.
 *   - **No `on_behalf_of`.** Not set in V1, which keeps disputes and refunds on
 *     the platform where the admin tooling will be. An operational choice,
 *     deliberately not a legal assertion about merchant of record.
 *
 * Nothing here moves money to the tutor. Transfers are slice 6 and later.
 */
export interface PaymentIntentInput {
  /** The server-computed total. NEVER a number that came from a browser. */
  readonly amountMinor: bigint;
  readonly currencyCode: string;
  /** Studdy's `PAY-` reference, for correlation in the Stripe dashboard. */
  readonly paymentReference: string;
  /**
   * Deterministic, derived from Studdy's own payment id. A retried request
   * therefore reaches the SAME PaymentIntent rather than creating a second one
   * a parent could also pay.
   */
  readonly idempotencyKey: string;
  /** Correlation only. Ids, never names, emails or amounts a human would read. */
  readonly metadata: Readonly<Record<string, string>>;
}

export interface PaymentIntentResult {
  readonly providerPaymentIntentId: string;
  /** Handed to the Payment Element. Owning family only — never logged. */
  readonly clientSecret: string;
  readonly status: string;
}

export async function createPlatformPaymentIntent(
  stripe: Stripe,
  input: PaymentIntentInput,
): Promise<PaymentIntentResult> {
  const intent = await stripe.paymentIntents.create(
    {
      // Stripe takes a number; the ledger keeps bigint. Converted at this
      // boundary, where the value is known to be within a card-payment range.
      amount: Number(input.amountMinor),
      currency: input.currencyCode.toLowerCase(),
      // Lets Stripe decide which methods to offer rather than Studdy hard-coding
      // a list that would go stale.
      automatic_payment_methods: { enabled: true },
      description: `Studdy lesson ${input.paymentReference}`,
      metadata: { ...input.metadata },
    },
    { idempotencyKey: input.idempotencyKey },
  );
  if (intent.client_secret === null) {
    throw new StripeConfigurationError('Stripe returned a PaymentIntent with no client secret.');
  }
  return {
    providerPaymentIntentId: intent.id,
    clientSecret: intent.client_secret,
    status: intent.status,
  };
}

/** Read a PaymentIntent's current state. Never trusts the browser's word for it. */
export async function retrievePaymentIntent(
  stripe: Stripe,
  providerPaymentIntentId: string,
): Promise<{ readonly status: string; readonly clientSecret: string | null }> {
  const intent = await stripe.paymentIntents.retrieve(providerPaymentIntentId);
  return { status: intent.status, clientSecret: intent.client_secret };
}
