import { and, eq } from 'drizzle-orm';
import { PROVISIONAL_REQUEST_RULES, RULE_KEYS, type RequestRules } from '@studdy/domain/bookings';
import {
  PAYMENT_RULE_KEYS,
  PRICING_RULE_KEYS,
  PROVISIONAL_PAYMENT_WINDOW_RULES,
  PROVISIONAL_PRICING_RULES,
  type PaymentWindowRules,
  type PricingRules,
  type ProcessingFeePayer,
} from '@studdy/domain/payments';
import { createDatabaseClient } from '../client';
import { ruleSettings } from '../schema/index';

export interface LoadedRequestRules {
  readonly rules: RequestRules;
  /**
   * The version of the deadline configuration these rules came from. Snapshotted
   * onto every record whose deadline is calculated from them, so a later
   * configuration change never moves an existing deadline.
   */
  readonly deadlineRuleVersion: number;
}

type Reader = Pick<ReturnType<typeof createDatabaseClient>['db'], 'select'>;

/**
 * Load the current rule settings, falling back to the provisional constants
 * for any key that has not been seeded. The version returned is that of the
 * response-tier setting, since that is what produces the deadlines we snapshot.
 */
export async function loadRequestRules(reader?: Reader): Promise<LoadedRequestRules> {
  const client = reader === undefined ? createDatabaseClient() : null;
  const db = reader ?? client!.db;
  try {
    const rows = await db
      .select({
        key: ruleSettings.settingKey,
        value: ruleSettings.value,
        version: ruleSettings.versionNumber,
      })
      .from(ruleSettings)
      .where(eq(ruleSettings.statusCode, 'current'));

    const byKey = new Map(rows.map((row) => [row.key, row]));
    const read = <T>(key: string, fallback: T): T => {
      const row = byKey.get(key);
      return row === undefined ? fallback : (row.value as T);
    };

    const rules: RequestRules = {
      fanOutCap: read(RULE_KEYS.fanOutCap, PROVISIONAL_REQUEST_RULES.fanOutCap),
      responseTiers: read(RULE_KEYS.responseTiers, PROVISIONAL_REQUEST_RULES.responseTiers),
      decisionGraceHours: read(
        RULE_KEYS.decisionGraceHours,
        PROVISIONAL_REQUEST_RULES.decisionGraceHours,
      ),
      minimumNoticeHours: read(
        RULE_KEYS.minimumNoticeHours,
        PROVISIONAL_REQUEST_RULES.minimumNoticeHours,
      ),
      requirePaymentMethodBeforeSend: read(
        RULE_KEYS.requirePaymentMethod,
        PROVISIONAL_REQUEST_RULES.requirePaymentMethodBeforeSend,
      ),
      minTimeOptions: read(RULE_KEYS.minTimeOptions, PROVISIONAL_REQUEST_RULES.minTimeOptions),
      maxTimeOptions: read(RULE_KEYS.maxTimeOptions, PROVISIONAL_REQUEST_RULES.maxTimeOptions),
      acceptanceHoldHours: read(
        RULE_KEYS.acceptanceHoldHours,
        PROVISIONAL_REQUEST_RULES.acceptanceHoldHours,
      ),
      acceptanceHoldCutoffBeforeLessonHours: read(
        RULE_KEYS.acceptanceHoldCutoffBeforeLessonHours,
        PROVISIONAL_REQUEST_RULES.acceptanceHoldCutoffBeforeLessonHours,
      ),
    };

    return {
      rules,
      deadlineRuleVersion: byKey.get(RULE_KEYS.responseTiers)?.version ?? 0,
    };
  } finally {
    if (client !== null) await client.sql.end();
  }
}

export interface LoadedPaymentWindowRules {
  readonly rules: PaymentWindowRules;
  /**
   * ONE VERSION PER RULE, not one for the pair.
   *
   * `rule_settings` versions PER KEY: `setRuleSetting` increments from that
   * key's own current row, and uniqueness is `(setting_key, version_number)`.
   * Nothing in the model ties two keys to a shared ruleset version, so the
   * window can sit at v3 while the cutoff is still v1. A single number taken
   * from either key would silently claim to describe a decision that half of
   * it had no part in — and a support question months later would get a
   * confident wrong answer rather than no answer.
   */
  readonly windowRuleVersion: number;
  readonly nearLessonCutoffRuleVersion: number;
}

/**
 * Load the payment window configuration.
 *
 * Separate from `loadRequestRules` rather than folded into it, because the two
 * are snapshotted onto different columns at different moments — the response
 * deadline at send, the payment deadline at selection — and one combined
 * version number could not honestly describe either.
 *
 * Accepts a reader so selection can load inside its own transaction and see a
 * consistent view of configuration.
 */
