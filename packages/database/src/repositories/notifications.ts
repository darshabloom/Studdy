import { and, eq, exists, gte, inArray, isNull, lte, ne, not, or, sql as raw } from 'drizzle-orm';
import {
  DELIVERABLE_EVENT_TYPES,
  deliveryIdempotencyKey,
  isDeliverableEventType,
  recipientRolesFor,
  templateFor,
  type DeliverableEventType,
  type RecipientRole,
} from '@studdy/domain/notifications';
import { createDatabaseClient } from '../client';
import { notificationDeliveries, outboxEntries } from '../schema/index';

/**
 * Turning outbox entries into per-recipient deliveries, and recording what
 * happened to each.
 *
 * THE LEDGER DOES NOT KNOW RESEND, exactly as it does not know Stripe.
 * `@studdy/database` depends on no integration package. What crosses this
 * boundary outward is a work item — a role, an address, a template name and the
 * facts that template may render — and what crosses back is a provider message
 * id or an error code. Swapping the provider changes nothing in this file.
 *
 * EVERY RECIPIENT AND EVERY FACT IS RESOLVED HERE, SERVER-SIDE, FROM STUDDY'S
 * OWN RECORDS. The outbox payloads carry internal ids and nothing else — that
 * was checked rather than assumed:
 *
 *   payment.required        { tutorRequestId, paymentDeadlineAt }
 *   booking.confirmed       { intendedLessonRequestId, tutorRequestId }
 *   payment.refund_required { paymentId, reason }
 *
 * No name, address or amount is in any of them, and none is added: an outbox
 * row is a durable record of a business event, and filling it with a copy of
 * someone's email address to save a join would spread PII into a table that
 * exists to be kept. The ids are enough, because the authoritative data is one
 * query away and is correct at the moment of sending rather than at the moment
 * of queuing.
 *
 * ADDRESSES COME FROM `identity.auth_identity_links.authentication_email`.
 * `identity.contact_points` is the eventual home for a preferred contact
 * address and is EMPTY today — verified, not assumed — so the sign-in address
 * is the only address Studdy actually holds. When contact points are populated,
 * this is the one place that changes.
 */

/** How the drain reports what it did. Counts only; never a recipient. */
export interface NotificationBatchOutcome {
  readonly entriesExamined: number;
  readonly deliveriesPlanned: number;
  readonly entriesUnresolvable: number;
  /**
   * Deliveries that have run out of attempts and were NOT handed back as work.
   *
   * Reported rather than merely skipped: a message Studdy has given up on is
   * the one outcome here that a person has to know about, and a silent skip
   * would make giving up look exactly like having nothing to do.
   */
  readonly deliveriesExhausted: number;
}

/**
 * One email that still needs sending, with everything its template may say.
 *
 * DELIBERATELY NARROW. A template can render only what is on this object, so
 * "the tutor's email must not mention the parent's payment" is enforced by the
 * shape of the data rather than by remembering. There is no payment intent id,
 * no connected account, no provider cost and no other tutor anywhere in it.
 */
export interface NotificationWorkItem {
  readonly deliveryId: string;
  readonly outboxEntryId: string;
  readonly eventType: DeliverableEventType;
  readonly recipientRole: RecipientRole;
  readonly templateCode: string;
  readonly toAddress: string;
  readonly idempotencyKey: string;
  readonly attempts: number;
  readonly context: NotificationContext;
}

/**
 * The facts a template may render, resolved from authoritative records.
 *
 * One shape for all three events rather than a union, because the templates
 * differ by what they READ, not by what exists. Fields absent for an event are
 * null, and a template that reads a null it should not have is a rendering bug
 * caught by a test rather than a leak.
 */
export interface NotificationContext {
  /** The family-facing `LR-` reference, and the payment page's path segment. */
  readonly requestReference: string | null;
  readonly studentFirstName: string | null;
  readonly tutorFirstName: string | null;
  readonly lessonStartAt: Date | null;
  readonly durationMinutes: number | null;
  readonly formatCode: string | null;
  readonly timeZone: string | null;
  readonly paymentDeadlineAt: Date | null;
  readonly amountMinor: bigint | null;
  readonly currencyCode: string | null;
  /** `PAY-` reference. Ops only — a support handle, not a provider id. */
  readonly paymentReference: string | null;
  /** Why fulfilment was blocked. Ops only. */
  readonly reason: string | null;
}

