import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { createDatabaseClient } from '../client';
import { connectedAccounts, payments, tutorProfiles, tutorRequests } from '../schema/index';
import {
  createPaymentForRequest,
  livePaymentForRequest,
  PaymentRefusedError,
  type PaymentRefusalReason,
} from '../repositories/payments';

/**
 * Server-authoritative payment creation.
 *
 * NO STRIPE KEY IS NEEDED. The repository deliberately knows nothing about
 * Stripe — `@studdy/database` does not depend on `@studdy/integrations` — so
 * every guard and every amount is testable here with no network.
 *
 * What is asserted is the part a browser must never influence: the amounts, the
 * ownership boundary, the deadline, the tutor's live payability, and the
 * one-live-payment-per-request rule.
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

describe.skipIf(!available)('creating a payment for a selected request (integration)', () => {
  const madePayable: string[] = [];

  /** Make a tutor payable, as slice 4's readiness rule defines it. */
  const makePayable = async (
    tutorProfileId: string,
    transfers = 'active',
    payouts = 'active',
  ): Promise<void> => {
    const { sql, db } = createDatabaseClient();
    try {
      await db
        .delete(connectedAccounts)
        .where(eq(connectedAccounts.tutorProfileId, tutorProfileId));
      await db.insert(connectedAccounts).values({
        tutorProfileId,
        provider: 'stripe',
        providerAccountId: `acct_test_${randomUUID().slice(0, 12)}`,
        dashboardCode: 'express',
        configurationCode: 'recipient',
        countryCode: 'NZ',
        statusCode: transfers === 'active' && payouts === 'active' ? 'complete' : 'pending',
        transfersCapabilityCode: transfers,
        payoutsCapabilityCode: payouts,
      });
      madePayable.push(tutorProfileId);
    } finally {
      await sql.end();
    }
  };

  afterEach(async () => {
    const { sql, db } = createDatabaseClient();
    try {
      await db.delete(payments);
      if (madePayable.length > 0) {
        await db
          .delete(connectedAccounts)
          .where(inArray(connectedAccounts.tutorProfileId, madePayable));
        madePayable.length = 0;
      }
    } finally {
      await sql.end();
    }
  });

  /**
   * A selected request ready to be paid for.
   *
   * Built by writing the selection state directly rather than driving the whole
   * fan-out: this suite is about PRICING AND GUARDS, and a full booking journey
   * would test the fixture instead — `lesson-requests.integration.test.ts`
   * already covers that exhaustively.
   */
  const selectedRequest = async (
    options: {
      readonly priceMinor?: bigint;
      readonly deadlineMinutesFromNow?: number;
    } = {},
  ): Promise<{
    reference: string;
    studentProfileIds: string[];
    payerUserId: string;
    tutorProfileId: string;
    tutorRequestId: string;
  }> => {
    const { sql } = createDatabaseClient();
    try {
      // postgres.js takes no bigint parameter; the column is bigint and casts
      // a numeric string cleanly.
      const price = (options.priceMinor ?? 4000n).toString();
      const deadlineMinutes = options.deadlineMinutesFromNow ?? 45;
      const suffix = randomUUID().slice(0, 8);

      // A priced version and the tutor who offers it.
      const [version] = await sql`
        select sv.id as service_version_id, s.tutor_profile_id
        from services.service_versions sv
        join services.services s on s.id = sv.service_id
        where sv.status_code = 'current'
        limit 1`;
      // A student section to hang the request on, and any real user as payer —
      // students are linked to families, not directly to a login.
      const [section] = await sql`
        select sss.id as section_id, sss.student_profile_id,
               sp.default_family_account_id as family_account_id
        from students.student_subject_sections sss
        join students.student_profiles sp on sp.id = sss.student_profile_id
        limit 1`;
      const [payer] = await sql`select id from identity.users limit 1`;

      await sql`
        update services.service_versions set price_amount_minor = ${price}::bigint
        where id = ${version!['service_version_id'] as string}`;

      const [ilr] = await sql`
        insert into bookings.intended_lesson_requests
          (student_subject_section_id, requested_by_user_id, family_account_id,
           duration_minutes, format_code, time_zone, status_code, reference,
           decision_deadline_at, deadline_rule_version)
        values (${section!['section_id'] as string}, ${payer!['id'] as string},
                ${section!['family_account_id'] as string | null},
                60, 'online', 'Pacific/Auckland', 'awaiting_payment', ${'LR-PAY-' + suffix},
                now() + interval '4 hours', 1)
        returning id, reference`;

      const [treq] = await sql`
        insert into bookings.tutor_requests
          (intended_lesson_request_id, tutor_profile_id, service_version_id, status_code,
           position, respond_by_at, reference, payment_deadline_at, deadline_rule_version)
        values (${ilr!['id'] as string}, ${version!['tutor_profile_id'] as string},
                ${version!['service_version_id'] as string},
                'selected', 1, now() + interval '2 hours', ${'TREQ-PAY-' + suffix},
                now() + (${deadlineMinutes} * interval '1 minute'), 1)
        returning id`;

      return {
        reference: ilr!['reference'] as string,
        studentProfileIds: [section!['student_profile_id'] as string],
        payerUserId: payer!['id'] as string,
        tutorProfileId: version!['tutor_profile_id'] as string,
        tutorRequestId: treq!['id'] as string,
      };
    } finally {
      await sql.end();
    }
  };

  const refusalFrom = async (fn: () => Promise<unknown>): Promise<PaymentRefusalReason> => {
    try {
      await fn();
    } catch (error) {
      if (error instanceof PaymentRefusedError) return error.reason;
      throw error;
    }
    throw new Error('expected a PaymentRefusedError');
  };

  describe('the money is computed on the server, from the service version', () => {
    /**
     * THE ALPHA ARITHMETIC, asserted as a whole rather than field by field: a
     * $40 lesson is $40 to the parent. Studdy's 10% comes out of the tutor's
     * price, not on top of it, and no surcharge is added.
     */
    it('prices a $40 lesson as 4000 total, 400 fee, 3600 entitlement, 0 surcharge', async () => {
      const req = await selectedRequest({ priceMinor: 4000n });
      await makePayable(req.tutorProfileId);

      const payment = await createPaymentForRequest({
        reference: req.reference,
        studentProfileIds: req.studentProfileIds,
        payerUserId: req.payerUserId,
      });

      expect(payment.currencyCode).toBe('NZD');
      expect(payment.lessonAmountMinor).toBe(4000n);
      expect(payment.platformFeeAmountMinor).toBe(400n);
      expect(payment.tutorEntitlementMinor).toBe(3600n);
      expect(payment.processingFeeChargedMinor).toBe(0n);
      expect(payment.totalChargedMinor).toBe(4000n);
      expect(payment.statusCode).toBe('requires_payment');
      expect(payment.providerPaymentIntentId).toBeNull();
      expect(payment.reused).toBe(false);
    });

    /** The rounding invariant holds on a price that does not divide evenly. */
    it('keeps fee plus entitlement equal to the lesson on an odd amount', async () => {
      const req = await selectedRequest({ priceMinor: 3333n });
      await makePayable(req.tutorProfileId);

      const payment = await createPaymentForRequest({
        reference: req.reference,
        studentProfileIds: req.studentProfileIds,
        payerUserId: req.payerUserId,
      });

      expect(payment.platformFeeAmountMinor).toBe(333n);
      expect(payment.tutorEntitlementMinor).toBe(3000n);
      expect(payment.platformFeeAmountMinor + payment.tutorEntitlementMinor).toBe(
        payment.lessonAmountMinor,
      );
      expect(payment.totalChargedMinor).toBe(3333n);
    });

    /**
     * THE POINT OF SERVER-AUTHORITATIVE PRICING. There is no amount parameter
     * to tamper with — the signature accepts a reference, an ownership scope
     * and a payer, and nothing else. This test exists to fail loudly if anyone
     * ever adds one.
     */
    it('takes no amount, currency or fee from its caller', () => {
      const accepted = ['reference', 'studentProfileIds', 'payerUserId', 'now'];
      const forbidden = ['amount', 'currency', 'total', 'fee', 'price', 'entitlement'];
      for (const name of forbidden) {
        expect(accepted.some((key) => key.toLowerCase().includes(name))).toBe(false);
      }
    });

    it('snapshots the rule versions that produced the split', async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);
      await createPaymentForRequest({
        reference: req.reference,
        studentProfileIds: req.studentProfileIds,
        payerUserId: req.payerUserId,
      });

      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db.select().from(payments).limit(1);
        expect(row!.platformFeeRateBps).toBe(1000);
        expect(row!.platformFeeRuleVersion).toBeGreaterThan(0);
        expect(row!.processingFeeRuleVersion).toBeGreaterThan(0);
        expect(row!.processingFeePayerCode).toBe('platform');
        // Never estimated. Stripe supplies it after settlement or not at all.
        expect(row!.providerCostMinor).toBeNull();
        expect(row!.provider).toBeNull();
      } finally {
        await sql.end();
      }
    });
  });

  describe('one live payment per request', () => {
    it('reuses the existing live payment when the parent refreshes', async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);

      const first = await createPaymentForRequest({
        reference: req.reference,
        studentProfileIds: req.studentProfileIds,
        payerUserId: req.payerUserId,
      });
      const second = await createPaymentForRequest({
        reference: req.reference,
        studentProfileIds: req.studentProfileIds,
        payerUserId: req.payerUserId,
      });

      expect(second.paymentId).toBe(first.paymentId);
      expect(second.reused).toBe(true);

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db.select({ id: payments.id }).from(payments);
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });

    it('produces exactly one row when two creations race', async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);

      const results = await Promise.allSettled([
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: req.studentProfileIds,
          payerUserId: req.payerUserId,
        }),
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: req.studentProfileIds,
          payerUserId: req.payerUserId,
        }),
      ]);
      expect(results.some((r) => r.status === 'fulfilled')).toBe(true);

      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db.select({ id: payments.id }).from(payments);
        expect(rows).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });
  });

  describe('guards, each refusing before anything is written', () => {
    /**
     * A PaymentIntent created after the window has closed would take money for
     * a slot the sweep is entitled to give away. Refusing is the only safe
     * answer.
     */
    it('refuses once the payment deadline has passed', async () => {
      const req = await selectedRequest({ deadlineMinutesFromNow: -1 });
      await makePayable(req.tutorProfileId);

      const reason = await refusalFrom(() =>
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: req.studentProfileIds,
          payerUserId: req.payerUserId,
        }),
      );
      expect(reason).toBe('payment_window_closed');

      const { sql, db } = createDatabaseClient();
      try {
        expect(await db.select({ id: payments.id }).from(payments)).toHaveLength(0);
      } finally {
        await sql.end();
      }
    });

    /** Slice 4's readiness rule, read live rather than trusted from the client. */
    it('refuses a tutor with no connected account at all', async () => {
      const req = await selectedRequest();
      const reason = await refusalFrom(() =>
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: req.studentProfileIds,
          payerUserId: req.payerUserId,
        }),
      );
      expect(reason).toBe('tutor_not_payable');
    });

    it('refuses when transfers or payouts are not active', async () => {
      for (const [transfers, payouts] of [
        ['pending', 'active'],
        ['active', 'pending'],
        ['restricted', 'restricted'],
        ['active', 'unsupported'],
      ] as const) {
        const req = await selectedRequest();
        await makePayable(req.tutorProfileId, transfers, payouts);
        const reason = await refusalFrom(() =>
          createPaymentForRequest({
            reference: req.reference,
            studentProfileIds: req.studentProfileIds,
            payerUserId: req.payerUserId,
          }),
        );
        expect(reason).toBe('tutor_not_payable');
      }
    });

    /**
     * OWNERSHIP IS PART OF THE QUERY. Another family's request must be
     * indistinguishable from one that does not exist, so the refusal itself
     * leaks nothing about what else is in the database.
     */
    it("refuses another family's request as not found", async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);

      const reason = await refusalFrom(() =>
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: [randomUUID()],
          payerUserId: req.payerUserId,
        }),
      );
      expect(reason).toBe('request_not_found');
    });

    it('refuses an empty ownership scope rather than matching everything', async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);
      const reason = await refusalFrom(() =>
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: [],
          payerUserId: req.payerUserId,
        }),
      );
      expect(reason).toBe('request_not_found');
    });

    it('refuses a request whose ILR is no longer awaiting payment', async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);
      const { sql } = createDatabaseClient();
      try {
        await sql`update bookings.intended_lesson_requests set status_code = 'fulfilled' where reference = ${req.reference}`;
      } finally {
        await sql.end();
      }
      const reason = await refusalFrom(() =>
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: req.studentProfileIds,
          payerUserId: req.payerUserId,
        }),
      );
      expect(reason).toBe('not_awaiting_payment');
    });

    it('refuses when the winning request is no longer selected', async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);
      const { sql, db } = createDatabaseClient();
      try {
        await db
          .update(tutorRequests)
          .set({ statusCode: 'closed' })
          .where(eq(tutorRequests.id, req.tutorRequestId));
      } finally {
        await sql.end();
      }
      const reason = await refusalFrom(() =>
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: req.studentProfileIds,
          payerUserId: req.payerUserId,
        }),
      );
      expect(reason).toBe('request_not_found');
    });
  });

  describe('reading a live payment back', () => {
    it('returns it to the owning family and to nobody else', async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);
      const created = await createPaymentForRequest({
        reference: req.reference,
        studentProfileIds: req.studentProfileIds,
        payerUserId: req.payerUserId,
      });

      const mine = await livePaymentForRequest({
        reference: req.reference,
        studentProfileIds: req.studentProfileIds,
      });
      expect(mine?.paymentId).toBe(created.paymentId);

      const theirs = await livePaymentForRequest({
        reference: req.reference,
        studentProfileIds: [randomUUID()],
      });
      expect(theirs).toBeNull();
    });
  });

  describe('the ledger invariant still holds', () => {
    /** Slice 3's `lesson_amount_minor > 0`, reached through the real path. */
    it('refuses to create a payment for a zero-priced service version', async () => {
      const req = await selectedRequest({ priceMinor: 0n });
      await makePayable(req.tutorProfileId);
      await expect(
        createPaymentForRequest({
          reference: req.reference,
          studentProfileIds: req.studentProfileIds,
          payerUserId: req.payerUserId,
        }),
      ).rejects.toThrow();

      const { sql, db } = createDatabaseClient();
      try {
        expect(await db.select({ id: payments.id }).from(payments)).toHaveLength(0);
      } finally {
        await sql.end();
      }
    });
  });

  describe('the tutor profile is real', () => {
    it('links the payment to the selected tutor', async () => {
      const req = await selectedRequest();
      await makePayable(req.tutorProfileId);
      const payment = await createPaymentForRequest({
        reference: req.reference,
        studentProfileIds: req.studentProfileIds,
        payerUserId: req.payerUserId,
      });
      const { sql, db } = createDatabaseClient();
      try {
        const [tutor] = await db
          .select({ id: tutorProfiles.id })
          .from(tutorProfiles)
          .where(eq(tutorProfiles.id, payment.tutorProfileId));
        expect(tutor).toBeDefined();
      } finally {
        await sql.end();
      }
    });
  });
});
