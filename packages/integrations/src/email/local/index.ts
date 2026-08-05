import { randomUUID } from 'node:crypto';
import type { EmailDeliveryReceipt, EmailMessage, EmailProvider } from '@studdy/domain';

/**
 * Local preview email provider (brief §10): a safe in-memory inbox that never
 * sends real messages. Supabase's local Mailpit inbox covers auth emails; this
 * provider covers application emails in local development and tests.
 *
 * The production transactional provider is deliberately unselected — an
 * EMAIL PROVIDER DECISION REQUIRED comparison precedes any provider adapter.
 */
export interface StoredEmail extends EmailMessage {
  readonly providerMessageId: string;
  readonly acceptedAt: string;
}

export class LocalPreviewEmailProvider implements EmailProvider {
  private readonly inbox: StoredEmail[] = [];

  async send(message: EmailMessage): Promise<EmailDeliveryReceipt> {
    const receipt: EmailDeliveryReceipt = {
      providerMessageId: `local_${randomUUID()}`,
      acceptedAt: new Date().toISOString(),
    };
    this.inbox.push({ ...message, ...receipt });
    return receipt;
  }

  messages(): readonly StoredEmail[] {
    return [...this.inbox];
  }

  clear(): void {
    this.inbox.length = 0;
  }
}