const EMPTY_CONTEXT: NotificationContext = {
  requestReference: null,
  studentFirstName: null,
  tutorFirstName: null,
  lessonStartAt: null,
  durationMinutes: null,
  formatCode: null,
  timeZone: null,
  paymentDeadlineAt: null,
  amountMinor: null,
  currencyCode: null,
  paymentReference: null,
  reason: null,
};

export interface ClaimNotificationWorkInput {
  readonly limit?: number;
  readonly now?: Date;
  /**
   * Where `payment.refund_required` goes. Configuration, so the caller owns it.
   *
   * The repository must not read environment variables: it is used by tests,
   * by the drain and by scripts, and a value that changes with the process is
   * not something a durable delivery row should be built from silently.
   */
  readonly opsEmailAddress: string;
  /**
   * Non-production only: send everything here instead of to the real person.
   *
   * THE GUARD THAT STOPS DEVELOPMENT MAIL REACHING REAL PEOPLE. Seeded accounts
   * use `@local.studdy.test` addresses that do not exist, and a staging
   * database can hold real ones. When set, every resolved address is replaced
   * by this one and the intended recipient stays recoverable through
   * `recipient_user_id`.
   */
  readonly redirectAllTo?: string | null;
}

/**
 * Claim due outbox entries, resolve their recipients, and return the work.
 *
 * ONE TRANSACTION, `FOR UPDATE SKIP LOCKED`, so two drains running at once take
 * different entries rather than fighting over the same one. Planning is
 * idempotent through the delivery table's unique `(outbox_entry_id,
 * recipient_role_code)` index: a drain that crashed halfway through planning
 * re-plans, collides, and inserts only what was missing.
 */
