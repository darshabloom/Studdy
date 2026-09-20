import { Resend } from 'resend';
import type { EmailDeliveryReceipt, EmailMessage, EmailProvider } from '@studdy/domain';

/**
 * The Resend adapter — the only file in Studdy that knows Resend exists.
 *
 * Provider SDK types never cross into `@studdy/domain` or `@studdy/database`
 * (brief §9), exactly as the Stripe adapter established. What goes in is a
 * Studdy `EmailMessage`; what comes back is a Studdy `EmailDeliveryReceipt`.
 * A second provider would be a sibling of this file rather than a rewrite.
 *
 * THE API KEY IS SERVER-ONLY. It is read by the caller from the server
 * environment and passed in, never `NEXT_PUBLIC_`, and never logged. A key in
 * the browser bundle would let anyone send mail as Studdy.
 */

export const RESEND_PROVIDER = 'resend' as const;

export class ResendConfigurationError extends Error {
  override name = 'ResendConfigurationError';
}

/**
 * A send that the provider refused.
 *
 * Carries a short CODE, never the provider's prose. The message is stored on a
 * delivery row and read by operations; a provider body can quote the recipient
 * address back, and there is no reason to keep that twice.
 */
export class ResendSendError extends Error {
  override name = 'ResendSendError';
  constructor(readonly code: string) {
    super(`Resend refused the message: ${code}`);
  }
}

export function resendClient(apiKey: string | undefined): Resend {
  if (apiKey === undefined || apiKey.trim() === '') {
    throw new ResendConfigurationError(
      'RESEND_API_KEY is not set. Refusing to attempt a transactional send.',
    );
  }
  return new Resend(apiKey);
}

export interface ResendProviderOptions {
  /**
   * The verified `From`, e.g. `Studdy <bookings@studdy.example>`.
   *
   * MUST BE ON A DOMAIN VERIFIED IN RESEND before mail reaches anyone other
   * than the account owner. Resend's own `onboarding@resend.dev` works without
   * verification but, by Resend's rule, only delivers to the address that owns
   * the Resend account — which is why development redirects every message to a
   * single allowlisted mailbox rather than pretending it can reach a family.
   */
  readonly fromAddress: string;
  /** `local` / `development` / `production`, stamped on non-production mail. */
  readonly environmentLabel: string | null;
}

/**
 * Send transactional email through Resend.
 *
 * IDEMPOTENT AT THE PROVIDER, which is the only real answer to a worker that
 * crashes between "Resend accepted this" and "Studdy wrote that down". Those
 * two writes are not in one transaction and cannot be, so the retry is made
 * harmless at the far end: Resend keeps an idempotency key for 24 hours and
 * returns the ORIGINAL message for a repeat, rather than sending twice.
 */
export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly client: Resend,
    private readonly options: ResendProviderOptions,
  ) {}

  async send(message: EmailMessage): Promise<EmailDeliveryReceipt> {
    const { data, error } = await this.client.emails.send(
      {
        from: this.options.fromAddress,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      // Resend's own recommended shape is `<event-type>/<entity-id>`, which is
      // exactly what the delivery key already is.
      message.idempotencyKey === null ? undefined : { idempotencyKey: message.idempotencyKey },
    );

    if (error !== null) {
      // `name` is Resend's machine-readable discriminator; `message` is prose.
      throw new ResendSendError(error.name ?? 'send_failed');
    }
    if (data === null || data.id === '') {
      throw new ResendSendError('no_message_id');
    }

    return { providerMessageId: data.id, acceptedAt: new Date().toISOString() };
  }
}
