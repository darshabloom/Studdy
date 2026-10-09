import type Stripe from 'stripe';

/**
 * Stripe transfers — sending a tutor their share.
 *
 * THIS FILE ONLY TALKS TO STRIPE. Whether a transfer is allowed, to whom and for
 * how much are decided in `@studdy/domain` and `@studdy/database`; what crosses in
 * here is a destination account, an amount in minor units, the charge it is
 * drawn from and an idempotency key.
 *
 * SEPARATE CHARGES AND TRANSFERS. The parent's payment was a charge on Studdy's
 * own account and the money sits in Studdy's balance. A transfer moves the tutor's
 * share from there to their connected account, and Stripe then pays it out to
 * their bank on its own schedule.
 *
 * `source_transaction` ties each transfer to the charge it came from. That is
 * what lets a transfer be made before the charge's funds have fully settled
 * (they are `pending` for days after a card payment) rather than failing with
 * insufficient balance, and it caps the transfer at what that charge brought in.
 */

export interface StripeTransferSnapshot {
  readonly providerTransferId: string;
  readonly amountMinor: bigint;
  /** Upper case, normalised at the boundary like every other currency here. */
  readonly currencyCode: string;
  readonly reversed: boolean;
  readonly destinationAccountId: string | null;
}

function snapshotOf(transfer: Stripe.Transfer): StripeTransferSnapshot {
  const destination = transfer.destination ?? null;
  return {
    providerTransferId: transfer.id,
    amountMinor: BigInt(transfer.amount),
    currencyCode: transfer.currency.toUpperCase(),
    reversed: transfer.reversed === true,
    destinationAccountId:
      destination === null ? null : typeof destination === 'string' ? destination : destination.id,
  };
}

export interface CreateTransferInput {
  /** The tutor's connected account, from Studdy's own row. Never from a caller. */
  readonly destinationAccountId: string;
  readonly amountMinor: bigint;
  /** Lower or upper case; Stripe wants lower and this normalises. */
  readonly currencyCode: string;
  /** The charge this transfer is drawn from. */
  readonly sourceChargeId: string;
  /** Groups a payment's transfers, and is what a lost one is found by. */
  readonly transferGroup: string;
  /** Stable per obligation attempt. Stripe returns the SAME transfer for a repeated key. */
  readonly idempotencyKey: string;
  /** Studdy's own ids, for support to correlate. Never a person. */
  readonly studdyTransferId: string;
  readonly studdyPaymentId: string;
}

/**
 * Send a tutor's share.
 *
 * The amount is passed explicitly and as a safe integer; a BigInt that does not
 * fit is refused here rather than silently rounded.
 */
export async function createTransfer(
  stripe: Stripe,
  input: CreateTransferInput,
): Promise<StripeTransferSnapshot> {
  if (input.amountMinor <= 0n || input.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('A transfer amount must be a positive, safe integer of minor units.');
  }
  const transfer = await stripe.transfers.create(
    {
      amount: Number(input.amountMinor),
      currency: input.currencyCode.toLowerCase(),
      destination: input.destinationAccountId,
      source_transaction: input.sourceChargeId,
      transfer_group: input.transferGroup,
      metadata: {
        studdy_transfer_id: input.studdyTransferId,
        studdy_payment_id: input.studdyPaymentId,
      },
    },
    { idempotencyKey: input.idempotencyKey },
  );
  return snapshotOf(transfer);
}

/**
 * Find a transfer Studdy already sent, by Studdy's OWN id.
 *
 * WHY THE IDEMPOTENCY KEY IS NOT ENOUGH. Stripe honours a key for twenty-four
 * hours, and settlement runs weekly. An obligation left `pending` by a run that
 * died after Stripe accepted the transfer would, a week later, be retried with a
 * key Stripe no longer remembers — and the tutor would be paid twice. Asking
 * Stripe what it already holds for this payment's group, and adopting the
 * transfer whose metadata names this obligation, closes that window completely
 * rather than relying on a time limit.
 */
export async function findTransferByStuddyId(
  stripe: Stripe,
  transferGroup: string,
  studdyTransferId: string,
): Promise<StripeTransferSnapshot | null> {
  const page = await stripe.transfers.list({ transfer_group: transferGroup, limit: 20 });
  const match = page.data.find(
    (transfer) => transfer.metadata?.['studdy_transfer_id'] === studdyTransferId,
  );
  return match === undefined ? null : snapshotOf(match);
}
