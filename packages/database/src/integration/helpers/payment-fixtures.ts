import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '../../client';
import {
  applyPaymentProviderEvent,
  type AuthoritativeIntent,
  type FulfilmentOutcome,
} from '../../repositories/payment-fulfilment';

/**
 * Shared fixtures for the money integration suites: a request that has been
 * selected, priced and is waiting on a webhook, and the means to drive it
 * through the REAL fulfilment command and clean every row up again.
 *
 * WRITTEN DIRECTLY RATHER THAN DRIVEN THROUGH THE FAN-OUT. These suites are
 * about what happens to money AFTER a payment exists, and building a booking
 * journey in each would test the fixture instead. The shape of every row here is
 * the one selection leaves behind; `lesson-requests.integration.test.ts` covers
 * the journey that produces it.
 *
 * EVERY ROW IS REMOVED AGAIN, and the reservations are the reason it has to be
 * thorough. A hold is a real GiST exclusion lock on a tutor's calendar, and every
 * fixture shares a tutor, so a row left behind makes the NEXT run collide with
 * this one. Each suite takes its own `dayCursor` base so two suites can never
 * book the same afternoon even if one fails to clean up.
 */

export interface PaymentFixture {
  readonly ilrId: string;
  readonly tutorRequestId: string;
  readonly tutorProfileId: string;
  readonly paymentId: string;
  readonly paymentReference: string;
  readonly providerPaymentIntentId: string;
  readonly reservationId: string;
}

export interface AwaitingPaymentOptions {
  readonly lessonAmountMinor?: bigint;
  /** False leaves the tutor with no payout account, so fulfilment is blocked. */
  readonly payable?: boolean;
  readonly deadlineMinutesFromNow?: number;
  /**
   * How far from now the lesson starts. Defaults to a distinct far-future day
   * per fixture; settlement tests pass a value that puts the lesson in the PAST
   * by rewriting the booking afterwards, because a reservation cannot be created
   * in the past by the product's own rules.
   */
  readonly daysOut?: number;
}

