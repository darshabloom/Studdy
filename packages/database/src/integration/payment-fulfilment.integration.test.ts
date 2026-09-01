import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import {
  intendedLessonRequests,
  paymentEvents,
  payments,
  tutorTimeReservations,
  tutorTransfers,
} from '../schema/index';
import {
  applyPaymentProviderEvent,
  type AuthoritativeIntent,
  type FulfilmentOutcome,
} from '../repositories/payment-fulfilment';
import { expireOverdueRequests } from '../repositories/lesson-requests';
import { TUTOR_REQUEST_STATUSES } from '@studdy/domain/bookings';

/**
 * FULFILMENT — a successful payment becoming a booking, and refusing to become
 * anything else.
 *
 * NO STRIPE KEY IS NEEDED, and that is the point of the boundary slice 5 drew:
 * `@studdy/database` knows nothing about Stripe, so every guard, every amount
 * and every race in the authoritative transition is exercised here against a
 * real Postgres with no network and no provider account.
 *
 * WHAT IS ASSERTED IS WHAT MONEY DEPENDS ON: that four records move together or
 * not at all, that a mismatch confirms nothing, that duplicate and out-of-order
 * delivery are harmless, that two workers racing produce ONE booking and ONE
 * obligation, and that the expiry sweep cannot take away what was paid for.
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

describe.skipIf(!available)('payment fulfilment (integration)', () => {
  const createdIlrIds: string[] = [];
  const madePayable: string[] = [];
  const createdEventIds: string[] = [];

  /*
   * A DISTINCT DAY PER FIXTURE, counted rather than randomised.
   *
   * Every fixture takes a real reservation on the SAME tutor, and the GiST
   * exclusion constraint refuses two active holds that overlap. A random offset
   * across a wide range still collides surprisingly often — with this many
   * fixtures it is a birthday problem, not a long shot — and the failure lands
   * on whichever test drew the duplicate, which reads as a flaky product bug
   * rather than a fixture that booked the same afternoon twice.
   *
   * A counter makes the interval unique by construction. The base is far enough
   * out that nothing else in the shared database is holding those days.
   */
  let dayCursor = 500;

  /*
   * EVERY ROW THIS SUITE CREATES IS REMOVED AGAIN, and the reservations are the
   * reason it has to be thorough.
   *
   * A hold is a real GiST exclusion lock on a tutor's calendar. Leaving one
   * behind does not just leave clutter — it makes the NEXT run of this file
   * collide with the previous one, on a tutor every fixture shares. The
   * standing rule that a journey must survive being run twice applies here
   * exactly, and an earlier version of this cleanup failed it.
   *
   * Deleted in foreign-key order, and the accepted time option is detached
   * first: `tutor_request_acceptance_complete` keeps the claimed option, the
   * hold expiry and the rule version inseparable, so all three clear together
   * or the UPDATE is refused.
   */
  afterEach(async () => {
    const { sql } = createDatabaseClient();
    try {
      if (createdIlrIds.length > 0) {
        const ilrs = createdIlrIds;
        await sql`
          delete from payments.tutor_transfers where payment_id in (
            select id from payments.payments where intended_lesson_request_id = any(${ilrs}::uuid[]))`;
        await sql`
          delete from payments.payment_events where payment_id in (
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
        // Audit rows carry no foreign key, so they are removed by the ids they
        // recorded rather than by a cascade.
        await sql`delete from audit.outbox_entries where payload->>'intendedLessonRequestId' = any(${ilrs})`;
        await sql`delete from audit.domain_events where entity_id = any(${ilrs})`;
        await sql`delete from audit.audit_events where entity_id = any(${ilrs})`;
        await sql`delete from audit.status_transitions where entity_id = any(${ilrs})`;
        await sql`delete from bookings.intended_lesson_requests where id = any(${ilrs}::uuid[])`;
        createdIlrIds.length = 0;
      }
      if (createdEventIds.length > 0) {
        await sql`
          delete from payments.payment_events where provider_event_id = any(${createdEventIds})`;
        createdEventIds.length = 0;
      }
      if (madePayable.length > 0) {
        await sql`
          delete from payments.connected_accounts where tutor_profile_id = any(${madePayable}::uuid[])`;
        madePayable.length = 0;
      }
    } finally {
      await sql.end();
    }
  });

  interface Fixture {
    readonly ilrId: string;
    readonly tutorRequestId: string;
    readonly tutorProfileId: string;
    readonly paymentId: string;
    readonly providerPaymentIntentId: string;
    readonly reservationId: string;
  }

  /**
   * A request that has been selected, priced and is waiting on a webhook.
   *
   * Written directly rather than driven through the whole fan-out: this suite is
   * about THE FULFILMENT TRANSACTION, and building a booking journey here would
   * test the fixture instead. `lesson-requests.integration.test.ts` already
   * covers the journey exhaustively.
   *
   * The lesson time is far into the future and unique per fixture, because the
   * reservation takes a real GiST exclusion lock on the tutor's calendar and
   * every fixture here uses the same tutor. See `dayCursor` above.
   */
  const awaitingPayment = async (
    options: {
      readonly lessonAmountMinor?: bigint;
      readonly currencyCode?: string;
      readonly payable?: boolean;
      readonly deadlineMinutesFromNow?: number;
    } = {},
  ): Promise<Fixture> => {
    const { sql } = createDatabaseClient();
    try {
      const suffix = randomUUID().slice(0, 8);
      const lesson = options.lessonAmountMinor ?? 4000n;
      const currency = options.currencyCode ?? 'NZD';
      const fee = (lesson * 1000n) / 10000n;
      const entitlement = lesson - fee;
      const deadlineMinutes = options.deadlineMinutesFromNow ?? 45;
      // Unique per fixture, so two holds on this tutor can never overlap.
      dayCursor += 3;
      const daysOut = dayCursor;

      const [version] = await sql`
        select sv.id as service_version_id, s.tutor_profile_id
        from services.service_versions sv
        join services.services s on s.id = sv.service_id
        where sv.status_code = 'current'
        limit 1`;
      const [section] = await sql`
        select sss.id as section_id, sss.student_profile_id,
               sp.default_family_account_id as family_account_id
        from students.student_subject_sections sss
        join students.student_profiles sp on sp.id = sss.student_profile_id
        limit 1`;
      const [payer] = await sql`select id from identity.users limit 1`;

      const tutorProfileId = version!['tutor_profile_id'] as string;
      const serviceVersionId = version!['service_version_id'] as string;

      const [ilr] = await sql`
        insert into bookings.intended_lesson_requests
          (student_subject_section_id, requested_by_user_id, family_account_id,
           duration_minutes, format_code, time_zone, status_code, reference,
           decision_deadline_at, deadline_rule_version)
        values (${section!['section_id'] as string}, ${payer!['id'] as string},
                ${section!['family_account_id'] as string | null},
                60, 'online', 'Pacific/Auckland', 'awaiting_payment', ${'LR-FUL-' + suffix},
                now() + interval '4 hours', 1)
        returning id`;
      const ilrId = ilr!['id'] as string;
      createdIlrIds.push(ilrId);

      const [treq] = await sql`
        insert into bookings.tutor_requests
          (intended_lesson_request_id, tutor_profile_id, service_version_id, status_code,
           position, respond_by_at, reference, payment_deadline_at, deadline_rule_version)
        values (${ilrId}, ${tutorProfileId}, ${serviceVersionId},
                'selected', 1, now() + interval '2 hours', ${'TREQ-FUL-' + suffix},
                now() + (${deadlineMinutes} * interval '1 minute'), 1)
        returning id`;
      const tutorRequestId = treq!['id'] as string;

      /*
       * A REAL ACCEPTANCE, not a shortcut. `tutor_request_acceptance_complete`
       * makes the claimed option, the hold expiry and the hold rule version
       * inseparable, and the accepted option is a composite foreign key back to
       * this tutor's own row — so the fixture has to build the acceptance the
       * way the product does. Faking it round the constraint would also mean
       * testing fulfilment against a request shape that cannot exist.
       */
      const [familyOption] = await sql`
        insert into bookings.request_time_options
          (intended_lesson_request_id, position, starts_at, ends_at,
           local_date, local_start_time, iana_time_zone, status_code)
        values (${ilrId}, 1,
                now() + (${daysOut} * interval '1 day'),
                now() + (${daysOut} * interval '1 day') + interval '60 minutes',
                (now() + (${daysOut} * interval '1 day'))::date, '10:00',
                'Pacific/Auckland', 'taken')
        returning id`;

      const [tutorOption] = await sql`
        insert into bookings.tutor_request_time_options
          (tutor_request_id, request_time_option_id, starts_at, ends_at,
           status_code, claimed_at)
        values (${tutorRequestId}, ${familyOption!['id'] as string},
                now() + (${daysOut} * interval '1 day'),
                now() + (${daysOut} * interval '1 day') + interval '60 minutes',
                'claimed', now())
        returning id`;

      await sql`
        update bookings.tutor_requests
        set accepted_time_option_id = ${tutorOption!['id'] as string},
            acceptance_hold_expires_at = now() + (${deadlineMinutes} * interval '1 minute'),
            hold_rule_version = 1
        where id = ${tutorRequestId}`;

      // The live hold, exactly as selection leaves it: active, request_hold,
      // expiring at the payment deadline.
      const [reservation] = await sql`
        insert into availability.tutor_time_reservations
          (tutor_profile_id, tutor_request_id, start_at, end_at, effective_end_at,
           gap_minutes, status_code, reservation_type_code, expires_at)
        values (${tutorProfileId}, ${tutorRequestId},
                now() + (${daysOut} * interval '1 day'),
                now() + (${daysOut} * interval '1 day') + interval '60 minutes',
                now() + (${daysOut} * interval '1 day') + interval '60 minutes',
                0, 'active', 'request_hold',
                now() + (${deadlineMinutes} * interval '1 minute'))
        returning id`;

      if (options.payable !== false) {
        await sql`
          delete from payments.connected_accounts where tutor_profile_id = ${tutorProfileId}`;
        await sql`
          insert into payments.connected_accounts
            (tutor_profile_id, provider, provider_account_id, dashboard_code,
             configuration_code, country_code, status_code,
             transfers_capability_code, payouts_capability_code)
          values (${tutorProfileId}, 'stripe', ${'acct_ful_' + suffix}, 'express',
                  'recipient', 'NZ', 'complete', 'active', 'active')`;
        madePayable.push(tutorProfileId);
      }

      const providerPaymentIntentId = `pi_ful_${suffix}`;
      const [payment] = await sql`
        insert into payments.payments
          (intended_lesson_request_id, tutor_request_id, service_version_id,
           payer_user_id, family_account_id, tutor_profile_id, currency_code,
           lesson_amount_minor, platform_fee_rate_bps, platform_fee_rule_version,
           platform_fee_amount_minor, tutor_entitlement_minor,
           processing_fee_payer_code, processing_fee_rule_version,
           processing_fee_charged_minor, total_charged_minor, status_code,
           payment_deadline_at, provider, provider_payment_intent_id)
        values (${ilrId}, ${tutorRequestId}, ${serviceVersionId},
                ${payer!['id'] as string}, ${section!['family_account_id'] as string | null},
                ${tutorProfileId}, ${currency},
                ${lesson.toString()}::bigint, 1000, 1,
                ${fee.toString()}::bigint, ${entitlement.toString()}::bigint,
                'platform', 1, 0, ${lesson.toString()}::bigint, 'requires_payment',
                now() + (${deadlineMinutes} * interval '1 minute'), 'stripe',
                ${providerPaymentIntentId})
        returning id`;

      return {
        ilrId,
        tutorRequestId,
        tutorProfileId,
        paymentId: payment!['id'] as string,
        providerPaymentIntentId,
        reservationId: reservation!['id'] as string,
      };
    } finally {
      await sql.end();
    }
  };

  /** What Stripe would authoritatively report for a clean $40 success. */
  const authoritativeFor = (
    fixture: Fixture,
    overrides: Partial<AuthoritativeIntent> = {},
  ): AuthoritativeIntent => ({
    providerPaymentIntentId: fixture.providerPaymentIntentId,
    status: 'succeeded',
    livemode: false,
    amountReceivedMinor: 4000n,
    currencyCode: 'NZD',
    chargeId: `ch_${fixture.providerPaymentIntentId}`,
    balanceTransactionId: `txn_${fixture.providerPaymentIntentId}`,
    providerCostMinor: 170n,
    lastFailureCode: null,
    studdyPaymentId: fixture.paymentId,
    ...overrides,
  });

  const deliver = async (
    fixture: Fixture,
    options: {
      readonly eventType?: string;
      readonly providerEventId?: string;
      readonly authoritative?: Partial<AuthoritativeIntent>;
    } = {},
  ): Promise<FulfilmentOutcome> => {
    const providerEventId = options.providerEventId ?? `evt_${randomUUID()}`;
    createdEventIds.push(providerEventId);
    return applyPaymentProviderEvent({
      provider: 'stripe',
      providerEventId,
      eventType: options.eventType ?? 'payment_intent.succeeded',
      redactedPayload: { providerPaymentIntentId: fixture.providerPaymentIntentId },
      authoritative: authoritativeFor(fixture, options.authoritative ?? {}),
      correlationId: randomUUID(),
    });
  };

  const stateOf = async (
    fixture: Fixture,
  ): Promise<{
    paymentStatus: string;
    refundRequired: boolean;
    providerCostMinor: bigint | null;
    ilrStatus: string;
    tutorRequestStatus: string;
    reservationType: string;
    reservationStatus: string;
    reservationExpiresAt: Date | null;
    transfers: { amountMinor: bigint; currencyCode: string; statusCode: string }[];
  }> => {
    const { sql, db } = createDatabaseClient();
    try {
      const [payment] = await db.select().from(payments).where(eq(payments.id, fixture.paymentId));
      const [ilr] = await db
        .select({ statusCode: intendedLessonRequests.statusCode })
        .from(intendedLessonRequests)
        .where(eq(intendedLessonRequests.id, fixture.ilrId));
      const [treq] = await sql`
        select status_code from bookings.tutor_requests where id = ${fixture.tutorRequestId}`;
      const [reservation] = await db
        .select()
        .from(tutorTimeReservations)
        .where(eq(tutorTimeReservations.id, fixture.reservationId));
      const transfers = await db
        .select({
          amountMinor: tutorTransfers.amountMinor,
          currencyCode: tutorTransfers.currencyCode,
          statusCode: tutorTransfers.statusCode,
        })
        .from(tutorTransfers)
        .where(eq(tutorTransfers.paymentId, fixture.paymentId));
      return {
        paymentStatus: payment!.statusCode,
        refundRequired: payment!.refundRequiredAt !== null,
        providerCostMinor: payment!.providerCostMinor,
        ilrStatus: ilr!.statusCode,
        tutorRequestStatus: treq!['status_code'] as string,
        reservationType: reservation!.reservationTypeCode,
        reservationStatus: reservation!.statusCode,
        reservationExpiresAt: reservation!.expiresAt,
        transfers,
      };
    } finally {
      await sql.end();
    }
  };

  // -------------------------------------------------------------------------

  describe('a successful payment is the booking', () => {
    /**
     * THE WHOLE SLICE IN ONE ASSERTION. $40 in, and four records move together:
     * the payment succeeds, the request is fulfilled, the hold becomes a
     * booking that no longer expires, and Studdy owes the tutor $36.
     */
    it('fulfils the booking and owes the tutor 3600 NZD', async () => {
      const fixture = await awaitingPayment();

      expect(await deliver(fixture)).toBe('fulfilled');

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.ilrStatus).toBe('fulfilled');
      expect(state.reservationType).toBe('booking_confirmed');
      expect(state.reservationStatus).toBe('active');
      // A confirmed booking does not lapse.
      expect(state.reservationExpiresAt).toBeNull();
      expect(state.transfers).toEqual([
        { amountMinor: 3600n, currencyCode: 'NZD', statusCode: 'pending' },
      ]);
      expect(state.refundRequired).toBe(false);
    });

    /**
     * THE TUTOR REQUEST STAYS `selected`. The approved seven statuses do not
     * gain a `confirmed`, and a paid booking is recorded on the ILR and the
     * reservation instead.
     */
    it('leaves the winning tutor request selected', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);
      expect((await stateOf(fixture)).tutorRequestStatus).toBe('selected');
    });

    /** Recorded, never estimated — and only because the provider supplied it. */
    it('records the provider cost the provider actually reported', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);
      expect((await stateOf(fixture)).providerCostMinor).toBe(170n);
    });

    it('leaves the provider cost null when the provider supplied none', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture, { authoritative: { providerCostMinor: null } });
      expect((await stateOf(fixture)).providerCostMinor).toBeNull();
    });

    /** The obligation is recorded. NOTHING is sent. */
    it('creates the transfer obligation as pending, never sent', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);
      const { sql, db } = createDatabaseClient();
      try {
        const [transfer] = await db
          .select()
          .from(tutorTransfers)
          .where(eq(tutorTransfers.paymentId, fixture.paymentId));
        expect(transfer!.statusCode).toBe('pending');
        expect(transfer!.providerTransferId).toBeNull();
        expect(transfer!.sentAt).toBeNull();
        // The destination is Studdy's own connected-account row, never a value
        // that arrived with the event.
        expect(transfer!.connectedAccountId).not.toBeNull();
        expect(transfer!.tutorProfileId).toBe(fixture.tutorProfileId);
      } finally {
        await sql.end();
      }
    });
  });

  describe('money that does not match the snapshot confirms nothing', () => {
    /**
     * THE SNAPSHOT IS THE AUTHORITY ON WHAT WAS OWED. If the provider reports a
     * different amount, the safe act is to confirm nothing — a booking fulfilled
     * on the wrong figure would owe a tutor money against a price nobody agreed.
     */
    it('refuses fulfilment when the amount differs', async () => {
      const fixture = await awaitingPayment();

      expect(await deliver(fixture, { authoritative: { amountReceivedMinor: 3900n } })).toBe(
        'amount_mismatch',
      );

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('requires_payment');
      expect(state.ilrStatus).toBe('awaiting_payment');
      expect(state.reservationType).toBe('request_hold');
      expect(state.transfers).toHaveLength(0);
    });

    it('refuses fulfilment when the currency differs', async () => {
      const fixture = await awaitingPayment();

      expect(await deliver(fixture, { authoritative: { currencyCode: 'AUD' } })).toBe(
        'currency_mismatch',
      );

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('requires_payment');
      expect(state.ilrStatus).toBe('awaiting_payment');
      expect(state.transfers).toHaveLength(0);
    });

    /** A mismatch is recorded as `failed` so an operator can find it. */
    it('records a mismatch in the event ledger for ops', async () => {
      const fixture = await awaitingPayment();
      const providerEventId = `evt_${randomUUID()}`;
      await deliver(fixture, { providerEventId, authoritative: { amountReceivedMinor: 1n } });

      const { sql, db } = createDatabaseClient();
      try {
        const [event] = await db
          .select()
          .from(paymentEvents)
          .where(eq(paymentEvents.providerEventId, providerEventId));
        expect(event!.statusCode).toBe('failed');
        expect(event!.errorNote).not.toBeNull();
      } finally {
        await sql.end();
      }
    });
  });

  describe('an unknown payment is refused safely', () => {
    it('changes nothing for a PaymentIntent Studdy does not hold', async () => {
      const fixture = await awaitingPayment();
      const outcome = await deliver(fixture, {
        authoritative: { providerPaymentIntentId: `pi_not_ours_${randomUUID().slice(0, 8)}` },
      });
      expect(outcome).toBe('unknown_payment');
      expect((await stateOf(fixture)).ilrStatus).toBe('awaiting_payment');
    });

    /**
     * CORRELATION IS BY INTENT ID; THE METADATA IS A CROSS-CHECK. An intent that
     * names a different Studdy payment is refused rather than applied to the row
     * the id happened to match.
     */
    it('refuses when the provider metadata names a different Studdy payment', async () => {
      const fixture = await awaitingPayment();
      const outcome = await deliver(fixture, {
        authoritative: { studdyPaymentId: randomUUID() },
      });
      expect(outcome).toBe('unknown_payment');
      expect((await stateOf(fixture)).ilrStatus).toBe('awaiting_payment');
    });
  });

  describe('duplicate and out-of-order delivery are harmless', () => {
    /** Stripe retries freely. The unique event id absorbs it before any work. */
    it('treats the same event id twice as a duplicate and fulfils once', async () => {
      const fixture = await awaitingPayment();
      const providerEventId = `evt_${randomUUID()}`;

      expect(await deliver(fixture, { providerEventId })).toBe('fulfilled');
      expect(await deliver(fixture, { providerEventId })).toBe('duplicate');

      const state = await stateOf(fixture);
      expect(state.transfers).toHaveLength(1);
      expect(state.ilrStatus).toBe('fulfilled');
    });

    /**
     * A DIFFERENT event id for the same success — a redelivery Stripe genuinely
     * re-emitted, or a reconciliation run. The status guard, not the event id,
     * is what stops the second fulfilment.
     */
    it('does not fulfil twice when a second, distinct success event arrives', async () => {
      const fixture = await awaitingPayment();

      expect(await deliver(fixture)).toBe('fulfilled');
      expect(await deliver(fixture)).toBe('already_fulfilled');

      const state = await stateOf(fixture);
      expect(state.transfers).toHaveLength(1);
      expect(state.ilrStatus).toBe('fulfilled');
    });

    /** A fulfilled request cannot be fulfilled again, whatever arrives. */
    it('creates exactly one transfer obligation across five deliveries', async () => {
      const fixture = await awaitingPayment();
      for (let i = 0; i < 5; i += 1) await deliver(fixture);
      expect((await stateOf(fixture)).transfers).toHaveLength(1);
    });

    /**
     * OUT OF ORDER, THE CLASSIC CASE. A failure emitted before the success but
     * delivered after it must not walk a paid booking backwards.
     */
    it('cannot regress a succeeded payment with a late failure event', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);

      expect(
        await deliver(fixture, {
          eventType: 'payment_intent.payment_failed',
          authoritative: { lastFailureCode: 'card_declined' },
        }),
      ).toBe('ignored');

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.ilrStatus).toBe('fulfilled');
      expect(state.transfers).toHaveLength(1);
    });

    it('cannot regress a succeeded payment with a late cancellation', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);
      expect(await deliver(fixture, { eventType: 'payment_intent.canceled' })).toBe('ignored');
      expect((await stateOf(fixture)).paymentStatus).toBe('succeeded');
    });

    it('cannot regress a succeeded payment with a late processing event', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);
      expect(await deliver(fixture, { eventType: 'payment_intent.processing' })).toBe('ignored');
      expect((await stateOf(fixture)).paymentStatus).toBe('succeeded');
    });

    /** `failed` then `succeeded` still fulfils — the ordinary retry story. */
    it('fulfils normally after a recoverable decline', async () => {
      const fixture = await awaitingPayment();

      expect(
        await deliver(fixture, {
          eventType: 'payment_intent.payment_failed',
          authoritative: { lastFailureCode: 'card_declined' },
        }),
      ).toBe('applied');
      // A decline is an annotation, never a transition.
      expect((await stateOf(fixture)).paymentStatus).toBe('requires_payment');

      expect(await deliver(fixture)).toBe('fulfilled');
      expect((await stateOf(fixture)).ilrStatus).toBe('fulfilled');
    });
  });

  describe('two workers racing the same success converge on one result', () => {
    /**
     * THE RACE THAT MATTERS. Two concurrent deliveries of the same successful
     * payment — Stripe's retry overlapping the original, or a reconciliation run
     * meeting a webhook. The payment row is taken `FOR UPDATE`, so one wins and
     * the other reports `already_fulfilled`; exactly one booking, exactly one
     * obligation.
     */
    it('produces one fulfilment and one transfer obligation', async () => {
      const fixture = await awaitingPayment();

      const outcomes = await Promise.all([deliver(fixture), deliver(fixture)]);

      expect(outcomes.filter((outcome) => outcome === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome === 'already_fulfilled')).toHaveLength(1);

      const state = await stateOf(fixture);
      expect(state.transfers).toHaveLength(1);
      expect(state.ilrStatus).toBe('fulfilled');
    });

    it('holds under four simultaneous deliveries', async () => {
      const fixture = await awaitingPayment();

      const outcomes = await Promise.all([
        deliver(fixture),
        deliver(fixture),
        deliver(fixture),
        deliver(fixture),
      ]);

      expect(outcomes.filter((outcome) => outcome === 'fulfilled')).toHaveLength(1);
      expect((await stateOf(fixture)).transfers).toHaveLength(1);
    });
  });

  describe('an incompatible state fails safely and visibly', () => {
    /**
     * LATE SUCCESS. The sweep already closed the request and released the hold,
     * and then the money arrives.
     *
     * Studdy does the only honest thing: it records that the payment succeeded,
     * flags it for refund, and CONFIRMS NOTHING. No second booking is invented,
     * and no tutor is owed for a lesson that is not happening.
     */
    it('flags a payment for refund when the request is no longer awaiting payment', async () => {
      const fixture = await awaitingPayment();
      const { sql } = createDatabaseClient();
      try {
        await sql`
          update bookings.intended_lesson_requests
          set status_code = 'closed', close_reason_code = 'payment_window_lapsed'
          where id = ${fixture.ilrId}`;
      } finally {
        await sql.end();
      }

      expect(await deliver(fixture)).toBe('fulfilment_blocked');

      const state = await stateOf(fixture);
      // The money is real, so the ledger says so.
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.refundRequired).toBe(true);
      // And nothing was confirmed.
      expect(state.ilrStatus).toBe('closed');
      expect(state.reservationType).toBe('request_hold');
      expect(state.transfers).toHaveLength(0);
    });

    it('flags a payment for refund when the reservation was already released', async () => {
      const fixture = await awaitingPayment();
      const { sql } = createDatabaseClient();
      try {
        await sql`
          update availability.tutor_time_reservations
          set status_code = 'released', released_at = now(),
              release_reason_code = 'payment_window_lapsed'
          where id = ${fixture.reservationId}`;
      } finally {
        await sql.end();
      }

      expect(await deliver(fixture)).toBe('fulfilment_blocked');

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.refundRequired).toBe(true);
      expect(state.ilrStatus).toBe('awaiting_payment');
      expect(state.transfers).toHaveLength(0);
    });

    /**
     * No payout account, no honest obligation. `connected_account_id` is NOT
     * NULL by design, so the alternative would be a transfer to nobody.
     */
    it('flags a payment for refund when the tutor has no live payout account', async () => {
      const fixture = await awaitingPayment({ payable: false });

      expect(await deliver(fixture)).toBe('fulfilment_blocked');

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.refundRequired).toBe(true);
      expect(state.ilrStatus).toBe('awaiting_payment');
      expect(state.transfers).toHaveLength(0);
    });

    /** A cancelled payment that then reports success is an ops event, not a booking. */
    it('does not fulfil against a terminal payment status', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture, { eventType: 'payment_intent.canceled' });
      expect((await stateOf(fixture)).paymentStatus).toBe('cancelled');

      expect(await deliver(fixture)).toBe('fulfilment_blocked');

      const state = await stateOf(fixture);
      expect(state.refundRequired).toBe(true);
      expect(state.ilrStatus).toBe('awaiting_payment');
      expect(state.transfers).toHaveLength(0);
    });
  });

  describe('LATE SUCCESS — the approved launch rule, end to end', () => {
    /**
     * THE INVARIANT THIS SLICE TURNS ON, and the one that proves "Stripe payment
     * succeeded" and "Studdy booking fulfilled" are not the same sentence.
     *
     * The window lapsed, the REAL expiry sweep closed the request and released
     * the tutor's time, and only then did the money arrive. Studdy records the
     * payment honestly and confirms nothing: no fulfilment, no confirmed
     * reservation, no obligation to a tutor whose slot may already have gone to
     * another family. A human is told, by `refund_required_at` and a high-risk
     * audit row, and refund execution is deliberately outside this slice.
     *
     * Driven through `expireOverdueRequests` rather than by editing rows, so
     * this tests the state the product actually produces.
     */
    const lapsedThenPaid = async (): Promise<Fixture> => {
      const fixture = await awaitingPayment();
      const { sql } = createDatabaseClient();
      try {
        await sql`
          update bookings.tutor_requests
          set payment_deadline_at = now() - interval '5 minutes'
          where id = ${fixture.tutorRequestId}`;
      } finally {
        await sql.end();
      }
      // The real sweep, with the payment still `requires_payment` so nothing
      // protects it — exactly the abandoned-window case.
      await expireOverdueRequests({ correlationId: randomUUID() });

      const swept = await stateOf(fixture);
      expect(swept.tutorRequestStatus).toBe('closed');
      expect(swept.ilrStatus).toBe('closed');
      expect(swept.reservationStatus).toBe('released');
      return fixture;
    };

    it('records the payment, requires a refund, and fulfils nothing', async () => {
      const fixture = await lapsedThenPaid();

      expect(await deliver(fixture)).toBe('fulfilment_blocked');

      const state = await stateOf(fixture);
      // The money is real, so the ledger says so.
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.refundRequired).toBe(true);
      // And nothing was booked.
      expect(state.ilrStatus).not.toBe('fulfilled');
      expect(state.reservationType).not.toBe('booking_confirmed');
      expect(state.reservationStatus).toBe('released');
      expect(state.transfers).toHaveLength(0);
    });

    /** Authoritative provider information is still recorded on a blocked payment. */
    it('still records the provider charge, balance transaction and cost', async () => {
      const fixture = await lapsedThenPaid();
      await deliver(fixture);

      const { sql, db } = createDatabaseClient();
      try {
        const [payment] = await db
          .select()
          .from(payments)
          .where(eq(payments.id, fixture.paymentId));
        expect(payment!.providerChargeId).toBe(`ch_${fixture.providerPaymentIntentId}`);
        expect(payment!.providerBalanceTransactionId).toBe(
          `txn_${fixture.providerPaymentIntentId}`,
        );
        expect(payment!.providerCostMinor).toBe(170n);
      } finally {
        await sql.end();
      }
    });

    /** A high-risk audit row and an outbox alert, so ops sees it. */
    it('raises a high-risk audit event and an outbox alert', async () => {
      const fixture = await lapsedThenPaid();
      await deliver(fixture);

      const { sql } = createDatabaseClient();
      try {
        const audit = await sql`
          select risk_level from audit.audit_events
          where entity_id = ${fixture.paymentId} and action = 'payment.refund_required'`;
        expect(audit).toHaveLength(1);
        expect(audit[0]!['risk_level']).toBe('high');

        const outbox = await sql`
          select event_type from audit.outbox_entries
          where idempotency_key = ${`payment.refund_required:${fixture.paymentId}`}`;
        expect(outbox).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });

    /** Redelivery of a blocked late success must not start inventing a booking. */
    it('stays harmless when the same success is redelivered', async () => {
      const fixture = await lapsedThenPaid();
      const providerEventId = `evt_${randomUUID()}`;

      expect(await deliver(fixture, { providerEventId })).toBe('fulfilment_blocked');
      // Same event id: absorbed by the unique constraint.
      expect(await deliver(fixture, { providerEventId })).toBe('duplicate');
      // A distinct event id for the same success: the payment is already
      // terminal, so it reports as already fulfilled and writes nothing.
      expect(await deliver(fixture)).toBe('already_fulfilled');

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.refundRequired).toBe(true);
      expect(state.ilrStatus).not.toBe('fulfilled');
      expect(state.reservationType).not.toBe('booking_confirmed');
      expect(state.transfers).toHaveLength(0);
    });

    /** No booking means no obligation — a tutor is never owed for a lost slot. */
    it('never creates a transfer obligation across repeated late deliveries', async () => {
      const fixture = await lapsedThenPaid();
      for (let i = 0; i < 4; i += 1) await deliver(fixture);
      expect((await stateOf(fixture)).transfers).toHaveLength(0);
    });
  });

  describe('a reconciliation worker racing the webhook', () => {
    /**
     * THE SECOND RACE THAT MATTERS. The webhook arrives at the same moment the
     * reconciliation sweep asks Stripe about the same in-flight payment.
     *
     * They are DIFFERENT provider event ids — one Stripe's `evt_...`, one the
     * reconciler's deterministic `reconcile:<intent>:<status>` — so the unique
     * event-id constraint does NOT absorb this one. What resolves it is the
     * payment row's `FOR UPDATE` plus the status-guarded writes: one wins and
     * fulfils, the other finds the work already done.
     */
    const reconcileStyle = (fixture: Fixture): string =>
      `reconcile:${fixture.providerPaymentIntentId}:succeeded`;

    it('produces one succeeded payment, one booking and exactly one obligation', async () => {
      const fixture = await awaitingPayment();
      // The payment is mid-flight, which is precisely when the reconciler looks.
      expect(await deliver(fixture, { eventType: 'payment_intent.processing' })).toBe('applied');

      const outcomes = await Promise.all([
        deliver(fixture, { providerEventId: `evt_${randomUUID()}` }),
        deliver(fixture, { providerEventId: reconcileStyle(fixture) }),
      ]);

      // ONE logical outcome: one of them fulfilled, the other found it done.
      expect(outcomes.filter((outcome) => outcome === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome === 'already_fulfilled')).toHaveLength(1);

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.ilrStatus).toBe('fulfilled');
      expect(state.reservationType).toBe('booking_confirmed');
      expect(state.reservationExpiresAt).toBeNull();
      expect(state.transfers).toEqual([
        { amountMinor: 3600n, currencyCode: 'NZD', statusCode: 'pending' },
      ]);
    });

    /** And exactly one confirmed reservation — never a second alongside it. */
    it('leaves exactly one active reservation for the request', async () => {
      const fixture = await awaitingPayment();
      await Promise.all([
        deliver(fixture, { providerEventId: `evt_${randomUUID()}` }),
        deliver(fixture, { providerEventId: reconcileStyle(fixture) }),
      ]);

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: tutorTimeReservations.id })
          .from(tutorTimeReservations)
          .where(
            and(
              eq(tutorTimeReservations.tutorRequestId, fixture.tutorRequestId),
              eq(tutorTimeReservations.statusCode, 'active'),
            ),
          );
        expect(rows).toHaveLength(1);
        expect(rows[0]!.id).toBe(fixture.reservationId);
      } finally {
        await sql.end();
      }
    });

    /**
     * The reconciler re-running is free: its event id is deterministic on the
     * intent and status, so a second pass collides rather than reapplying.
     */
    it('makes a repeated reconciliation pass a no-op', async () => {
      const fixture = await awaitingPayment();
      expect(await deliver(fixture, { providerEventId: reconcileStyle(fixture) })).toBe(
        'fulfilled',
      );
      expect(await deliver(fixture, { providerEventId: reconcileStyle(fixture) })).toBe(
        'duplicate',
      );
      expect((await stateOf(fixture)).transfers).toHaveLength(1);
    });

    /**
     * A RECONCILED LATE SUCCESS BEHAVES EXACTLY LIKE A LATE WEBHOOK. The
     * reconciler cannot create an obligation the webhook would have refused,
     * because both go through the same command.
     */
    it('cannot fulfil a swept request just because reconciliation found it', async () => {
      const fixture = await awaitingPayment();
      const { sql } = createDatabaseClient();
      try {
        await sql`
          update bookings.tutor_requests
          set payment_deadline_at = now() - interval '5 minutes'
          where id = ${fixture.tutorRequestId}`;
      } finally {
        await sql.end();
      }
      await expireOverdueRequests({ correlationId: randomUUID() });

      expect(await deliver(fixture, { providerEventId: reconcileStyle(fixture) })).toBe(
        'fulfilment_blocked',
      );

      const state = await stateOf(fixture);
      expect(state.paymentStatus).toBe('succeeded');
      expect(state.refundRequired).toBe(true);
      expect(state.ilrStatus).not.toBe('fulfilled');
      expect(state.transfers).toHaveLength(0);
    });
  });

  describe('the expiry sweep and a paid booking', () => {
    /**
     * SLICE 5'S IN-FLIGHT GUARD, exercised against a payment this slice can
     * finally put into `processing`. A confirmation on its way must not have its
     * request lapsed out from under it.
     */
    it('cannot release a request whose payment is processing', async () => {
      const fixture = await awaitingPayment({ deadlineMinutesFromNow: 45 });
      expect(await deliver(fixture, { eventType: 'payment_intent.processing' })).toBe('applied');

      const { sql } = createDatabaseClient();
      try {
        // Push the deadline into the past so the sweep would otherwise take it.
        await sql`
          update bookings.tutor_requests
          set payment_deadline_at = now() - interval '5 minutes'
          where id = ${fixture.tutorRequestId}`;
      } finally {
        await sql.end();
      }

      await expireOverdueRequests({ correlationId: randomUUID() });

      const state = await stateOf(fixture);
      expect(state.tutorRequestStatus).toBe('selected');
      expect(state.ilrStatus).toBe('awaiting_payment');
      expect(state.reservationStatus).toBe('active');
    });

    it('cannot release a request whose payment already succeeded', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);

      const { sql } = createDatabaseClient();
      try {
        await sql`
          update bookings.tutor_requests
          set payment_deadline_at = now() - interval '5 minutes'
          where id = ${fixture.tutorRequestId}`;
      } finally {
        await sql.end();
      }

      await expireOverdueRequests({ correlationId: randomUUID() });

      const state = await stateOf(fixture);
      expect(state.tutorRequestStatus).toBe('selected');
      expect(state.ilrStatus).toBe('fulfilled');
      expect(state.reservationStatus).toBe('active');
      expect(state.reservationType).toBe('booking_confirmed');
    });

    /** A confirmed booking survives sweep after sweep, however old its deadline. */
    it('leaves a fulfilled booking untouched across repeated sweeps', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);

      const { sql } = createDatabaseClient();
      try {
        await sql`
          update bookings.tutor_requests
          set payment_deadline_at = now() - interval '10 days',
              acceptance_hold_expires_at = now() - interval '10 days'
          where id = ${fixture.tutorRequestId}`;
      } finally {
        await sql.end();
      }

      await expireOverdueRequests({ correlationId: randomUUID() });
      await expireOverdueRequests({ correlationId: randomUUID() });
      await expireOverdueRequests({ correlationId: randomUUID() });

      const state = await stateOf(fixture);
      expect(state.ilrStatus).toBe('fulfilled');
      expect(state.tutorRequestStatus).toBe('selected');
      expect(state.reservationType).toBe('booking_confirmed');
      expect(state.transfers).toHaveLength(1);
    });
  });

  describe('the state machines this slice must not expand', () => {
    /**
     * THE SEVEN TUTOR REQUEST STATUSES, unchanged. An earlier draft of the
     * payment plan proposed an eighth, `confirmed`; the owner rejected it and
     * the expiry sweep is guarded on the ILR instead. This fails if anyone adds
     * one back.
     */
    it('keeps exactly the seven approved tutor request statuses', () => {
      expect([...TUTOR_REQUEST_STATUSES]).toEqual([
        'sent',
        'accepted',
        'selected',
        'declined',
        'expired',
        'acceptance_withdrawn',
        'closed',
      ]);
    });

    /** No `lessons` row is created. The booking is the three records. */
    it('creates no lesson record when a booking is confirmed', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);

      const { sql } = createDatabaseClient();
      try {
        const tables = await sql`
          select table_name from information_schema.tables where table_schema = 'lessons'`;
        expect(tables).toHaveLength(0);
      } finally {
        await sql.end();
      }
    });
  });

  describe('the event ledger', () => {
    it('records an applied success against the payment it fulfilled', async () => {
      const fixture = await awaitingPayment();
      const providerEventId = `evt_${randomUUID()}`;
      await deliver(fixture, { providerEventId });

      const { sql, db } = createDatabaseClient();
      try {
        const [event] = await db
          .select()
          .from(paymentEvents)
          .where(eq(paymentEvents.providerEventId, providerEventId));
        expect(event!.statusCode).toBe('applied');
        expect(event!.paymentId).toBe(fixture.paymentId);
        expect(event!.processedAt).not.toBeNull();
      } finally {
        await sql.end();
      }
    });

    /** One row per provider event id, enforced by the database. */
    it('stores one row for a redelivered event', async () => {
      const fixture = await awaitingPayment();
      const providerEventId = `evt_${randomUUID()}`;
      await deliver(fixture, { providerEventId });
      await deliver(fixture, { providerEventId });

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: paymentEvents.id })
          .from(paymentEvents)
          .where(eq(paymentEvents.providerEventId, providerEventId));
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });
  });

  describe('the transfer obligation cannot be duplicated', () => {
    /**
     * THE DATABASE IS THE BACKSTOP, not the code path. Even a direct insert that
     * bypasses every guard above collides on the unique idempotency key.
     */
    it('refuses a second obligation for the same payment', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);

      const { sql, db } = createDatabaseClient();
      try {
        const [existing] = await db
          .select()
          .from(tutorTransfers)
          .where(eq(tutorTransfers.paymentId, fixture.paymentId));

        await expect(
          db.insert(tutorTransfers).values({
            paymentId: fixture.paymentId,
            tutorProfileId: existing!.tutorProfileId,
            connectedAccountId: existing!.connectedAccountId,
            amountMinor: existing!.amountMinor,
            currencyCode: existing!.currencyCode,
            statusCode: 'pending',
            idempotencyKey: `tutor-transfer:${fixture.paymentId}`,
          }),
        ).rejects.toThrow();
      } finally {
        await sql.end();
      }
    });

    /** And on the live-per-payment partial index, under a different key. */
    it('refuses a second live obligation even with a different idempotency key', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);

      const { sql, db } = createDatabaseClient();
      try {
        const [existing] = await db
          .select()
          .from(tutorTransfers)
          .where(eq(tutorTransfers.paymentId, fixture.paymentId));

        await expect(
          db.insert(tutorTransfers).values({
            paymentId: fixture.paymentId,
            tutorProfileId: existing!.tutorProfileId,
            connectedAccountId: existing!.connectedAccountId,
            amountMinor: existing!.amountMinor,
            currencyCode: existing!.currencyCode,
            statusCode: 'pending',
            idempotencyKey: `something-else:${randomUUID()}`,
          }),
        ).rejects.toThrow();
      } finally {
        await sql.end();
      }
    });
  });

  describe('the live-payment guarantee', () => {
    /**
     * A SECOND PAYMENT FOR A PAID LESSON IS UNREPRESENTABLE. `succeeded` is
     * inside the live set of the partial unique index deliberately.
     */
    it('refuses a second live payment for a fulfilled request', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);

      const { sql, db } = createDatabaseClient();
      try {
        const [existing] = await db
          .select()
          .from(payments)
          .where(eq(payments.id, fixture.paymentId));

        await expect(
          db.insert(payments).values({
            intendedLessonRequestId: existing!.intendedLessonRequestId,
            tutorRequestId: existing!.tutorRequestId,
            serviceVersionId: existing!.serviceVersionId,
            payerUserId: existing!.payerUserId,
            familyAccountId: existing!.familyAccountId,
            tutorProfileId: existing!.tutorProfileId,
            currencyCode: existing!.currencyCode,
            lessonAmountMinor: existing!.lessonAmountMinor,
            platformFeeRateBps: existing!.platformFeeRateBps,
            platformFeeRuleVersion: existing!.platformFeeRuleVersion,
            platformFeeAmountMinor: existing!.platformFeeAmountMinor,
            tutorEntitlementMinor: existing!.tutorEntitlementMinor,
            processingFeePayerCode: existing!.processingFeePayerCode,
            processingFeeRuleVersion: existing!.processingFeeRuleVersion,
            processingFeeChargedMinor: existing!.processingFeeChargedMinor,
            totalChargedMinor: existing!.totalChargedMinor,
            statusCode: 'requires_payment',
            paymentDeadlineAt: existing!.paymentDeadlineAt,
          }),
        ).rejects.toThrow();
      } finally {
        await sql.end();
      }
    });
  });

  describe('one confirmed reservation, never two', () => {
    /**
     * THE SAME ROW IS CARRIED FORWARD, so a booking cannot appear beside the
     * hold it came from — and the GiST exclusion constraint never sees a moment
     * where the tutor's slot is unclaimed.
     */
    it('confirms the reservation in place rather than creating a second', async () => {
      const fixture = await awaitingPayment();
      await deliver(fixture);

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ id: tutorTimeReservations.id })
          .from(tutorTimeReservations)
          .where(
            and(
              eq(tutorTimeReservations.tutorRequestId, fixture.tutorRequestId),
              eq(tutorTimeReservations.statusCode, 'active'),
            ),
          );
        expect(rows).toHaveLength(1);
        expect(rows[0]!.id).toBe(fixture.reservationId);
      } finally {
        await sql.end();
      }
    });
  });
});
