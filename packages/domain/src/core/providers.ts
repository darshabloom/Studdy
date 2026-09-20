import type { Money } from './money';

/**
 * Studdy-owned provider interfaces (brief §9, §10). Implementations live in
 * @studdy/integrations; provider SDK types never appear here.
 */

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /** Development messages are clearly marked and restricted to allowlisted addresses. */
  readonly environmentLabel: string | null;
  /**
   * A caller-supplied deduplication token, or null.
   *
   * PROVIDER-NEUTRAL BY INTENT: it says "this is the same logical message you
   * may already have accepted", which every transactional provider worth using
   * can honour. It exists because a worker can crash after the provider accepts
   * a message and before Studdy records that it did — the two writes are not in
   * one transaction and cannot be — so the retry is made harmless at the far
   * end instead.
   */
  readonly idempotencyKey: string | null;
}

export interface EmailDeliveryReceipt {
  readonly providerMessageId: string;
  readonly acceptedAt: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailDeliveryReceipt>;
}

/** Payment adapter surface for the first package — grows with the Stripe slice. */
export interface PaymentIntentRequest {
  readonly amount: Money;
  readonly idempotencyKey: string;
  readonly customerReference: string;
  readonly description: string;
}

export interface PaymentIntentResult {
  readonly providerPaymentId: string;
  readonly status: 'requires_action' | 'processing' | 'succeeded' | 'failed';
  readonly clientSecret: string | null;
}

export interface PaymentProvider {
  createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult>;
}

export interface ConnectedAccountProvider {
  /** Resolve the connected-account state for a tutor. */
  accountState(accountReference: string): Promise<'not_onboarded' | 'pending' | 'complete'>;
}

export interface RefundRequest {
  readonly providerPaymentId: string;
  readonly amount: Money | null; // null = full refund
  readonly idempotencyKey: string;
}

export interface RefundProvider {
  refund(request: RefundRequest): Promise<{ providerRefundId: string }>;
}

export interface PayoutProvider {
  /** Payout orchestration lands with the payments slice; the interface is reserved. */
  scheduled(): Promise<never[]>;
}