export async function claimNotificationWork(input: ClaimNotificationWorkInput): Promise<{
  readonly outcome: NotificationBatchOutcome;
  readonly work: readonly NotificationWorkItem[];
}> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  const limit = input.limit ?? 25;
  try {
    return await db.transaction(async (tx) => {
      /*
       * Only the event types this slice delivers. The outbox carries others —
       * `tutor_request.sent`, `tutor_request.closed` — and they are left
       * `pending` and untouched, not failed: nothing is wrong with them, and
       * they must still be here when their own slice arrives.
       *
       * THE LIST COMES FROM THE DOMAIN, never a copy of it. A second literal
       * here would typecheck, pass every test while the two agreed, and then
       * silently drop the next event type somebody added to
       * `DELIVERABLE_EVENT_TYPES` — a bug with no failing test to find it.
       * There is one source of truth and this query reads it.
       */
      const due = await tx
        .select({
          id: outboxEntries.id,
          eventType: outboxEntries.eventType,
          payload: outboxEntries.payload,
          attempts: outboxEntries.attempts,
        })
        .from(outboxEntries)
        .where(
          and(
            eq(outboxEntries.statusCode, 'pending'),
            inArray(outboxEntries.eventType, [...DELIVERABLE_EVENT_TYPES]),
            or(isNull(outboxEntries.nextAttemptAt), lte(outboxEntries.nextAttemptAt, now)),
          ),
        )
        .limit(limit)
        .for('update', { skipLocked: true });

      let planned = 0;
      let unresolvable = 0;
      const entryIds: string[] = [];

      for (const entry of due) {
        /*
         * The query above already guarantees this. The guard stays because it
         * is what NARROWS `event_type` from the database's `string` to
         * `DeliverableEventType`, which is what makes `recipientRolesFor` and
         * `templateFor` below total rather than partial. Deleting it as
         * redundant would be a type error, which is the point.
         */
        if (!isDeliverableEventType(entry.eventType)) continue;
        const payload = entry.payload as Record<string, unknown>;

        const context = await resolveContext(tx, entry.eventType, payload);
        if (context === null) {
          /*
           * A POISON EVENT IS PARKED, NOT RETRIED FOREVER AND NOT LOST.
           *
           * Its records have gone or never existed, so no amount of retrying
           * will resolve it. Backing it off keeps it out of every future batch
           * while leaving the row intact for a human — and, critically, stops
           * one bad entry occupying a slot in every drain and starving the
           * others.
           */
          unresolvable += 1;
          await tx
            .update(outboxEntries)
            .set({
              attempts: entry.attempts + 1,
              nextAttemptAt: backoffFrom(now, entry.attempts + 1),
              updatedAt: now,
            })
            .where(eq(outboxEntries.id, entry.id));
          continue;
        }

        entryIds.push(entry.id);

        for (const role of recipientRolesFor(entry.eventType)) {
          const recipient = await resolveRecipient(tx, entry.eventType, role, payload);
          // A customer role with no resolvable address: park the whole entry
          // rather than sending half of it.
          if (role !== 'ops' && recipient === null) continue;

          const intended = role === 'ops' ? input.opsEmailAddress : recipient!.address;
          const toAddress =
            input.redirectAllTo !== undefined && input.redirectAllTo !== null
              ? input.redirectAllTo
              : intended;

          const inserted = await tx
            .insert(notificationDeliveries)
            .values({
              outboxEntryId: entry.id,
              eventType: entry.eventType,
              recipientRoleCode: role,
              recipientUserId: role === 'ops' ? null : (recipient!.userId ?? null),
              toAddress,
              channelCode: 'email',
              templateCode: templateFor(entry.eventType, role),
              statusCode: 'pending',
              idempotencyKey: deliveryIdempotencyKey(entry.eventType, entry.id, role),
            })
            // Already planned on an earlier drain. The unique index is the
            // guarantee; this is just how a re-plan stays quiet.
            .onConflictDoNothing()
            .returning({ id: notificationDeliveries.id });
          if (inserted.length > 0) planned += 1;
        }
      }

      if (entryIds.length === 0) {
        return {
          outcome: {
            entriesExamined: due.length,
            deliveriesPlanned: planned,
            entriesUnresolvable: unresolvable,
            // Nothing was claimed, so nothing could be exhausted.
            deliveriesExhausted: 0,
          },
          work: [],
        };
      }

      // Everything still owed for the entries just claimed, with the context
      // each template needs. Re-read rather than assembled from the inserts, so
      // deliveries left `failed` by an earlier drain are picked up too.
      const rows = await tx
        .select()
        .from(notificationDeliveries)
        .where(
          and(
            inArray(notificationDeliveries.outboxEntryId, entryIds),
            inArray(notificationDeliveries.statusCode, ['pending', 'failed']),
          ),
        );

      /*
       * WHERE GIVING UP HAPPENS. Split rather than filtered, because the two
       * halves have different fates: the retryable ones become work, and the
       * exhausted ones become a number the drain reports and logs.
       *
       * `attempts` is incremented by `recordDeliverySent` and
       * `recordDeliveryFailed`, so this counts real attempts at the provider,
       * not times the row was looked at.
       */
      const retryable = rows.filter((row) => row.attempts < MAX_DELIVERY_ATTEMPTS);
      const exhausted = rows.length - retryable.length;

      const contexts = new Map<string, NotificationContext>();
      for (const entry of due) {
        if (!entryIds.includes(entry.id)) continue;
        if (!isDeliverableEventType(entry.eventType)) continue;
        const context = await resolveContext(
          tx,
          entry.eventType,
          entry.payload as Record<string, unknown>,
        );
        if (context !== null) contexts.set(entry.id, context);
      }

      const work: NotificationWorkItem[] = [];
      for (const row of retryable) {
        const context = contexts.get(row.outboxEntryId);
        if (context === undefined) continue;
        work.push({
          deliveryId: row.id,
          outboxEntryId: row.outboxEntryId,
          eventType: row.eventType as DeliverableEventType,
          recipientRole: row.recipientRoleCode as RecipientRole,
          templateCode: row.templateCode,
          toAddress: row.toAddress,
          idempotencyKey: row.idempotencyKey,
          attempts: row.attempts,
          context,
        });
      }

      return {
        outcome: {
          entriesExamined: due.length,
          deliveriesPlanned: planned,
          entriesUnresolvable: unresolvable,
          deliveriesExhausted: exhausted,
        },
        work,
      };
    });
  } finally {
    await sql.end();
  }
}

/**
 * How many times one recipient's message is attempted before Studdy stops.
 *
 * A RETRY THAT CAN NEVER SUCCEED IS NOT RESILIENCE. A dead address, a
 * recipient the provider has suppressed, or a bug that makes the same send
 * fail every time will fail identically on the ten-thousandth attempt as on
 * the ninth — and at a one-minute cadence that is roughly 43,000 provider
 * calls a month for one bad address, burying every real failure in noise.
 *
 * Eight, with the backoff below, spans a little over four hours: long enough
 * to ride out any provider outage worth waiting for, short enough that a
 * permanently broken delivery becomes a thing an operator can see rather than
 * a thing the logs are full of.
 *
 * EXHAUSTION IS NOT A NEW STATUS. The row stays `failed` — which is what it
 * is — and the claim query simply stops selecting it. Inventing a terminal
 * status would need a migration and would make `failed` mean "failed, but
 * still ours to retry", which is a distinction the drain does not need and
 * the CHECK constraint would have to learn.
 */
