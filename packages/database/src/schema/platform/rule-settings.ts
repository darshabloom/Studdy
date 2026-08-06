import { sql } from 'drizzle-orm';
import { check, jsonb, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { platformSchema } from '../shared/schemas';

/**
 * `platform.rule_settings` — versioned platform configuration.
 *
 * Deadlines, hold lifetimes, the fan-out cap and the card-on-file gate live
 * here rather than in constants, so they are admin-configurable later without
 * a deploy. Values are VERSIONED: a new value inserts a new version and
 * supersedes the previous one; existing records keep whatever deadline was
 * snapshotted onto them at the time (approved decision 5), so changing
 * configuration never retroactively moves a deadline a tutor was given.
 */
export const ruleSettings = platformSchema.table(
  'rule_settings',
  {
    ...standardColumns,
    /** Dotted key, e.g. `requests.fan_out_cap`. */
    settingKey: text('setting_key').notNull(),
    versionNumber: integer('version_number').notNull().default(1),
    /** JSON so a setting can be a number, a duration table or a flag. */
    value: jsonb('value').notNull(),
    statusCode: text('status_code').notNull().default('current'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    /** Why this value exists — provisional seeds say so explicitly. */
    provenanceNote: text('provenance_note'),
  },
  (table) => [
    check('rule_settings_status_check', sql`${table.statusCode} in ('current', 'superseded')`),
    // Exactly one current version per key.
    uniqueIndex('rule_settings_current_unique_idx')
      .on(table.settingKey)
      .where(sql`${table.statusCode} = 'current'`),
    uniqueIndex('rule_settings_key_version_unique_idx').on(table.settingKey, table.versionNumber),
  ],
);