export async function loadPaymentWindowRules(reader?: Reader): Promise<LoadedPaymentWindowRules> {
  const client = reader === undefined ? createDatabaseClient() : null;
  const db = reader ?? client!.db;
  try {
    const rows = await db
      .select({
        key: ruleSettings.settingKey,
        value: ruleSettings.value,
        version: ruleSettings.versionNumber,
      })
      .from(ruleSettings)
      .where(eq(ruleSettings.statusCode, 'current'));

    const byKey = new Map(rows.map((row) => [row.key, row]));
    const read = <T>(key: string, fallback: T): T => {
      const row = byKey.get(key);
      return row === undefined ? fallback : (row.value as T);
    };

    return {
      rules: {
        windowMinutes: read(
          PAYMENT_RULE_KEYS.windowMinutes,
          PROVISIONAL_PAYMENT_WINDOW_RULES.windowMinutes,
        ),
        nearLessonCutoffMinutes: read(
          PAYMENT_RULE_KEYS.nearLessonCutoffMinutes,
          PROVISIONAL_PAYMENT_WINDOW_RULES.nearLessonCutoffMinutes,
        ),
      },
      windowRuleVersion: byKey.get(PAYMENT_RULE_KEYS.windowMinutes)?.version ?? 0,
      nearLessonCutoffRuleVersion:
        byKey.get(PAYMENT_RULE_KEYS.nearLessonCutoffMinutes)?.version ?? 0,
    };
  } finally {
    if (client !== null) await client.sql.end();
  }
}

export interface LoadedPricingRules {
  readonly rules: PricingRules;
  /**
   * ONE VERSION PER RULE, for the same reason the payment window carries two.
   *
   * `rule_settings` versions PER KEY, so the fee rate can sit at v3 while the
   * payer policy is still v1. A payment snapshots both, because a single
   * "pricing rule version" could not say which policy applied when the rate
   * last moved — and a support question a year later would get a confident
   * wrong answer rather than no answer.
   */
  readonly platformFeeRuleVersion: number;
  readonly processingFeeRuleVersion: number;
}

/**
 * Load the pricing configuration.
 *
 * Falls back to the provisional constants for any key not yet seeded, exactly
 * as the request rules do, so a fresh database prices correctly before anybody
 * has configured anything.
 */
export async function loadPricingRules(reader?: Reader): Promise<LoadedPricingRules> {
  const client = reader === undefined ? createDatabaseClient() : null;
  const db = reader ?? client!.db;
  try {
    const rows = await db
      .select({
        key: ruleSettings.settingKey,
        value: ruleSettings.value,
        version: ruleSettings.versionNumber,
      })
      .from(ruleSettings)
      .where(eq(ruleSettings.statusCode, 'current'));

    const byKey = new Map(rows.map((row) => [row.key, row]));
    const read = <T>(key: string, fallback: T): T => {
      const row = byKey.get(key);
      return row === undefined ? fallback : (row.value as T);
    };

    /*
     * The disclosed fee is read but NOT seeded. It has no meaning while Studdy
     * absorbs processing costs, and the pricing domain refuses to charge a
     * parent-paid fee that has not been configured — so enabling the policy
     * without setting an amount fails loudly rather than inventing one.
     *
     * JSON numbers arrive as `number`; money is a bigint everywhere else, so it
     * is converted here at the boundary rather than leaking a float inward.
     */
    const disclosed = read<number | null>(PRICING_RULE_KEYS.disclosedProcessingFeeMinor, null);

    return {
      rules: {
        platformFeeRateBps: read(
          PRICING_RULE_KEYS.platformFeeRateBps,
          PROVISIONAL_PRICING_RULES.platformFeeRateBps,
        ),
        processingFeePayer: read<ProcessingFeePayer>(
          PRICING_RULE_KEYS.processingFeePayer,
          PROVISIONAL_PRICING_RULES.processingFeePayer,
        ),
        disclosedProcessingFeeMinor: disclosed === null ? null : BigInt(disclosed),
      },
      platformFeeRuleVersion: byKey.get(PRICING_RULE_KEYS.platformFeeRateBps)?.version ?? 0,
      processingFeeRuleVersion: byKey.get(PRICING_RULE_KEYS.processingFeePayer)?.version ?? 0,
    };
  } finally {
    if (client !== null) await client.sql.end();
  }
}

/** Supersede the current version of a setting and insert a new one. */
export async function setRuleSetting(
  settingKey: string,
  value: unknown,
  provenanceNote: string,
): Promise<number> {
  const { sql, db } = createDatabaseClient();
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: ruleSettings.id, version: ruleSettings.versionNumber })
        .from(ruleSettings)
        .where(
          and(eq(ruleSettings.settingKey, settingKey), eq(ruleSettings.statusCode, 'current')),
        );

      if (current !== undefined) {
        await tx
          .update(ruleSettings)
          .set({ statusCode: 'superseded', supersededAt: new Date(), updatedAt: new Date() })
          .where(and(eq(ruleSettings.id, current.id), eq(ruleSettings.statusCode, 'current')));
      }

      const nextVersion = (current?.version ?? 0) + 1;
      await tx.insert(ruleSettings).values({
        settingKey,
        versionNumber: nextVersion,
        value,
        provenanceNote,
      });
      return nextVersion;
    });
  } finally {
    await sql.end();
  }
}
