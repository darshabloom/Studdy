import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { notificationDeliveries, outboxEntries } from '../schema/index';
import {
  claimNotificationWork,
  exhaustedDeliveries,
  MAX_DELIVERY_ATTEMPTS,
  recordDeliveryFailed,
  recordDeliverySent,
  settleOutboxEntries,
  type NotificationWorkItem,
} from '../repositories/notifications';

/**
 * Transactional notification delivery, against a real database.
 *
 * NO RESEND ACCOUNT AND NO NETWORK. The repository knows nothing about a
 * provider — `@studdy/database` depends on no integration package — so every
 * guarantee that matters is testable here: who is resolved as the recipient,
 * that one recipient's failure does not settle the other's, that a retry does
 * not resend, and that a poison entry cannot starve the batch.
 *
 * THE FIXTURE BUILDS THE REAL STATE. A selected request with a real acceptance,
 * a real reservation and a real payment — the same shape the payment slices
 * produce — because a resolver tested against invented rows proves only that
 * the invention was self-consistent.
 */

async function databaseAvailable(): Promise<boolean> {
  try {
    const { sql } = createDatabaseClient();
    await sql`select 1`;
    await sql.end();
    return true;
  } catch {
    return false;
  }
}

const available = await databaseAvailable();

const OPS = 'ops@studdy.test';

