import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  PROVISIONAL_PRICING_RULES,
  computePaymentBreakdown,
  type PricingRules,
} from '@studdy/domain/payments';
import { createDatabaseClient } from '../client';
import { loadPricingRules, setRuleSetting } from '../repositories/rule-settings';
import {
  intendedLessonRequests,
  payments,
  ruleSettings,
  services,
  serviceVersions,
  studentProfiles,
  studentSubjectSections,
  subjects,
  tutorRequests,
  users,
} from '../schema/index';

/**
 * The payment ledger's database-level guarantees.
 *
 * These are the ones that cannot live in TypeScript: the arithmetic CHECKs, the
 * one-live-payment-per-request index, and the fact that every provider column
 * is optional before a provider exists. Each is asserted by trying to write the
 * thing that must be impossible, because a constraint nobody has tried to
 * violate is a constraint nobody knows works.
 *
 * NO PROVIDER IS INVOLVED. Nothing here creates a PaymentIntent, calls Stripe,
 * or needs a key — which is the point of building the ledger before the
 * integration.
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

describe.skipIf(!available)('the payment ledger (integration)', () => {
  /** A real request, tutor request and priced version to hang payments from. */
  interface Anchor {
    readonly intendedLessonRequestId: string;
    readonly tutorRequestId: string;
    readonly serviceVersionId: string;
    readonly payerUserId: string;
    readonly familyAccountId: string | null;
    readonly tutorProfileId: string;
    readonly lessonAmountMinor: bigint;
    readonly currencyCode: string;
  }

  let anchor: Anchor;
  const written: string[] = [];
  let anchorIds: { ilr: string; tutorRequest: string; section: string; student: string } | null =
    null;

  /*
   * The `clean_registration` seed carries users, tutors and priced versions but
   * no requests, so the anchor is built here from those seeded rows.
   *
   * Built with direct inserts rather than through `createIntendedLessonRequest`
   * ON PURPOSE. This suite is about the LEDGER's constraints — the arithmetic
   * CHECKs, the live-payment index, the optional provider columns — and driving
   * a full fan-out to reach them would test the booking fixture instead, which
   * `lesson-requests.integration.test.ts` already does exhaustively.
   */
  beforeAll(async () => {
    const { sql, db } = createDatabaseClient();
    try {
      const [version] = await db
        .select({
          serviceVersionId: serviceVersions.id,
          tutorProfileId: services.tutorProfileId,
          subjectId: services.subjectId,
          lessonAmountMinor: serviceVersions.priceAmountMinor,
          currencyCode: serviceVersions.currencyCode,
          durationMinutes: serviceVersions.durationMinutes,
        })
        .from(serviceVersions)
        .innerJoin(services, eq(serviceVersions.serviceId, services.id))
        .where(eq(serviceVersions.statusCode, 'current'))
        .limit(1);
      if (version === undefined) throw new Error('no seeded service version to price against');

      const [payer] = await db.select({ id: users.id }).from(users).limit(1);
      const [subject] = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.id, version.subjectId))
        .limit(1);
      if (payer === undefined || subject === undefined) {
        throw new Error('seeded user or subject missing');
      }

      const [student] = await db
        .insert(studentProfiles)
        .values({ preferredName: 'Ledger Anchor', independenceStatusCode: 'dependent' })
        .returning({ id: studentProfiles.id });
      const [section] = await db
        .insert(studentSubjectSections)
        .values({ studentProfileId: student!.id, subjectId: subject.id, schoolYearCode: 'Y9' })
        .returning({ id: studentSubjectSections.id });

      const soon = new Date(Date.now() + 48 * 60 * 60_000);
      const [ilr] = await db
        .insert(intendedLessonRequests)
        .values({
          studentSubjectSectionId: section!.id,
          requestedByUserId: payer.id,
          durationMinutes: version.durationMinutes,
          formatCode: 'online',
          timeZone: 'Pacific/Auckland',
          decisionDeadlineAt: soon,
          deadlineRuleVersion: 1,
        })
        .returning({ id: intendedLessonRequests.id });
      const [tutorRequest] = await db
        .insert(tutorRequests)
        .values({
          intendedLessonRequestId: ilr!.id,
          tutorProfileId: version.tutorProfileId,
          serviceVersionId: version.serviceVersionId,
          position: 1,
          respondByAt: soon,
          deadlineRuleVersion: 1,
        })
        .returning({ id: tutorRequests.id });

      anchorIds = {
        ilr: ilr!.id,
        tutorRequest: tutorRequest!.id,
        section: section!.id,
        student: student!.id,
      };
      anchor = {
        intendedLessonRequestId: ilr!.id,
        tutorRequestId: tutorRequest!.id,
        serviceVersionId: version.serviceVersionId,
        payerUserId: payer.id,
        familyAccountId: null,
        tutorProfileId: version.tutorProfileId,
        lessonAmountMinor: version.lessonAmountMinor,
        currencyCode: version.currencyCode,
      };
    } finally {
      await sql.end();
    }
  });

  /*
   * One anchor, cleared between tests.
   *
   * The live-payment index is a per-REQUEST guarantee, so every test that
   * writes a payment would otherwise collide with the previous one — which is
   * the constraint working, but it makes each test depend on what ran before.
   */
  beforeEach(async () => {
    if (anchorIds === null) return;
    const { sql } = createDatabaseClient();
    try {
      await sql`delete from payments.payments where intended_lesson_request_id = ${anchorIds.ilr}`;
    } finally {
      await sql.end();
    }
  });

  afterAll(async () => {
    if (anchorIds === null) return;
    const { sql } = createDatabaseClient();
    try {
      // Payments restrict deletion of what they point at, so they go first.
      await sql`delete from payments.payments where intended_lesson_request_id = ${anchorIds.ilr}`;
      await sql`delete from bookings.tutor_requests where id = ${anchorIds.tutorRequest}`;
      await sql`delete from bookings.intended_lesson_requests where id = ${anchorIds.ilr}`;
      await sql`delete from students.student_subject_sections where id = ${anchorIds.section}`;
      await sql`delete from students.student_profiles where id = ${anchorIds.student}`;
    } finally {
      await sql.end();
    }
  });

  /** A payment row priced by the domain, with everything the ledger needs. */
  const rowFor = (
    overrides: Partial<typeof payments.$inferInsert> = {},
    rules: PricingRules = PROVISIONAL_PRICING_RULES,
  ): typeof payments.$inferInsert => {
    const split = computePaymentBreakdown({
      lessonAmountMinor: anchor.lessonAmountMinor,
      currencyCode: anchor.currencyCode,
      rules,
    });
    return {
      intendedLessonRequestId: anchor.intendedLessonRequestId,
      tutorRequestId: anchor.tutorRequestId,
      serviceVersionId: anchor.serviceVersionId,
      payerUserId: anchor.payerUserId,
      familyAccountId: anchor.familyAccountId,
      tutorProfileId: anchor.tutorProfileId,
      currencyCode: split.currencyCode,
      lessonAmountMinor: split.lessonAmountMinor,
      platformFeeRateBps: split.platformFeeRateBps,
      platformFeeRuleVersion: 1,
      platformFeeAmountMinor: split.platformFeeAmountMinor,
      tutorEntitlementMinor: split.tutorEntitlementMinor,
      processingFeePayerCode: split.processingFeePayer,
      processingFeeRuleVersion: 1,
      processingFeeChargedMinor: split.processingFeeChargedMinor,
      totalChargedMinor: split.totalChargedMinor,
      paymentDeadlineAt: new Date(Date.now() + 60 * 60_000),
      ...overrides,
    };
  };

  const insert = async (row: typeof payments.$inferInsert): Promise<string> => {
    const { sql, db } = createDatabaseClient();
    try {
      const [inserted] = await db
        .insert(payments)
        .values(row)
        .returning({ reference: payments.reference });
      written.push(inserted!.reference);
      return inserted!.reference;
    } finally {
      await sql.end();
    }
  };

  describe('a payment records what money was supposed to move', () => {
    it('stores the split the domain computed, with a PAY- reference', async () => {
      const reference = await insert(rowFor());
      expect(reference).toMatch(/^PAY-\d{8}$/);

      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db.select().from(payments).where(eq(payments.reference, reference));
        expect(row!.lessonAmountMinor).toBe(
          row!.platformFeeAmountMinor + row!.tutorEntitlementMinor,
        );
        expect(row!.totalChargedMinor).toBe(
          row!.lessonAmountMinor + row!.processingFeeChargedMinor,
        );
        expect(row!.statusCode).toBe('requires_payment');
      } finally {
        await sql.end();
      }
    });

    /**
     * EVERY PROVIDER COLUMN IS OPTIONAL BEFORE A PROVIDER EXISTS. If any were
     * required, this slice could not migrate without Stripe — which is the
     * whole reason the ledger is built first.
     */
    it('writes with no provider identifiers at all', async () => {
      const reference = await insert(rowFor());
      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db.select().from(payments).where(eq(payments.reference, reference));
        expect(row!.provider).toBeNull();
        expect(row!.providerPaymentIntentId).toBeNull();
        expect(row!.providerChargeId).toBeNull();
        expect(row!.providerBalanceTransactionId).toBeNull();
        // Never estimated: absent until the provider says otherwise.
        expect(row!.providerCostMinor).toBeNull();
      } finally {
        await sql.end();
      }
    });

    /** Tax is recorded, never computed. Both columns stay empty at launch. */
    it('leaves tax metadata unset', async () => {
      const reference = await insert(rowFor());
      const { sql, db } = createDatabaseClient();
      try {
        const [row] = await db.select().from(payments).where(eq(payments.reference, reference));
        expect(row!.taxTreatmentCode).toBeNull();
        expect(row!.taxMetadata).toBeNull();
      } finally {
        await sql.end();
      }
    });
  });

  describe('wrong money is unrepresentable', () => {
    const refuses = async (row: typeof payments.$inferInsert): Promise<void> => {
      const { sql, db } = createDatabaseClient();
      try {
        await expect(db.insert(payments).values(row)).rejects.toThrow();
      } finally {
        await sql.end();
      }
    };

    it('refuses a fee and entitlement that do not sum to the lesson', async () => {
      await refuses(rowFor({ platformFeeAmountMinor: 1n }));
    });

    it('refuses a total that is not the lesson plus the disclosed fee', async () => {
      await refuses(rowFor({ totalChargedMinor: 1n }));
    });

    /**
     * Absorbing the cost means charging the parent NOTHING. The policy and the
     * number cannot be allowed to disagree, whatever writes them.
     */
    it('refuses a parent charge while the platform is absorbing', async () => {
      await refuses(
        rowFor({
          processingFeePayerCode: 'platform',
          processingFeeChargedMinor: 138n,
          totalChargedMinor: anchor.lessonAmountMinor + 138n,
        }),
      );
    });

    it('refuses negative money', async () => {
      await refuses(rowFor({ providerCostMinor: -1n }));
    });

    it('refuses a fee rate outside 0-10000 basis points', async () => {
      await refuses(rowFor({ platformFeeRateBps: 10_001 }));
    });

    it('refuses an unknown status and an unknown fee payer', async () => {
      await refuses(rowFor({ statusCode: 'refunded' }));
      await refuses(rowFor({ processingFeePayerCode: 'somebody_else' }));
    });

    it('refuses a currency code that is not ISO 4217 shaped', async () => {
      await refuses(rowFor({ currencyCode: 'nz1' }));
    });
  });

  describe('one live payment per request', () => {
    /**
     * THE DOUBLE-PAYMENT GUARD, and a database constraint rather than a code
     * path so no caller can forget it.
     */
    it('refuses a second live payment for the same request', async () => {
      await insert(rowFor());
      const { sql, db } = createDatabaseClient();
      try {
        await expect(db.insert(payments).values(rowFor())).rejects.toThrow();
      } finally {
        await sql.end();
      }
    });

    it('refuses a second payment once one has succeeded', async () => {
      const reference = await insert(rowFor({ statusCode: 'succeeded', succeededAt: new Date() }));
      expect(reference).toMatch(/^PAY-/);
      const { sql, db } = createDatabaseClient();
      try {
        await expect(db.insert(payments).values(rowFor())).rejects.toThrow();
      } finally {
        await sql.end();
      }
    });

    /**
     * A GENUINELY FAILED PAYMENT DOES NOT BLOCK A FRESH ATTEMPT.
     *
     * The three terminal failures sit outside the index deliberately. Ordinary
     * recoverable declines never reach them — those leave the row
     * `requires_payment` and increment `failed_attempt_count`, so the family
     * retries the same payment rather than creating a second row — but an
     * unrecoverable failure must not strand a family whose window is still open.
     */
    it('allows a new payment after a failed, cancelled or expired one', async () => {
      for (const terminal of ['failed', 'cancelled', 'expired'] as const) {
        const { sql } = createDatabaseClient();
        try {
          await sql`delete from payments.payments
                     where intended_lesson_request_id = ${anchor.intendedLessonRequestId}`;
        } finally {
          await sql.end();
        }
        await insert(rowFor({ statusCode: terminal }));
        // A fresh attempt is accepted rather than colliding.
        await expect(insert(rowFor())).resolves.toMatch(/^PAY-/);
      }
    });

    it('counts declines without changing status, so retries make no second row', async () => {
      const reference = await insert(rowFor());
      const { sql, db } = createDatabaseClient();
      try {
        await db
          .update(payments)
          .set({ failedAttemptCount: 2, lastFailureCode: 'card_declined' })
          .where(eq(payments.reference, reference));

        const [row] = await db.select().from(payments).where(eq(payments.reference, reference));
        expect(row!.statusCode).toBe('requires_payment');
        expect(row!.failedAttemptCount).toBe(2);

        const live = await db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.intendedLessonRequestId, anchor.intendedLessonRequestId),
              eq(payments.statusCode, 'requires_payment'),
            ),
          );
        expect(live).toHaveLength(1);
      } finally {
        await sql.end();
      }
    });
  });

  describe('pricing rules are versioned per key', () => {
    it('seeds the rate and the payer policy, and not a disclosed fee', async () => {
      const loaded = await loadPricingRules();
      expect(loaded.rules.platformFeeRateBps).toBe(1000);
      expect(loaded.rules.processingFeePayer).toBe('platform');
      // Never seeded: it has no meaning while Studdy absorbs the cost.
      expect(loaded.rules.disclosedProcessingFeeMinor).toBeNull();
      expect(loaded.platformFeeRuleVersion).toBeGreaterThan(0);
      expect(loaded.processingFeeRuleVersion).toBeGreaterThan(0);
    });

    /**
     * THE SLICE 1 LESSON, APPLIED HERE BEFORE IT COULD BE REPEATED.
     *
     * `rule_settings` versions PER KEY, so the rate and the policy move
     * independently. A payment snapshots one version for each; a single
     * "pricing rule version" could not say which policy applied when the rate
     * last changed.
     */
    it('moves one rule version without moving the other', async () => {
      const before = await loadPricingRules();
      await setRuleSetting(
        'payments.platform_fee_rate_bps',
        1000,
        'integration probe: independence of pricing rule versions',
      );
      const after = await loadPricingRules();

      expect(after.platformFeeRuleVersion).toBe(before.platformFeeRuleVersion + 1);
      expect(after.processingFeeRuleVersion).toBe(before.processingFeeRuleVersion);

      // Leave the configuration as the seed left it.
      const { sql } = createDatabaseClient();
      try {
        await sql`delete from platform.rule_settings
                   where setting_key = 'payments.platform_fee_rate_bps'
                     and version_number = ${after.platformFeeRuleVersion}`;
        await sql`update platform.rule_settings set status_code = 'current', superseded_at = null
                   where setting_key = 'payments.platform_fee_rate_bps'
                     and version_number = ${before.platformFeeRuleVersion}`;
      } finally {
        await sql.end();
      }
    });

    it('keeps the two keys as separate rows', async () => {
      const { sql, db } = createDatabaseClient();
      try {
        const rows = await db
          .select({ key: ruleSettings.settingKey })
          .from(ruleSettings)
          .where(eq(ruleSettings.statusCode, 'current'));
        const keys = rows.map((row) => row.key);
        expect(keys).toContain('payments.platform_fee_rate_bps');
        expect(keys).toContain('payments.processing_fee_payer');
        expect(keys).not.toContain('payments.disclosed_processing_fee_minor');
      } finally {
        await sql.end();
      }
    });
  });
});
