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
 * `account.updated`, and never from Studdy's own record of "did they click".
 *
 * WHICH FIELDS ACTUALLY GATE IT — this is decided by the charge pattern, and
 * getting it wrong in either direction is expensive.
 *
 * Studdy uses SEPARATE CHARGES AND TRANSFERS (design §5): the parent's
 * PaymentIntent is created on the PLATFORM account, funds settle in the platform
 * balance, and a Transfer moves the tutor's entitlement to their connected
 * account later.
 *
 * Consequently `charges_enabled` on the CONNECTED account is **not** the gate.
 * That flag says whether the connected account may create its own charges, which
 * under this pattern it never does — the platform takes the money. Gating on it
 * would refuse perfectly payable tutors for a capability Studdy does not use.
 * It is recorded anyway, because it is free to store and tells support what
 * Stripe thinks, but it does not decide anything here.
 *
 * What genuinely gates a transfer landing and the tutor seeing the money:
 *
 *   - `capabilities.transfers === 'active'` — without it a Transfer to the
 *     account is refused by Stripe. This is the real gate.
 *   - `payouts_enabled` — without it the money reaches their Stripe balance and
 *     stops there. Studdy would have taken a parent's money for a tutor who
 *     cannot be paid, which is worse than refusing the booking.
 *
 * Verified against the installed SDK rather than memory: capability status is
 * `'active' | 'inactive' | 'pending'`, and `payouts_enabled` / `charges_enabled`
 * / `details_submitted` are booleans on the Account object.
 *
 * Pure: no SDK types, no network, no clock. `@studdy/domain` never imports a
 * provider SDK (brief §9).
 */

/** Stripe capability status, mirrored as a Studdy-owned union. */
export type CapabilityStatus = 'active' | 'inactive' | 'pending';

export const CAPABILITY_STATUSES: readonly CapabilityStatus[] = ['active', 'inactive', 'pending'];

/**
 * What Studdy shows a tutor, and what it stores.
 *
 * Named for what the tutor must DO, not for what Stripe calls it, because these
 * strings drive the only payments screen a tutor sees.
 */
export type ConnectedAccountStatus =
  /** No Stripe account exists yet. Nothing has been created on their behalf. */
  | 'not_onboarded'
  /** An account exists; Stripe still wants information. Resume the link. */
  | 'pending'
  /** Payable: transfers active and payouts enabled. */
  | 'complete'
  /** Stripe has disabled or blocked something. Action required. */
  | 'restricted';

export const CONNECTED_ACCOUNT_STATUSES: readonly ConnectedAccountStatus[] = [
  'not_onboarded',
  'pending',
  'complete',
  'restricted',
];

/**
 * The provider-authoritative slice of a connected account Studdy actually uses.
 *
 * Deliberately NOT the whole Stripe Account. Everything here is either a
 * decision input or a support-facing diagnostic; identity and KYC data are not
 * copied into Studdy at all.
 */
export interface ConnectedAccountState {
  /** Whether the connected account may create its own charges. NOT the gate. */
  readonly chargesEnabled: boolean;
  /** Whether Stripe will pay the balance out to the tutor's bank. A gate. */
  readonly payoutsEnabled: boolean;
  /** Whether a Transfer to this account will land. The primary gate. */
  readonly transfersCapability: CapabilityStatus;
  /** Whether the tutor finished submitting the onboarding form. Not a gate. */
  readonly detailsSubmitted: boolean;
  /** Requirement IDENTIFIERS Stripe still wants, e.g. `individual.id_number`. */
  readonly currentlyDue: readonly string[];
  /** Requirement identifiers already past their deadline. */
  readonly pastDue: readonly string[];
  /** Stripe's reason the account is disabled, when it is. */
  readonly disabledReason: string | null;
}

/**
 * THE ONE READINESS RULE. Every payability question in Studdy resolves here.
 *
 * Both conditions are necessary and neither is sufficient:
 * transfers active means the money can land; payouts enabled means the tutor can
 * actually get it. A tutor with one and not the other is not payable, and
 * telling them otherwise would be a promise Studdy cannot keep.
 */
export function canTutorReceivePayments(state: ConnectedAccountState): boolean {
  return state.transfersCapability === 'active' && state.payoutsEnabled;
}

/**
 * Collapse the provider state into the status a tutor is shown.
 *
 * ORDER MATTERS. `restricted` is checked before `complete` deliberately: an
 * account can be payable right now and still be heading for a deadline that will
 * disable it. Saying "you're all set" while Stripe is days from switching them
 * off is the failure this ordering prevents — the tutor gets told to act while
 * acting is still cheap.
 */
export function connectedAccountStatusFor(state: ConnectedAccountState): ConnectedAccountStatus {
  if (state.disabledReason !== null || state.pastDue.length > 0) return 'restricted';
  if (canTutorReceivePayments(state)) return 'complete';
  return 'pending';
}

/**
 * Whether Stripe still wants something from the tutor.
 *
 * Drives whether Studdy offers "resume setup". Note this can be true for an
 * account that is already payable — `eventually_due` requirements are collected
 * ahead of a threshold, and the honest thing is to let them finish early.
 */
export function onboardingIsIncomplete(state: ConnectedAccountState): boolean {
  return (
    state.currentlyDue.length > 0 || state.pastDue.length > 0 || !canTutorReceivePayments(state)
  );
}

/**
 * A NOT-YET-CREATED account, so callers have one shape to reason about.
 *
 * A tutor with no Stripe account and a tutor with an unusable one are different
 * situations for the product, but identical for the readiness rule: not payable.
 */
export const NO_CONNECTED_ACCOUNT: ConnectedAccountState = {
  chargesEnabled: false,
  payoutsEnabled: false,
  transfersCapability: 'inactive',
  detailsSubmitted: false,
  currentlyDue: [],
  pastDue: [],
  disabledReason: null,
};