describe.skipIf(!available)('notification delivery (integration)', () => {
  /**
   * THE QUEUE MUST BE QUIET BEFORE THIS SUITE CLAIMS ANYTHING.
   *
   * `pnpm db:seed` creates two fanned-out lesson requests, so the outbox
   * already holds several `tutor_request.sent` entries before a single test
   * runs — and every earlier integration file adds more. All of them are now
   * DELIVERABLE, all are older than anything a test emits, and the claim takes
   * a bounded batch in no particular order. A test would then assert on a
   * batch that never contained its own entry.
   *
   * That is not a test-only problem, which is why the fix is the real one:
   * superseding what is already pending is exactly the operational step PD-021
   * prescribes before the drain is switched on in any environment with
   * history. The suite does to its database what an operator does to theirs.
   */
  beforeAll(async () => {
    const { sql } = createDatabaseClient();
    try {
      await sql`
        update audit.outbox_entries
        set status_code = 'superseded', processed_at = now(), updated_at = now()
        where status_code = 'pending'`;
    } finally {
      await sql.end();
    }
  });

  const createdIlrIds: string[] = [];
  const createdOutboxIds: string[] = [];

  /*
   * A DISTINCT DAY PER FIXTURE. Every fixture takes a real reservation on the
   * same tutor and the GiST exclusion constraint refuses overlaps, so a counter
   * keeps them apart by construction. Randomising is a birthday problem that
   * fails intermittently and reads as a product bug.
   */
  let dayCursor = 3000;

  afterEach(async () => {
    const { sql } = createDatabaseClient();
    try {
      if (createdOutboxIds.length > 0) {
        await sql`
          delete from communications.notification_deliveries
          where outbox_entry_id = any(${createdOutboxIds}::uuid[])`;
        await sql`delete from audit.outbox_entries where id = any(${createdOutboxIds}::uuid[])`;
        createdOutboxIds.length = 0;
      }
      if (createdIlrIds.length > 0) {
        const ilrs = createdIlrIds;
        await sql`
          delete from communications.notification_deliveries where outbox_entry_id in (
            select id from audit.outbox_entries
            where payload->>'intendedLessonRequestId' = any(${ilrs}))`;
        await sql`
          delete from payments.tutor_transfers where payment_id in (
            select id from payments.payments where intended_lesson_request_id = any(${ilrs}::uuid[]))`;
        await sql`
          delete from payments.payments where intended_lesson_request_id = any(${ilrs}::uuid[])`;
        await sql`
          delete from availability.tutor_time_reservations where tutor_request_id in (
            select id from bookings.tutor_requests where intended_lesson_request_id = any(${ilrs}::uuid[]))`;
        await sql`
          update bookings.tutor_requests
          set accepted_time_option_id = null, acceptance_hold_expires_at = null,
              hold_rule_version = null
          where intended_lesson_request_id = any(${ilrs}::uuid[])`;
        await sql`
          delete from bookings.tutor_request_time_options where tutor_request_id in (
            select id from bookings.tutor_requests where intended_lesson_request_id = any(${ilrs}::uuid[]))`;
        await sql`
          delete from bookings.request_time_options
          where intended_lesson_request_id = any(${ilrs}::uuid[])`;
        await sql`
          delete from bookings.tutor_requests
          where intended_lesson_request_id = any(${ilrs}::uuid[])`;
        await sql`delete from bookings.intended_lesson_requests where id = any(${ilrs}::uuid[])`;
        createdIlrIds.length = 0;
      }
    } finally {
      await sql.end();
    }
  });

  interface Fixture {
    readonly ilrId: string;
    readonly ilrReference: string;
    readonly tutorRequestId: string;
    readonly paymentId: string;
    readonly parentEmail: string;
    readonly tutorEmail: string;
    readonly parentUserId: string;
    readonly tutorUserId: string;
    readonly studentName: string;
    readonly tutorName: string;
  }

  /** A selected, priced request with a live payment — the real shape. */
  const selectedRequest = async (): Promise<Fixture> => {
    const { sql } = createDatabaseClient();
    try {
      const suffix = randomUUID().slice(0, 8);
      dayCursor += 3;
      const daysOut = dayCursor;

      const [version] = await sql`
        select sv.id as service_version_id, sv.price_amount_minor, sv.currency_code,
               s.tutor_profile_id, tp.user_id as tutor_user_id, tp.public_first_name
        from services.service_versions sv
        join services.services s on s.id = sv.service_id
        join tutors.tutor_profiles tp on tp.id = s.tutor_profile_id
        where sv.status_code = 'current' limit 1`;
      const [section] = await sql`
        select sss.id as section_id, sp.preferred_name, sp.default_family_account_id
        from students.student_subject_sections sss
        join students.student_profiles sp on sp.id = sss.student_profile_id
        limit 1`;
      // A payer who has a resolvable sign-in address, which is where Studdy's
      // only email address actually lives.
      const [payer] = await sql`
        select u.id, l.authentication_email
        from identity.users u
        join identity.auth_identity_links l on l.user_id = u.id
        where l.authentication_email is not null limit 1`;
      const [tutorLink] = await sql`
        select l.authentication_email from identity.auth_identity_links l
        where l.user_id = ${version!['tutor_user_id'] as string}`;

      const [ilr] = await sql`
        insert into bookings.intended_lesson_requests
          (student_subject_section_id, requested_by_user_id, family_account_id,
           duration_minutes, format_code, time_zone, status_code, reference,
           decision_deadline_at, deadline_rule_version)
        values (${section!['section_id'] as string}, ${payer!['id'] as string},
                ${section!['default_family_account_id'] as string | null},
                60, 'online', 'Pacific/Auckland', 'awaiting_payment', ${'LR-NOTIF-' + suffix},
                now() + interval '4 hours', 1)
        returning id, reference`;
      const ilrId = ilr!['id'] as string;
      createdIlrIds.push(ilrId);

      const [treq] = await sql`
        insert into bookings.tutor_requests
          (intended_lesson_request_id, tutor_profile_id, service_version_id, status_code,
           position, respond_by_at, reference, payment_deadline_at, deadline_rule_version)
        values (${ilrId}, ${version!['tutor_profile_id'] as string},
                ${version!['service_version_id'] as string},
                'selected', 1, now() + interval '2 hours', ${'TREQ-NOTIF-' + suffix},
                now() + interval '45 minutes', 1)
        returning id`;
      const tutorRequestId = treq!['id'] as string;

      const [familyOption] = await sql`
        insert into bookings.request_time_options
          (intended_lesson_request_id, position, starts_at, ends_at,
           local_date, local_start_time, iana_time_zone, status_code)
        values (${ilrId}, 1,
                now() + (${daysOut} * interval '1 day'),
                now() + (${daysOut} * interval '1 day') + interval '60 minutes',
                (now() + (${daysOut} * interval '1 day'))::date, '16:00',
                'Pacific/Auckland', 'taken')
        returning id`;
      const [tutorOption] = await sql`
        insert into bookings.tutor_request_time_options
          (tutor_request_id, request_time_option_id, starts_at, ends_at, status_code, claimed_at)
        values (${tutorRequestId}, ${familyOption!['id'] as string},
                now() + (${daysOut} * interval '1 day'),
                now() + (${daysOut} * interval '1 day') + interval '60 minutes',
                'claimed', now())
        returning id`;
      await sql`
        update bookings.tutor_requests
        set accepted_time_option_id = ${tutorOption!['id'] as string},
            acceptance_hold_expires_at = now() + interval '45 minutes',
            hold_rule_version = 1
        where id = ${tutorRequestId}`;

      const [payment] = await sql`
        insert into payments.payments
          (intended_lesson_request_id, tutor_request_id, service_version_id,
           payer_user_id, tutor_profile_id, currency_code,
           lesson_amount_minor, platform_fee_rate_bps, platform_fee_rule_version,
           platform_fee_amount_minor, tutor_entitlement_minor,
           processing_fee_payer_code, processing_fee_rule_version,
           processing_fee_charged_minor, total_charged_minor, status_code,
           payment_deadline_at)
        values (${ilrId}, ${tutorRequestId}, ${version!['service_version_id'] as string},
                ${payer!['id'] as string}, ${version!['tutor_profile_id'] as string}, 'NZD',
                4000, 1000, 1, 400, 3600, 'platform', 1, 0, 4000, 'requires_payment',
                now() + interval '45 minutes')
        returning id`;

      return {
        ilrId,
        ilrReference: ilr!['reference'] as string,
        tutorRequestId,
        paymentId: payment!['id'] as string,
        parentEmail: payer!['authentication_email'] as string,
        tutorEmail: tutorLink!['authentication_email'] as string,
        parentUserId: payer!['id'] as string,
        tutorUserId: version!['tutor_user_id'] as string,
        studentName: section!['preferred_name'] as string,
        tutorName: version!['public_first_name'] as string,
      };
    } finally {
      await sql.end();
    }
  };

  /** Write an outbox entry of the shape the real repositories write. */
  const emit = async (
    eventType: string,
    payload: Record<string, unknown>,
    key?: string,
  ): Promise<string> => {
    const { sql } = createDatabaseClient();
    try {
      const [row] = await sql`
        insert into audit.outbox_entries (event_type, payload, idempotency_key, correlation_id)
        values (${eventType}, ${JSON.stringify(payload)}::jsonb,
                ${key ?? `${eventType}:${randomUUID()}`}, ${randomUUID()})
        returning id`;
      const id = row!['id'] as string;
      createdOutboxIds.push(id);
      return id;
    } finally {
      await sql.end();
    }
  };

  const claim = async (): Promise<readonly NotificationWorkItem[]> => {
    const { work } = await claimNotificationWork({ opsEmailAddress: OPS, limit: 50 });
    return work;
  };

  const deliveriesFor = async (
    outboxEntryId: string,
  ): Promise<(typeof notificationDeliveries.$inferSelect)[]> => {
    const { sql, db } = createDatabaseClient();
    try {
      return await db
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.outboxEntryId, outboxEntryId));
    } finally {
      await sql.end();
    }
  };

  const outboxStatus = async (id: string): Promise<string> => {
    const { sql, db } = createDatabaseClient();
    try {
      const [row] = await db
        .select({ statusCode: outboxEntries.statusCode })
        .from(outboxEntries)
        .where(eq(outboxEntries.id, id));
      return row!.statusCode;
    } finally {
      await sql.end();
    }
  };

  // -------------------------------------------------------------------------

  describe('payment.required resolves the family who made the request', () => {
    it('addresses the parent and carries the payment facts', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
        paymentDeadlineAt: new Date().toISOString(),
      });

      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);

      expect(work).toHaveLength(1);
      const item = work[0]!;
      expect(item.recipientRole).toBe('family');
      expect(item.templateCode).toBe('payment_required_family');
      // Resolved server-side from the request's own requester.
      expect(item.toAddress).toBe(fixture.parentEmail);

      // The facts a template may render, and the payment URL's segment.
      expect(item.context.requestReference).toBe(fixture.ilrReference);
      expect(item.context.tutorFirstName).toBe(fixture.tutorName);
      expect(item.context.studentFirstName).toBe(fixture.studentName);
      expect(item.context.amountMinor).toBe(4000n);
      expect(item.context.currencyCode).toBe('NZD');
      expect(item.context.durationMinutes).toBe(60);
      expect(item.context.formatCode).toBe('online');
      expect(item.context.paymentDeadlineAt).not.toBeNull();
      expect(item.context.lessonStartAt).not.toBeNull();
    });

    /** The tutor is not a recipient of a payment request. */
    it('creates no tutor delivery', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
      });
      await claim();

      const rows = await deliveriesFor(entryId);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.recipientRoleCode).toBe('family');
    });
  });

  describe('booking.confirmed produces one delivery per recipient', () => {
    it('addresses both the family and the tutor, independently', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('booking.confirmed', {
        intendedLessonRequestId: fixture.ilrId,
        tutorRequestId: fixture.tutorRequestId,
      });

      await claim();
      const rows = (await deliveriesFor(entryId)).sort((a, b) =>
        a.recipientRoleCode.localeCompare(b.recipientRoleCode),
      );

      expect(rows).toHaveLength(2);
      const [family, tutor] = rows;
      expect(family!.recipientRoleCode).toBe('family');
      expect(family!.toAddress).toBe(fixture.parentEmail);
      expect(family!.recipientUserId).toBe(fixture.parentUserId);
      expect(family!.templateCode).toBe('booking_confirmed_family');

      expect(tutor!.recipientRoleCode).toBe('tutor');
      expect(tutor!.toAddress).toBe(fixture.tutorEmail);
      expect(tutor!.recipientUserId).toBe(fixture.tutorUserId);
      expect(tutor!.templateCode).toBe('booking_confirmed_tutor');

      // Separate idempotency keys, which is what lets them fail apart.
      expect(family!.idempotencyKey).not.toBe(tutor!.idempotencyKey);
    });

    /**
     * THE INVARIANT THE SCHEMA CHANGE EXISTS FOR. One recipient succeeding must
     * NOT settle the logical event, or the other is never told.
     */
    it('does not settle the entry when only one recipient succeeded', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('booking.confirmed', {
        intendedLessonRequestId: fixture.ilrId,
        tutorRequestId: fixture.tutorRequestId,
      });
      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);

      const family = work.find((item) => item.recipientRole === 'family')!;
      const tutor = work.find((item) => item.recipientRole === 'tutor')!;

      await recordDeliverySent({
        deliveryId: family.deliveryId,
        provider: 'local',
        providerMessageId: `msg_${randomUUID()}`,
      });
      await recordDeliveryFailed({ deliveryId: tutor.deliveryId, errorCode: 'provider_down' });

      await settleOutboxEntries({ outboxEntryIds: [entryId] });

      // STILL PENDING: the tutor has not been told.
      expect(await outboxStatus(entryId)).toBe('pending');

      const rows = await deliveriesFor(entryId);
      expect(rows.find((r) => r.recipientRoleCode === 'family')!.statusCode).toBe('sent');
      expect(rows.find((r) => r.recipientRoleCode === 'tutor')!.statusCode).toBe('failed');
    });

    it('settles the entry once every recipient has been sent', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('booking.confirmed', {
        intendedLessonRequestId: fixture.ilrId,
        tutorRequestId: fixture.tutorRequestId,
      });
      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      for (const item of work) {
        await recordDeliverySent({
          deliveryId: item.deliveryId,
          provider: 'local',
          providerMessageId: `msg_${randomUUID()}`,
        });
      }

      await settleOutboxEntries({ outboxEntryIds: [entryId] });
      expect(await outboxStatus(entryId)).toBe('sent');
    });

    /**
     * A RETRY RESENDS ONLY WHAT IS STILL OWED. The family's message went; the
     * next drain must offer the tutor's and nothing else.
     */
    it('offers only the outstanding recipient on the next drain', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('booking.confirmed', {
        intendedLessonRequestId: fixture.ilrId,
        tutorRequestId: fixture.tutorRequestId,
      });
      const first = (await claim()).filter((item) => item.outboxEntryId === entryId);
      const family = first.find((item) => item.recipientRole === 'family')!;
      await recordDeliverySent({
        deliveryId: family.deliveryId,
        provider: 'local',
        providerMessageId: `msg_${randomUUID()}`,
      });

      const second = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(second).toHaveLength(1);
      expect(second[0]!.recipientRole).toBe('tutor');
    });
  });

  describe('planning is idempotent', () => {
    /** The unique (entry, role) index, not a flag the worker remembers. */
    it('creates no second delivery row when the same entry is claimed twice', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('booking.confirmed', {
        intendedLessonRequestId: fixture.ilrId,
        tutorRequestId: fixture.tutorRequestId,
      });

      await claim();
      await claim();
      await claim();

      expect(await deliveriesFor(entryId)).toHaveLength(2);
    });

    it('refuses a duplicate delivery row even from a direct insert', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
      });
      await claim();

      const { sql, db } = createDatabaseClient();
      try {
        await expect(
          db.insert(notificationDeliveries).values({
            outboxEntryId: entryId,
            eventType: 'payment.required',
            recipientRoleCode: 'family',
            toAddress: 'someone.else@example.test',
            templateCode: 'payment_required_family',
            idempotencyKey: `different-key-${randomUUID()}`,
          }),
        ).rejects.toThrow();
      } finally {
        await sql.end();
      }
    });

    /** A duplicated acknowledgement must not double-count or resend. */
    it('treats a repeated sent acknowledgement as a no-op', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
      });
      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      const messageId = `msg_${randomUUID()}`;

      await recordDeliverySent({
        deliveryId: work[0]!.deliveryId,
        provider: 'local',
        providerMessageId: messageId,
      });
      // A second acknowledgement for an already-sent row changes nothing.
      await recordDeliverySent({
        deliveryId: work[0]!.deliveryId,
        provider: 'local',
        providerMessageId: `msg_${randomUUID()}`,
      });

      const rows = await deliveriesFor(entryId);
      expect(rows[0]!.statusCode).toBe('sent');
      expect(rows[0]!.providerMessageId).toBe(messageId);
      expect(rows[0]!.attempts).toBe(1);
    });

    /** And a sent delivery is never offered as work again. */
    it('never offers an already-sent delivery on a later drain', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
      });
      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      await recordDeliverySent({
        deliveryId: work[0]!.deliveryId,
        provider: 'local',
        providerMessageId: `msg_${randomUUID()}`,
      });

      const again = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(again).toHaveLength(0);
    });
  });

  describe('provider failures stay retryable', () => {
    it('re-offers a failed delivery on the next drain', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
      });
      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      await recordDeliveryFailed({ deliveryId: work[0]!.deliveryId, errorCode: 'rate_limited' });

      const again = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(again).toHaveLength(1);
      expect(again[0]!.attempts).toBe(1);

      // And it can still succeed afterwards.
      await recordDeliverySent({
        deliveryId: again[0]!.deliveryId,
        provider: 'local',
        providerMessageId: `msg_${randomUUID()}`,
      });
      const rows = await deliveriesFor(entryId);
      expect(rows[0]!.statusCode).toBe('sent');
      expect(rows[0]!.lastErrorCode).toBeNull();
    });

    /** The error is a code, never a provider body or a stack. */
    it('stores a short error code only', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
      });
      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      await recordDeliveryFailed({
        deliveryId: work[0]!.deliveryId,
        errorCode: 'x'.repeat(500),
      });
      const rows = await deliveriesFor(entryId);
      expect(rows[0]!.lastErrorCode!.length).toBeLessThanOrEqual(120);
    });
  });

  describe('one poison event does not block the others', () => {
    /**
     * An entry whose records have gone can never resolve. It is backed off and
     * left for a human — not retried forever, and not allowed to occupy a slot
     * in every future batch while healthy events wait behind it.
     */
    it('backs off an unresolvable entry and still delivers the healthy ones', async () => {
      const poison = await emit('payment.required', { tutorRequestId: randomUUID() });
      const fixture = await selectedRequest();
      const healthy = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
      });

      const { outcome, work } = await claimNotificationWork({
        opsEmailAddress: OPS,
        limit: 50,
      });

      expect(outcome.entriesUnresolvable).toBeGreaterThanOrEqual(1);
      expect(work.some((item) => item.outboxEntryId === healthy)).toBe(true);
      expect(work.some((item) => item.outboxEntryId === poison)).toBe(false);
      expect(await deliveriesFor(poison)).toHaveLength(0);

      // Backed off, so the next drain does not spin on it.
      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db
          .select({ attempts: outboxEntries.attempts, nextAttemptAt: outboxEntries.nextAttemptAt })
          .from(outboxEntries)
          .where(eq(outboxEntries.id, poison));
        expect(row!.attempts).toBeGreaterThan(0);
        expect(row!.nextAttemptAt).not.toBeNull();
      } finally {
        await sql.end();
      }
    });

    /** A malformed payload is unresolvable rather than a crash. */
    it('survives an entry whose payload has no usable id', async () => {
      const entryId = await emit('booking.confirmed', { nothing: 'useful' });
      const { outcome } = await claimNotificationWork({ opsEmailAddress: OPS, limit: 50 });
      expect(outcome.entriesUnresolvable).toBeGreaterThanOrEqual(1);
      expect(await deliveriesFor(entryId)).toHaveLength(0);
    });
  });

  describe('payment.refund_required is an operations alert', () => {
    it('goes to the configured ops address and to nobody else', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.refund_required', {
        paymentId: fixture.paymentId,
        reason: 'The reservation was already released.',
      });

      await claim();
      const rows = await deliveriesFor(entryId);

      expect(rows).toHaveLength(1);
      expect(rows[0]!.recipientRoleCode).toBe('ops');
      expect(rows[0]!.toAddress).toBe(OPS);
      // No Studdy user: ops is a mailbox, not a person with an account.
      expect(rows[0]!.recipientUserId).toBeNull();
      // And explicitly not the family or the tutor.
      expect(rows[0]!.toAddress).not.toBe(fixture.parentEmail);
      expect(rows[0]!.toAddress).not.toBe(fixture.tutorEmail);
    });

    it('carries the references support needs and no provider identifier', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.refund_required', {
        paymentId: fixture.paymentId,
        reason: 'The request was no longer awaiting payment.',
      });
      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);

      const context = work[0]!.context;
      expect(context.paymentReference).toMatch(/^PAY-/);
      expect(context.requestReference).toBe(fixture.ilrReference);
      expect(context.amountMinor).toBe(4000n);
      expect(context.reason).toBe('The request was no longer awaiting payment.');
      // The context shape simply has no provider fields to leak.
      expect(Object.keys(context)).not.toContain('providerPaymentIntentId');
    });
  });

  describe('privacy boundaries', () => {
    /**
     * A notification for one family can never be addressed to another, because
     * the address is resolved from the REQUEST's own requester rather than from
     * anything in the payload.
     */
    it('addresses the family from the request that owns the event', async () => {
      const a = await selectedRequest();
      const b = await selectedRequest();
      const entryA = await emit('payment.required', { tutorRequestId: a.tutorRequestId });
      const entryB = await emit('payment.required', { tutorRequestId: b.tutorRequestId });

      await claim();
      const rowsA = await deliveriesFor(entryA);
      const rowsB = await deliveriesFor(entryB);

      expect(rowsA[0]!.recipientUserId).toBe(a.parentUserId);
      expect(rowsB[0]!.recipientUserId).toBe(b.parentUserId);
    });

    /** Never the ops mailbox for a customer event. */
    it('never sends a customer event to operations', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('booking.confirmed', {
        intendedLessonRequestId: fixture.ilrId,
        tutorRequestId: fixture.tutorRequestId,
      });
      await claim();
      for (const row of await deliveriesFor(entryId)) {
        expect(row.toAddress).not.toBe(OPS);
        expect(row.recipientRoleCode).not.toBe('ops');
      }
    });

    /**
     * THE DEVELOPMENT GUARD. Outside production every message goes to one
     * allowlisted mailbox, so a staging database full of real addresses cannot
     * email real people.
     */
    it('redirects every recipient when a development address is configured', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('booking.confirmed', {
        intendedLessonRequestId: fixture.ilrId,
        tutorRequestId: fixture.tutorRequestId,
      });

      await claimNotificationWork({
        opsEmailAddress: OPS,
        redirectAllTo: 'developer@studdy.test',
        limit: 50,
      });

      const rows = await deliveriesFor(entryId);
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.toAddress).toBe('developer@studdy.test');
      }
      // The intended person stays recoverable.
      expect(rows.map((r) => r.recipientUserId).sort()).toEqual(
        [fixture.parentUserId, fixture.tutorUserId].sort(),
      );
    });
  });

  describe('event types outside this slice are left alone', () => {
    /**
     * The outbox carries a type this slice does not deliver. It must stay
     * `pending` and untouched — nothing is wrong with it, and it must still be
     * there if a later slice decides somebody is owed it.
     *
     * `tutor_request.declined` is now the ONLY such type: the request
     * lifecycle became deliverable with the tutor-notification slice, so the
     * two types this test used to name are no longer examples of anything.
     * A single decline is deliberately never emailed (matrix row 4).
     */
    it('never plans a delivery for an undeliverable event type', async () => {
      const untouched = await emit('tutor_request.declined', {
        tutorRequestReference: `TREQ-${randomUUID().slice(0, 8)}`,
      });
      const closed = await emit('tutor_request.declined', {
        tutorRequestReference: `TREQ-${randomUUID().slice(0, 8)}`,
      });

      await claim();

      expect(await deliveriesFor(untouched)).toHaveLength(0);
      expect(await deliveriesFor(closed)).toHaveLength(0);
      expect(await outboxStatus(untouched)).toBe('pending');
      expect(await outboxStatus(closed)).toBe('pending');

      // And not backed off either: they are not failures.
      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ attempts: outboxEntries.attempts })
          .from(outboxEntries)
          .where(inArray(outboxEntries.id, [untouched, closed]));
        for (const row of rows) expect(row.attempts).toBe(0);
      } finally {
        await sql.end();
      }
    });
  });

  describe('the outbox itself is unchanged', () => {
    /** No producer had to change; the entries are exactly as they were written. */
    it('keeps the entry payload and idempotency key untouched', async () => {
      const fixture = await selectedRequest();
      const key = `payment.required:${fixture.tutorRequestId}`;
      const entryId = await emit(
        'payment.required',
        { tutorRequestId: fixture.tutorRequestId, paymentDeadlineAt: '2026-09-01T08:00:00.000Z' },
        key,
      );
      await claim();

      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db.select().from(outboxEntries).where(eq(outboxEntries.id, entryId));
        expect(row!.idempotencyKey).toBe(key);
        expect((row!.payload as Record<string, unknown>)['tutorRequestId']).toBe(
          fixture.tutorRequestId,
        );
        // No PII was added to the outbox to make delivery convenient.
        const payloadKeys = Object.keys(row!.payload as Record<string, unknown>);
        expect(payloadKeys).not.toContain('email');
        expect(payloadKeys).not.toContain('toAddress');
        expect(payloadKeys).not.toContain('recipient');
      } finally {
        await sql.end();
      }
    });
  });

  describe('giving up, and saying so', () => {
    /** Spend a delivery's attempts without going near a provider. */
    const spendAttempts = async (deliveryId: string, attempts: number): Promise<void> => {
      const { sql, db } = createDatabaseClient();
      try {
        await db
          .update(notificationDeliveries)
          .set({ attempts, statusCode: 'failed', lastErrorCode: 'test_forced' })
          .where(eq(notificationDeliveries.id, deliveryId));
      } finally {
        await sql.end();
      }
    };

    /**
     * THE POINT OF A CEILING. Before this, a delivery that could never succeed
     * was handed back every sixty seconds for ever — roughly 43,000 provider
     * calls a month for one dead address, with every real failure buried in
     * among them.
     */
    it('stops handing back a delivery once its attempts are spent', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
        paymentDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

      const first = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(first).toHaveLength(1);

      await spendAttempts(first[0]!.deliveryId, MAX_DELIVERY_ATTEMPTS);

      const second = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(second).toHaveLength(0);
    });

    /** One attempt short of the ceiling is still owed, and still tried. */
    it('keeps trying right up to the last attempt', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
        paymentDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

      const first = (await claim()).filter((item) => item.outboxEntryId === entryId);
      await spendAttempts(first[0]!.deliveryId, MAX_DELIVERY_ATTEMPTS - 1);

      const second = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(second).toHaveLength(1);
    });

    /**
     * REPORTED, NOT MERELY SKIPPED. A silent skip makes giving up look exactly
     * like having nothing to do, which is the failure mode this count exists
     * to prevent.
     */
    it('counts what it gave up on', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
        paymentDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

      const first = (await claim()).filter((item) => item.outboxEntryId === entryId);
      await spendAttempts(first[0]!.deliveryId, MAX_DELIVERY_ATTEMPTS);

      const { outcome } = await claimNotificationWork({ opsEmailAddress: OPS, limit: 50 });
      expect(outcome.deliveriesExhausted).toBeGreaterThanOrEqual(1);
    });

    /**
     * Actionable for an operator, and still not a way to list addresses: the
     * projection carries the role, the template and the error code, and no
     * `to_address` at all.
     */
    it('lists exhausted deliveries for operations, without any address', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
        paymentDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

      const first = (await claim()).filter((item) => item.outboxEntryId === entryId);
      const deliveryId = first[0]!.deliveryId;
      await spendAttempts(deliveryId, MAX_DELIVERY_ATTEMPTS);

      const listed = await exhaustedDeliveries({ limit: 100 });
      const mine = listed.find((row) => row.deliveryId === deliveryId);
      expect(mine).toBeDefined();
      expect(mine!.recipientRole).toBe('family');
      expect(mine!.lastErrorCode).toBe('test_forced');
      expect(Object.keys(mine!)).not.toContain('toAddress');
    });

    /**
     * A FLAT MINUTE AGAINST A ONE-MINUTE CRON IS NOT A BACKOFF. Each further
     * settlement of an entry that is still owed must push the next attempt
     * further out, on the same curve the unresolvable path already used.
     */
    it('backs an entry off further each time it is still owed', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('payment.required', {
        tutorRequestId: fixture.tutorRequestId,
        paymentDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
      await claim();

      const nextAttempt = async (): Promise<Date> => {
        const { sql, db } = createDatabaseClient();
        try {
          const [row] = await db
            .select({ at: outboxEntries.nextAttemptAt })
            .from(outboxEntries)
            .where(eq(outboxEntries.id, entryId));
          return row!.at!;
        } finally {
          await sql.end();
        }
      };

      await settleOutboxEntries({ outboxEntryIds: [entryId] });
      const first = await nextAttempt();
      await settleOutboxEntries({ outboxEntryIds: [entryId] });
      const second = await nextAttempt();

      // Strictly beyond the one-minute cadence, and growing.
      expect(first.getTime()).toBeGreaterThan(Date.now() + 60_000);
      expect(second.getTime()).toBeGreaterThan(first.getTime());
    });
  });

  describe('the request lifecycle', () => {
    /**
     * THE EMAIL THE PRODUCT WAS MISSING, resolved end to end: the event names a
     * tutor request by REFERENCE rather than id, and the recipient must come
     * out as the tutor, not the family.
     */
    it('resolves a new request to the tutor, by reference', async () => {
      const fixture = await selectedRequest();
      const { sql } = createDatabaseClient();
      let reference: string;
      try {
        const [row] = await sql`
          select reference from bookings.tutor_requests where id = ${fixture.tutorRequestId}`;
        reference = row!['reference'] as string;
      } finally {
        await sql.end();
      }

      const entryId = await emit('tutor_request.sent', {
        tutorRequestReference: reference,
        respondByAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(work).toHaveLength(1);
      expect(work[0]!.recipientRole).toBe('tutor');
      expect(work[0]!.toAddress).toBe(fixture.tutorEmail);
      expect(work[0]!.templateCode).toBe('tutor_request_sent_tutor');
      // Their own reference, never the family's.
      expect(work[0]!.context.tutorRequestReference).toBe(reference);
    });

    /** An acceptance is the family's news, and carries the family's link. */
    it('resolves an acceptance to the family', async () => {
      const fixture = await selectedRequest();
      const { sql } = createDatabaseClient();
      let reference: string;
      try {
        const [row] = await sql`
          select reference from bookings.tutor_requests where id = ${fixture.tutorRequestId}`;
        reference = row!['reference'] as string;
      } finally {
        await sql.end();
      }

      const entryId = await emit('tutor_request.accepted', {
        tutorRequestReference: reference,
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(work).toHaveLength(1);
      expect(work[0]!.recipientRole).toBe('family');
      expect(work[0]!.toAddress).toBe(fixture.parentEmail);
      expect(work[0]!.templateCode).toBe('tutor_request_accepted_family');
    });

    /**
     * ROW 5. The fixture's tutor accepted, so a reservation exists and the
     * closure genuinely releases something.
     */
    /**
     * THE FIXTURE DOES NOT HOLD TIME, whatever its comment says — it builds an
     * ILR, a tutor request and a payment, and never inserts a reservation. So
     * the held time is created here, explicitly, because that is the precise
     * condition row 5 turns on and a test of it should not depend on a
     * side effect of somebody else's fixture.
     */
    const giveHeldTime = async (tutorRequestId: string, dayOffset: number): Promise<void> => {
      const { sql } = createDatabaseClient();
      try {
        const startAt = new Date(Date.now() + dayOffset * 86_400_000);
        const endAt = new Date(startAt.getTime() + 3_600_000);
        await sql`
          insert into availability.tutor_time_reservations
            (tutor_profile_id, tutor_request_id, start_at, end_at, gap_minutes,
             effective_end_at, status_code, reservation_type_code)
          select tr.tutor_profile_id, tr.id, ${startAt}, ${endAt}, 0, ${endAt},
                 'released', 'request_hold'
          from bookings.tutor_requests tr
          where tr.id = ${tutorRequestId}::uuid`;
      } finally {
        await sql.end();
      }
    };

    it('emails a closure to a tutor who had time held', async () => {
      const fixture = await selectedRequest();
      // Released, because the closure has already let it go — the point is
      // that a hold EXISTED, not that it still does.
      await giveHeldTime(fixture.tutorRequestId, 400);

      const entryId = await emit('tutor_request.closed', {
        tutorRequestId: fixture.tutorRequestId,
      });

      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(work).toHaveLength(1);
      expect(work[0]!.recipientRole).toBe('tutor');
      expect(work[0]!.templateCode).toBe('tutor_request_closed_tutor');
    });

    /**
     * ROW 5, THE OTHER HALF. A tutor who never accepted has nothing released,
     * so the entry owes nobody anything — and must CLOSE rather than sit
     * pending being reconsidered on every drain for ever.
     */
    it('owes nothing for a closure where no time was ever held', async () => {
      // No `giveHeldTime` call: this tutor never accepted, so no reservation
      // exists and the closure releases nothing.
      const fixture = await selectedRequest();

      const entryId = await emit('tutor_request.closed', {
        tutorRequestId: fixture.tutorRequestId,
      });

      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(work).toHaveLength(0);
      expect(await deliveriesFor(entryId)).toHaveLength(0);
      // Closed by decision, not left pending.
      expect(await outboxStatus(entryId)).toBe('superseded');
    });

    /**
     * ONE EVENT, BOTH ENDINGS. The close reason reaches the context so the
     * template can tell a family "everybody declined" from "time ran out".
     */
    it('carries the close reason to the family', async () => {
      const fixture = await selectedRequest();
      const { sql } = createDatabaseClient();
      try {
        await sql`
          update bookings.intended_lesson_requests
          set status_code = 'closed', close_reason_code = 'all_tutors_declined'
          where id = ${fixture.ilrId}`;
      } finally {
        await sql.end();
      }

      const entryId = await emit('intended_lesson_request.expired', {
        intendedLessonRequestId: fixture.ilrId,
      });

      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(work).toHaveLength(1);
      expect(work[0]!.recipientRole).toBe('family');
      expect(work[0]!.toAddress).toBe(fixture.parentEmail);
      expect(work[0]!.context.closeReasonCode).toBe('all_tutors_declined');
    });

    /** An individual decline is still nobody's news. */
    it('never plans a delivery for an individual decline', async () => {
      const fixture = await selectedRequest();
      const entryId = await emit('tutor_request.declined', {
        tutorRequestReference: fixture.ilrReference,
      });

      const work = (await claim()).filter((item) => item.outboxEntryId === entryId);
      expect(work).toHaveLength(0);
      // Left pending and untouched — not failed, not superseded.
      expect(await outboxStatus(entryId)).toBe('pending');
    });
  });
});
