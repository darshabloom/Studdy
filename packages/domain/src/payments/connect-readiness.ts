/**
 * WHEN IS A TUTOR ACTUALLY PAYABLE?
 *
 * The naive answer is "when they finished the onboarding link". That answer is
 * wrong twice over, and both mistakes are the kind that only surface once real
 * money is moving:
 *
 *   1. Returning to Studdy's return_url proves the tutor closed the Stripe tab.
 *      It proves nothing about whether Stripe accepted them. A tutor can abandon
 *      halfway, hit back, or be put under review minutes later.
 *   2. Stripe can restrict an account long AFTER onboarding completes, when a
 *      verification fails or a deadline passes. Payability is a live fact, not
 *      an event that happened once.
 *
 * So readiness is derived from the provider's own account state, refreshed from
 * provider events, and never from Studdy's own record of "did they click".
 *
 * BUILT ON STRIPE ACCOUNTS V2. Stripe refuses v1 account creation for new
 * Connect platforms, so Studdy models a connected account the way v2 does: not
 * booleans on an account, but CAPABILITY STATUSES on a recipient configuration.
 * The v1 shape is gone rather than wrapped, because a compatibility layer over
 * an API Studdy never successfully called would be fiction.
 *
 * WHICH CAPABILITIES ACTUALLY GATE IT — decided by the charge pattern, and
 * getting it wrong in either direction is expensive.
 *
 * Studdy uses SEPARATE CHARGES AND TRANSFERS (design §5): the parent's payment
 * is created on the PLATFORM account, funds settle in the platform balance, and
 * a transfer moves the tutor's entitlement to their connected account later.
 * Stripe's own v2 documentation names this exact case as the one the RECIPIENT
 * configuration is for — a recipient receives funds and is not the merchant of
 * record. Studdy therefore requests no merchant configuration at all.
 *
 * Consequently there is no `charges_enabled` here. It is not omitted for
 * tidiness: v2 does not expose it, and it would not gate anything if it did,
 * because the connected account never creates the parent's charge.
 *
 * What genuinely gates a transfer landing and the tutor seeing the money:
 *
 *   - `stripe_balance.stripe_transfers` — without it active, a transfer INTO
 *     the account is refused. This is the primary gate.
 *   - `stripe_balance.payouts` — without it, money reaches the tutor's Stripe
 *     balance and stops there. Studdy would have taken a parent's money for a
 *     tutor who cannot be paid, which is worse than refusing the booking.
 *
 * Both verified against the installed SDK's v2 types rather than remembered.
 *
 * Pure: no SDK types, no network, no clock. `@studdy/domain` never imports a
 * provider SDK (brief §9).
 */

/**
 * Stripe Accounts v2 capability status, mirrored as a Studdy-owned union.
 *
 * NOTE THE VALUES. v2 reports `restricted` and `unsupported` where v1 reported
 * a single `inactive`, and the distinction matters to a tutor: `restricted` is
 * usually something they can fix, `unsupported` usually is not.
 */
export type CapabilityStatus = 'active' | 'pending' | 'restricted' | 'unsupported';

export const CAPABILITY_STATUSES: readonly CapabilityStatus[] = [
  'active',
  'pending',
  'restricted',
  'unsupported',
];

/**
 * Coerce a provider-reported status, failing CLOSED.
 *
 * Stripe types these as open enums for forward compatibility, so a value
 * Studdy has never seen is possible. Anything unrecognised becomes
 * `unsupported` — never `active`. A tutor must never be marked payable because
 * a status string was new.
 */
export function asCapabilityStatus(value: string | null | undefined): CapabilityStatus {
  return CAPABILITY_STATUSES.includes(value as CapabilityStatus)
    ? (value as CapabilityStatus)
    : 'unsupported';
}

/** What Studdy shows a tutor, and what it stores. */
export type ConnectedAccountStatus =
  /** No Stripe account exists yet. Nothing has been created on their behalf. */
  | 'not_onboarded'
  /** An account exists; Stripe still wants something. Resume the link. */
  | 'pending'
  /** Payable: transfers and payouts both active. */
  | 'complete'
  /** Stripe has restricted or cannot support something. Action required. */
  | 'restricted';

export const CONNECTED_ACCOUNT_STATUSES: readonly ConnectedAccountStatus[] = [
  'not_onboarded',
  'pending',
  'complete',
  'restricted',
];