export function paymentFixtures(dayCursorStart: number) {
  const createdIlrIds: string[] = [];
  const madePayable: string[] = [];
  const createdEventIds: string[] = [];
  let dayCursor = dayCursorStart;

  const awaitingPayment = async (options: AwaitingPaymentOptions = {}): Promise<PaymentFixture> => {
    const { sql } = createDatabaseClient();
    try {
      const suffix = randomUUID().slice(0, 8);
      const lesson = options.lessonAmountMinor ?? 4000n;
      const fee = (lesson * 1000n) / 10000n;
      const entitlement = lesson - fee;
      const deadlineMinutes = options.deadlineMinutesFromNow ?? 45;
      dayCursor += 3;
      const daysOut = options.daysOut ?? dayCursor;

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
                60, 'online', 'Pacific/Auckland', 'awaiting_payment', ${'LR-FIX-' + suffix},
                now() + interval '4 hours', 1)
        returning id`;
      const ilrId = ilr!['id'] as string;
      createdIlrIds.push(ilrId);

      const [treq] = await sql`
        insert into bookings.tutor_requests
          (intended_lesson_request_id, tutor_profile_id, service_version_id, status_code,
           position, respond_by_at, reference, payment_deadline_at, deadline_rule_version)
        values (${ilrId}, ${tutorProfileId}, ${serviceVersionId},
                'selected', 1, now() + interval '2 hours', ${'TREQ-FIX-' + suffix},
                now() + (${deadlineMinutes} * interval '1 minute'), 1)
        returning id`;
      const tutorRequestId = treq!['id'] as string;

      // A REAL ACCEPTANCE: the claimed option, hold expiry and rule version are
      // inseparable by constraint, and the accepted option is a composite foreign
      // key back to this tutor's own row.
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
          values (${tutorProfileId}, 'stripe', ${'acct_fix_' + suffix}, 'express',
                  'recipient', 'NZ', 'complete', 'active', 'active')`;
        madePayable.push(tutorProfileId);
      }

      const providerPaymentIntentId = `pi_fix_${suffix}`;
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
                ${tutorProfileId}, 'NZD',
                ${lesson.toString()}::bigint, 1000, 1,
                ${fee.toString()}::bigint, ${entitlement.toString()}::bigint,
                'platform', 1, 0, ${lesson.toString()}::bigint, 'requires_payment',
                now() + (${deadlineMinutes} * interval '1 minute'), 'stripe',
                ${providerPaymentIntentId})
        returning id, reference`;

      return {
        ilrId,
        tutorRequestId,
        tutorProfileId,
        paymentId: payment!['id'] as string,
        paymentReference: payment!['reference'] as string,
        providerPaymentIntentId,
        reservationId: reservation!['id'] as string,
      };
    } finally {
      await sql.end();
    }
  };

  /** What Stripe would authoritatively report for a clean success of this fixture. */
  const authoritativeFor = (
    fixture: PaymentFixture,
    amountMinor: bigint,
    overrides: Partial<AuthoritativeIntent> = {},
  ): AuthoritativeIntent => ({
    providerPaymentIntentId: fixture.providerPaymentIntentId,
    status: 'succeeded',
    livemode: false,
    amountReceivedMinor: amountMinor,
    currencyCode: 'NZD',
    chargeId: `ch_${fixture.providerPaymentIntentId}`,
    balanceTransactionId: `txn_${fixture.providerPaymentIntentId}`,
    providerCostMinor: 170n,
    lastFailureCode: null,
    studdyPaymentId: fixture.paymentId,
    ...overrides,
  });

  /** Deliver a verified `payment_intent.succeeded` through the real command. */
  const deliverSuccess = async (
    fixture: PaymentFixture,
    amountMinor = 4000n,
  ): Promise<FulfilmentOutcome> => {
    const providerEventId = `evt_${randomUUID()}`;
    createdEventIds.push(providerEventId);
    return applyPaymentProviderEvent({
      provider: 'stripe',
      providerEventId,
      eventType: 'payment_intent.succeeded',
      redactedPayload: { providerPaymentIntentId: fixture.providerPaymentIntentId },
      authoritative: authoritativeFor(fixture, amountMinor),
      correlationId: randomUUID(),
    });
  };

  /**
   * A payment that SUCCEEDED and was FLAGGED FOR REFUND — produced by the real
   * late-success path (the tutor has no payout account, so the booking cannot
   * be confirmed), not by writing the flag directly.
   */
  const flaggedForRefund = async (
    options: Omit<AwaitingPaymentOptions, 'payable'> = {},
  ): Promise<PaymentFixture> => {
    const fixture = await awaitingPayment({ ...options, payable: false });
    const outcome = await deliverSuccess(fixture, options.lessonAmountMinor ?? 4000n);
    if (outcome !== 'fulfilment_blocked') {
      throw new Error(`Fixture expected a blocked fulfilment, got ${outcome}.`);
    }
    return fixture;
  };

  /** A payment that SUCCEEDED and was CONFIRMED into a booking. */
  const confirmed = async (options: AwaitingPaymentOptions = {}): Promise<PaymentFixture> => {
    const fixture = await awaitingPayment({ ...options, payable: true });
    const outcome = await deliverSuccess(fixture, options.lessonAmountMinor ?? 4000n);
    if (outcome !== 'fulfilled') {
      throw new Error(`Fixture expected a fulfilled booking, got ${outcome}.`);
    }
    return fixture;
  };

  /** Remove every row created, in foreign-key order. */
  const cleanup = async (): Promise<void> => {
    const { sql } = createDatabaseClient();
    try {
      if (createdIlrIds.length > 0) {
        const ilrs = createdIlrIds;
        const paymentRows = await sql`
          select id::text as id from payments.payments
          where intended_lesson_request_id = any(${ilrs}::uuid[])`;
        const payIds = paymentRows.map((row) => row['id'] as string);
        const refundRows = await sql`
          select id::text as id from payments.refunds where payment_id = any(${payIds}::uuid[])`;
        const refundIds = refundRows.map((row) => row['id'] as string);
        const bookingRows = await sql`
          select id::text as id from bookings.bookings
          where intended_lesson_request_id = any(${ilrs}::uuid[])`;
        const bookingIds = bookingRows.map((row) => row['id'] as string);
        const transferRows = await sql`
          select id::text as id from payments.tutor_transfers where payment_id = any(${payIds}::uuid[])`;
        const transferIds = transferRows.map((row) => row['id'] as string);

        await sql`delete from audit.status_transitions where entity_id = any(${transferIds})`;
        await sql`delete from audit.audit_events where entity_id = any(${transferIds})`;
        await sql`delete from audit.status_transitions where entity_id = any(${refundIds})`;
        await sql`delete from payments.refunds where payment_id = any(${payIds}::uuid[])`;
        await sql`delete from audit.status_transitions where entity_id = any(${bookingIds})`;
        await sql`delete from bookings.bookings where intended_lesson_request_id = any(${ilrs}::uuid[])`;
        await sql`delete from payments.tutor_transfers where payment_id = any(${payIds}::uuid[])`;
        await sql`delete from payments.payment_events where payment_id = any(${payIds}::uuid[])`;
        // Audit and outbox rows carry no foreign key; they are removed by the ids they recorded.
        await sql`delete from audit.audit_events where entity_id = any(${payIds})`;
        await sql`delete from audit.outbox_entries where payload->>'paymentId' = any(${payIds})`;
        await sql`delete from payments.payments where intended_lesson_request_id = any(${ilrs}::uuid[])`;
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
  };

  return { awaitingPayment, deliverSuccess, flaggedForRefund, confirmed, cleanup };
}
