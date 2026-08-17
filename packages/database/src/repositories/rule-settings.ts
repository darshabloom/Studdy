import { and, eq } from 'drizzle-orm';
import { PROVISIONAL_REQUEST_RULES, RULE_KEYS, type RequestRules } from '@studdy/domain/bookings';
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