/**
 * Why a capability is not active, as Stripe's machine-readable codes.
 *
 * These are REASON CODES, not requirement identifiers, and that difference is
 * a privacy improvement v2 hands Studdy for free: `requirements_past_due` says
 * something is outstanding without naming which identity document it is.
 */
export interface CapabilityStatusDetail {
  /** Which capability: `stripe_balance.stripe_transfers` | `…payouts`. */
  readonly capability: string;
  /** e.g. `requirements_past_due`, `unsupported_country`. */
  readonly code: string;
  /** e.g. `provide_info`, `contact_stripe`, `no_resolution`. */
  readonly resolution: string;
}

/**
 * The provider-authoritative slice of a connected account Studdy actually uses.
 *
 * Deliberately NOT the whole Stripe Account. Identity and KYC data are Stripe's
 * to hold and Studdy's to never receive.
 */
export interface ConnectedAccountState {
  /** Can a Studdy transfer land in this account? The primary gate. */
  readonly transfersCapability: CapabilityStatus;
  /** Can Stripe pay the balance out to the tutor's bank? Also a gate. */
  readonly payoutsCapability: CapabilityStatus;
  /** Machine-readable reasons, when a capability is not active. */
  readonly statusDetails: readonly CapabilityStatusDetail[];
}

/**
 * THE ONE READINESS RULE. Every payability question in Studdy resolves here.
 *
 * Both conditions are necessary and neither is sufficient: transfers active
 * means the money can land; payouts active means the tutor can actually get it.
 * A tutor with one and not the other is not payable, and telling them otherwise
 * would be a promise Studdy cannot keep.
 */
export function canTutorReceivePayments(state: ConnectedAccountState): boolean {
  return state.transfersCapability === 'active' && state.payoutsCapability === 'active';
}

/** Codes that mean Stripe has stopped waiting and started blocking. */
const BLOCKING_CODES = new Set([
  'requirements_past_due',
  'unsupported_business',
  'unsupported_country',
  'unsupported_entity_type',
  'restricted_other',
]);

/**
 * Collapse the provider state into the status a tutor is shown.
 *
 * ORDER MATTERS. `restricted` is checked before `complete` deliberately: an
 * account can be payable right now and still carry a blocking reason that will
 * disable it. Saying "you're all set" while Stripe is days from switching them
 * off is the failure this ordering prevents — the tutor gets told to act while
 * acting is still cheap.
 */
export function connectedAccountStatusFor(state: ConnectedAccountState): ConnectedAccountStatus {
  const blocked =
    state.transfersCapability === 'restricted' ||
    state.transfersCapability === 'unsupported' ||
    state.payoutsCapability === 'restricted' ||
    state.payoutsCapability === 'unsupported' ||
    state.statusDetails.some((detail) => BLOCKING_CODES.has(detail.code));
  if (blocked) return 'restricted';
  if (canTutorReceivePayments(state)) return 'complete';
  return 'pending';
}

/**
 * Whether Stripe still wants something from the tutor.
 *
 * Drives whether Studdy offers "resume setup". True whenever they are not
 * payable, and also when a resolvable reason is attached to an account that
 * happens to be payable today.
 */
export function onboardingIsIncomplete(state: ConnectedAccountState): boolean {
  return (
    !canTutorReceivePayments(state) ||
    state.statusDetails.some((detail) => detail.resolution === 'provide_info')
  );
}

/**
 * Whether the tutor can fix this themselves by going back through onboarding.
 *
 * `contact_stripe` and `no_resolution` are not things another trip through the
 * hosted flow will solve, and sending someone round a loop that cannot help
 * them is worse than telling them the truth.
 */
export function tutorCanResolveByOnboarding(state: ConnectedAccountState): boolean {
  return state.statusDetails.some((detail) => detail.resolution === 'provide_info');
}

/**
 * A NOT-YET-CREATED account, so callers have one shape to reason about.
 *
 * `unsupported` rather than `pending`, because nothing has been requested yet
 * and the failing-closed default should be the least optimistic one.
 */
export const NO_CONNECTED_ACCOUNT: ConnectedAccountState = {
  transfersCapability: 'unsupported',
  payoutsCapability: 'unsupported',
  statusDetails: [],
};