export const MAX_DELIVERY_ATTEMPTS = 8;

/** Exponential-ish backoff, capped. Minutes, because email is not urgent. */
function backoffFrom(now: Date, attempts: number): Date {
  const minutes = Math.min(60, 2 ** Math.min(attempts, 5));
  return new Date(now.getTime() + minutes * 60_000);
}

type Tx = Parameters<
  Parameters<ReturnType<typeof createDatabaseClient>['db']['transaction']>[0]
>[0];

/**
 * The address and user id for one role of one event.
 *
 * SCOPED BY THE EVENT'S OWN RECORDS, always. The family is
 * `intended_lesson_requests.requested_by_user_id` — the person who made this
 * request — and the tutor is `tutor_profiles.user_id` for the tutor request
 * that won it. There is no path that takes a user id from anywhere else, so a
 * notification for one family cannot be addressed to another.
 */
async function resolveRecipient(
  tx: Tx,
  eventType: DeliverableEventType,
  role: RecipientRole,
  payload: Record<string, unknown>,
): Promise<{ userId: string | null; address: string } | null> {
  if (role === 'ops') return null;

  const tutorRequestId = payload['tutorRequestId'];
  if (typeof tutorRequestId !== 'string') return null;

  if (role === 'family') {
    const [row] = await tx.execute(raw`
      select l.authentication_email as address, u.id as user_id
      from bookings.tutor_requests tr
      join bookings.intended_lesson_requests ilr on ilr.id = tr.intended_lesson_request_id
      join identity.users u on u.id = ilr.requested_by_user_id
      join identity.auth_identity_links l on l.user_id = u.id
      where tr.id = ${tutorRequestId}::uuid
        and l.authentication_email is not null
      limit 1`);
    if (row === undefined) return null;
    return { userId: row['user_id'] as string, address: row['address'] as string };
  }

  // tutor
  const [row] = await tx.execute(raw`
    select l.authentication_email as address, u.id as user_id
    from bookings.tutor_requests tr
    join tutors.tutor_profiles tp on tp.id = tr.tutor_profile_id
    join identity.users u on u.id = tp.user_id
    join identity.auth_identity_links l on l.user_id = u.id
    where tr.id = ${tutorRequestId}::uuid
      and l.authentication_email is not null
    limit 1`);
  if (row === undefined) return null;
  return { userId: row['user_id'] as string, address: row['address'] as string };
}

/**
 * Everything the templates for this event may render.
 *
 * Returns null when the event's own records cannot be found, which is what
 * makes an entry poison rather than merely unlucky.
 */
async function resolveContext(
  tx: Tx,
  eventType: DeliverableEventType,
  payload: Record<string, unknown>,
): Promise<NotificationContext | null> {
  if (eventType === 'payment.refund_required') {
    const paymentId = payload['paymentId'];
    if (typeof paymentId !== 'string') return null;
    const [row] = await tx.execute(raw`
      select p.reference as payment_reference, p.total_charged_minor, p.currency_code,
             ilr.reference as request_reference
      from payments.payments p
      join bookings.intended_lesson_requests ilr on ilr.id = p.intended_lesson_request_id
      where p.id = ${paymentId}::uuid
      limit 1`);
    if (row === undefined) return null;
    const reason = payload['reason'];
    return {
      ...EMPTY_CONTEXT,
      paymentReference: row['payment_reference'] as string,
      requestReference: row['request_reference'] as string,
      amountMinor: BigInt(row['total_charged_minor'] as string),
      currencyCode: row['currency_code'] as string,
      reason: typeof reason === 'string' ? reason : null,
    };
  }

  const tutorRequestId = payload['tutorRequestId'];
  if (typeof tutorRequestId !== 'string') return null;

  /*
   * The lesson, its people and its money, from the winning tutor request.
   *
   * The amount is the live payment's `total_charged_minor` where one exists and
   * the tutor's listed price where it does not — `payment.required` fires at
   * SELECTION, before any payment row is created, and the listed price is
   * exactly the figure the family was shown when they chose. Never a figure
   * recomputed here: this file does not price anything.
   */
  const [row] = await tx.execute(raw`
    select ilr.reference as request_reference,
           ilr.duration_minutes, ilr.format_code, ilr.time_zone,
           sp.preferred_name as student_first_name,
           tp.public_first_name as tutor_first_name,
           tr.payment_deadline_at,
           trto.starts_at as lesson_start_at,
           coalesce(p.total_charged_minor, sv.price_amount_minor) as amount_minor,
           coalesce(p.currency_code, sv.currency_code) as currency_code
    from bookings.tutor_requests tr
    join bookings.intended_lesson_requests ilr on ilr.id = tr.intended_lesson_request_id
    join students.student_subject_sections sss on sss.id = ilr.student_subject_section_id
    join students.student_profiles sp on sp.id = sss.student_profile_id
    join tutors.tutor_profiles tp on tp.id = tr.tutor_profile_id
    join services.service_versions sv on sv.id = tr.service_version_id
    left join bookings.tutor_request_time_options trto on trto.id = tr.accepted_time_option_id
    left join payments.payments p
      on p.tutor_request_id = tr.id
     and p.status_code in ('requires_payment', 'processing', 'succeeded')
    where tr.id = ${tutorRequestId}::uuid
    limit 1`);
  if (row === undefined) return null;

  return {
    ...EMPTY_CONTEXT,
    requestReference: row['request_reference'] as string,
    studentFirstName: row['student_first_name'] as string,
    tutorFirstName: row['tutor_first_name'] as string,
    lessonStartAt:
      row['lesson_start_at'] === null ? null : new Date(row['lesson_start_at'] as string),
    durationMinutes: Number(row['duration_minutes']),
    formatCode: row['format_code'] as string,
    timeZone: row['time_zone'] as string,
    paymentDeadlineAt:
      row['payment_deadline_at'] === null ? null : new Date(row['payment_deadline_at'] as string),
    amountMinor: BigInt(row['amount_minor'] as string),
    currencyCode: row['currency_code'] as string,
  };
}

