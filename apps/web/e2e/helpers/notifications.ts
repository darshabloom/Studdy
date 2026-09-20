import { createDatabaseClient } from '@studdy/database';

/**
 * Reading what the drain actually recorded.
 *
 * WHY THE DATABASE AND NOT AN INBOX. Outside production the drain hands every
 * message to the in-memory preview provider, which lives in the Next server's
 * own process and is unreachable from a Playwright worker. Mailpit is not an
 * alternative: it receives SMTP from Supabase's auth mailer, and Studdy's
 * transactional mail goes over Resend's HTTP API — the two never meet.
 *
 * So the assertion is made against Studdy's own durable record instead, which
 * is the stronger claim anyway. `notification_deliveries` reaching `sent` means
 * the whole chain ran: the outbox entry was claimed, its recipients resolved
 * server-side from real records, a template rendered, the provider accepted it
 * and the receipt was written back. The only link not covered is the provider's
 * own transport, which belongs to the adapter's unit tests rather than to a
 * journey test.
 */
export interface DeliveryRow {
  readonly eventType: string;
  readonly recipientRole: string;
  readonly templateCode: string;
  readonly statusCode: string;
  readonly provider: string | null;
  readonly providerMessageId: string | null;
  readonly toAddress: string;
}

/**
 * Every delivery recorded for the most recent outbox entry of this event type.
 *
 * Scoped to ONE entry rather than to the event type at large, so a spec cannot
 * accidentally pass on a delivery some earlier test produced.
 */
export async function deliveriesForLatest(eventType: string): Promise<readonly DeliveryRow[]> {
  const { sql } = createDatabaseClient();
  try {
    const rows = await sql`
      select d.event_type, d.recipient_role_code, d.template_code, d.status_code,
             d.provider, d.provider_message_id, d.to_address
      from communications.notification_deliveries d
      where d.outbox_entry_id = (
        select e.id
        from audit.outbox_entries e
        where e.event_type = ${eventType}
        order by e.created_at desc
        limit 1
      )
      order by d.recipient_role_code`;
    return rows.map((row) => ({
      eventType: row['event_type'] as string,
      recipientRole: row['recipient_role_code'] as string,
      templateCode: row['template_code'] as string,
      statusCode: row['status_code'] as string,
      provider: (row['provider'] as string | null) ?? null,
      providerMessageId: (row['provider_message_id'] as string | null) ?? null,
      toAddress: row['to_address'] as string,
    }));
  } finally {
    await sql.end();
  }
}

/** The status of the most recent outbox entry of this event type. */
export async function latestOutboxStatus(eventType: string): Promise<string | null> {
  const { sql } = createDatabaseClient();
  try {
    const rows = await sql`
      select status_code
      from audit.outbox_entries
      where event_type = ${eventType}
      order by created_at desc
      limit 1`;
    const [row] = rows;
    return row === undefined ? null : (row['status_code'] as string);
  } finally {
    await sql.end();
  }
}