/**
 * One recipient received their message.
 *
 * Guarded on not already being `sent`, so a duplicated acknowledgement is a
 * no-op rather than a second write. The provider message id is the proof the
 * CHECK constraint insists on.
 */
export async function recordDeliverySent(input: {
  readonly deliveryId: string;
  readonly provider: string;
  readonly providerMessageId: string;
  readonly now?: Date;
}): Promise<void> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    await db
      .update(notificationDeliveries)
      .set({
        statusCode: 'sent',
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        sentAt: now,
        attempts: raw`${notificationDeliveries.attempts} + 1`,
        lastErrorCode: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationDeliveries.id, input.deliveryId),
          inArray(notificationDeliveries.statusCode, ['pending', 'failed']),
        ),
      );
  } finally {
    await sql.end();
  }
}

/**
 * One recipient's send failed.
 *
 * `failed` is NOT terminal — the next drain picks it up again. What makes that
 * safe is the deterministic idempotency key, which the provider honours, rather
 * than any belief about whether the failed attempt really did nothing.
 */
export async function recordDeliveryFailed(input: {
  readonly deliveryId: string;
  readonly errorCode: string;
  readonly now?: Date;
}): Promise<void> {
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    await db
      .update(notificationDeliveries)
      .set({
        statusCode: 'failed',
        failedAt: now,
        attempts: raw`${notificationDeliveries.attempts} + 1`,
        // A code, never a provider body and never a stack.
        lastErrorCode: input.errorCode.slice(0, 120),
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationDeliveries.id, input.deliveryId),
          // Never walk a delivered message backwards.
          inArray(notificationDeliveries.statusCode, ['pending', 'failed']),
        ),
      );
  } finally {
    await sql.end();
  }
}

/**
 * Close out the outbox entries whose every delivery has landed.
 *
 * **AN ENTRY IS `sent` ONLY WHEN NOTHING IS STILL OWED.** This is the rule the
 * whole schema change exists to make expressible: `booking.confirmed` is not
 * done because the family was emailed, it is done when the family AND the tutor
 * were. An entry with any `pending` or `failed` delivery is left `pending` with
 * a backoff, and the next drain retries only the recipients that still need it.
 */
export async function settleOutboxEntries(input: {
  readonly outboxEntryIds: readonly string[];
  readonly now?: Date;
}): Promise<{ readonly settled: number }> {
  if (input.outboxEntryIds.length === 0) return { settled: 0 };
  const { sql, db } = createDatabaseClient();
  const now = input.now ?? new Date();
  try {
    const ids = [...input.outboxEntryIds];

    /*
     * THE OPERATOR FORM, NOT A RAW TEMPLATE, and that is not a style choice.
     * Passing a `Date` into a raw SQL template hands the driver a value it
     * cannot bind: it typechecks perfectly and fails at RUNTIME. The repository
     * has been caught by this before (handoff §7), and a settlement query is
     * exactly where a runtime-only failure would be worst — the email has
     * already gone, and only the bookkeeping breaks.
     */
    const stillOwed = db
      .select({ one: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.outboxEntryId, outboxEntries.id),
          ne(notificationDeliveries.statusCode, 'sent'),
        ),
      );
    const anyPlanned = db
      .select({ one: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.outboxEntryId, outboxEntries.id));

    const settled = await db
      .update(outboxEntries)
      .set({ statusCode: 'sent', processedAt: now, updatedAt: now })
      .where(
        and(
          inArray(outboxEntries.id, ids),
          eq(outboxEntries.statusCode, 'pending'),
          // Planned at all, and nothing left owed.
          exists(anyPlanned),
          not(exists(stillOwed)),
        ),
      )
      .returning({ id: outboxEntries.id });

    /*
     * ANYTHING STILL OWED BACKS OFF — exponentially, like the poison path, and
     * no longer at a flat sixty seconds.
     *
     * A flat minute against a one-minute cron is not a backoff at all: an entry
     * whose delivery keeps failing was re-examined every single tick, for ever.
     * `backoffFrom` is the same curve the unresolvable path already used, so
     * there is one retry policy in this file rather than two.
     *
     * READ, THEN WRITE PER ENTRY, because each entry's delay depends on its own
     * attempt count. Expressing the curve in SQL would mean maintaining the
     * formula twice and letting the two drift; the batch is bounded at 25, so a
     * short loop is the cheaper honesty.
     */
    const owed = await db
      .select({ id: outboxEntries.id, attempts: outboxEntries.attempts })
      .from(outboxEntries)
      .where(
        and(
          inArray(outboxEntries.id, ids),
          eq(outboxEntries.statusCode, 'pending'),
          exists(stillOwed),
        ),
      );

    for (const entry of owed) {
      const attempts = entry.attempts + 1;
      await db
        .update(outboxEntries)
        .set({ attempts, nextAttemptAt: backoffFrom(now, attempts), updatedAt: now })
        .where(eq(outboxEntries.id, entry.id));
    }

    return { settled: settled.length };
  } finally {
    await sql.end();
  }
}

/**
 * Deliveries Studdy has given up on. THE OPERATIONAL VIEW OF GIVING UP.
 *
 * The drain reports a COUNT every time it runs, which is what makes the
 * condition noticeable; this is what makes it actionable. Returns the role,
 * the template and the last error code — enough to tell a dead address from a
 * provider outage that outlasted the retries — and deliberately NOT the
 * recipient's address, because an operator triaging a stuck queue does not
 * need to read one, and this function would otherwise become the convenient
 * way to list every address Studdy holds.
 *
 * Server-only, like everything else in this file.
 */
export async function exhaustedDeliveries(input?: { readonly limit?: number }): Promise<
  readonly {
    deliveryId: string;
    outboxEntryId: string;
    eventType: string;
    recipientRole: string;
    templateCode: string;
    attempts: number;
    lastErrorCode: string | null;
    failedAt: Date | null;
  }[]
> {
  const { sql, db } = createDatabaseClient();
  try {
    const rows = await db
      .select({
        deliveryId: notificationDeliveries.id,
        outboxEntryId: notificationDeliveries.outboxEntryId,
        eventType: notificationDeliveries.eventType,
        recipientRole: notificationDeliveries.recipientRoleCode,
        templateCode: notificationDeliveries.templateCode,
        attempts: notificationDeliveries.attempts,
        lastErrorCode: notificationDeliveries.lastErrorCode,
        failedAt: notificationDeliveries.failedAt,
      })
      .from(notificationDeliveries)
      .where(
        and(
          ne(notificationDeliveries.statusCode, 'sent'),
          gte(notificationDeliveries.attempts, MAX_DELIVERY_ATTEMPTS),
        ),
      )
      .orderBy(notificationDeliveries.failedAt)
      .limit(input?.limit ?? 100);
    return rows;
  } finally {
    await sql.end();
  }
}

/** Delivery rows for one outbox entry. Server-only; used by ops and by tests. */
export async function deliveriesForOutboxEntry(
  outboxEntryId: string,
): Promise<readonly (typeof notificationDeliveries.$inferSelect)[]> {
  const { sql, db } = createDatabaseClient();
  try {
    return await db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.outboxEntryId, outboxEntryId));
  } finally {
    await sql.end();
  }
}
