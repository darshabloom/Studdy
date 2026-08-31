import { sql } from 'drizzle-orm';
import { check, index, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { paymentsSchema } from '../shared/schemas';
import { tutorProfiles } from '../tutors/tutor-profiles';

/**
 * `payments.connected_accounts` — a Studdy tutor's provider payout account.
 *
 * Deferred out of slice 3 on purpose, because its shape is dictated entirely by
 * Connect onboarding and guessing it early would have produced columns that
 * matched nothing. It lands now, grounded in the installed Stripe SDK's own
 * ACCOUNTS V2 types rather than in memory of the v1 API.
 *
 * MODELLED ON ACCOUNTS V2, WHICH IS NOT A DETAIL. Stripe refuses v1 account
 * creation for new Connect platforms, and v1's `charges_enabled` /
 * `payouts_enabled` booleans do not exist in v2 at all — payability is carried
 * by CAPABILITY STATUSES on a recipient configuration. Those columns are absent
 * here rather than retained: this table has never held a production row, so
 * there is nothing to be backwards compatible with, and a boolean Studdy could
 * never populate would be a lie in the schema.
 *
 * WHAT THIS TABLE IS NOT: a copy of the Stripe account. Identity and KYC data —
 * names, dates of birth, addresses, document numbers — are Stripe's to hold and
 * Studdy's to never receive. What is mirrored here is only what Studdy decides
 * with: whether the tutor is payable, and what to tell them if not.
 *
 * SERVER-ONLY, with no browser policy and no grant. `provider_account_id` is the
 * one column that would be most damaging to leak, and a tutor never needs to see
 * their own — Studdy talks to Stripe on their behalf, and the tutor's own screen
 * shows a status, not an identifier.
 *
 * EVERY PAYABILITY FIELD IS PROVIDER-AUTHORITATIVE. Nothing here is set from a
 * browser, a form, or the fact that somebody returned to a success URL. The
 * values arrive from Stripe — read directly after onboarding, and refreshed by
 * the v2 recipient events — and the readiness rule in `@studdy/domain` reads them.
 */
export const connectedAccounts = paymentsSchema.table(
  'connected_accounts',
  {
    ...standardColumns,

    /** The Studdy tutor this account pays. The only link to a person. */
    tutorProfileId: uuid('tutor_profile_id')
      .notNull()
      .references(() => tutorProfiles.id, { onDelete: 'restrict' }),

    // --- provider identity -------------------------------------------------
    /** `stripe`. A column rather than an assumption, as everywhere else. */
    provider: text('provider').notNull(),
    /**
     * The provider's account id (`acct_...`).
     *
     * UNIQUE, which is what makes webhook routing safe: a Connect event is
     * applied by looking this up, so an event can only ever touch the one row
     * that genuinely owns that account id.
     *
     * NEVER family- or tutor-facing. It appears in no projection, no URL and no
     * log line.
     */
    providerAccountId: text('provider_account_id').notNull().unique(),
    /**
     * The Stripe dashboard experience: `express` for Studdy.
     *
     * In Accounts v2 this is a property of the account rather than an account
     * "type", which is why the column is named for the dashboard rather than
     * for a type that no longer exists. Stored rather than assumed, because it
     * decides what onboarding and dashboard access mean.
     */
    dashboardCode: text('dashboard_code').notNull(),
    /**
     * The v2 configuration the tutor is onboarded under: `recipient`.
     *
     * Recorded because it is the load-bearing architectural choice. A recipient
     * receives funds and is NOT the merchant of record, which is exactly
     * separate charges and transfers. A `merchant` configuration would mean the
     * opposite money flow, and a row claiming one must never be read as the
     * other.
     */
    configurationCode: text('configuration_code').notNull(),
    /** ISO 3166-1 alpha-2, as Stripe holds it. NZ at launch. */
    countryCode: text('country_code'),

    // --- payability, as the provider reports it ----------------------------
    /**
     * `not_onboarded | pending | complete | restricted` — derived from the
     * capability statuses below by the domain rule, then stored so a list of
     * tutors can be filtered without recomputing per row.
     */
    statusCode: text('status_code').notNull().default('not_onboarded'),
    /**
     * `stripe_balance.stripe_transfers`: `active | pending | restricted | unsupported`.
     *
     * THE PRIMARY GATE. Without it active, a transfer INTO this account is
     * refused, so the tutor cannot be paid however complete everything else is.
     */
    transfersCapabilityCode: text('transfers_capability_code').notNull().default('unsupported'),
    /**
     * `stripe_balance.payouts`: same status enum.
     *
     * ALSO A GATE. Without it, money reaches the tutor's Stripe balance and
     * stops there — Studdy would have taken a parent's money for a tutor who
     * cannot actually be paid.
     *
     * There is deliberately NO `charges_enabled` equivalent. v2 does not expose
     * one, and it would gate nothing if it did: under separate charges and
     * transfers the connected account never creates the parent's charge.
     */
    payoutsCapabilityCode: text('payouts_capability_code').notNull().default('unsupported'),

    // --- why a capability is not active ------------------------------------
    /**
     * Stripe's machine-readable reason codes, as
     * `[{ capability, code, resolution }]`.
     *
     * A PRIVACY IMPROVEMENT v2 hands Studdy for free. v1 required storing
     * requirement IDENTIFIERS — `individual.verification.document` — to say
     * anything useful. v2's codes say `requirements_past_due` without naming
     * which identity document is outstanding, and `resolution` says whether the
     * tutor can fix it themselves at all.
     *
     * Genuinely useful rather than stored for completeness: it is what lets the
     * tutor's screen distinguish "Stripe is still checking" from "Stripe needs
     * something from you" from "only Stripe can resolve this".
     */
    capabilityStatusDetails: jsonb('capability_status_details')
      .notNull()
      .default(sql`'[]'::jsonb`),

    // --- timeline ----------------------------------------------------------
    /** When Studdy first created the account for this tutor. */
    onboardingStartedAt: timestamp('onboarding_started_at', { withTimezone: true }),
    /** When the tutor first became payable. Set once, never cleared on a later restriction. */
    onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
    /**
     * When Studdy last read authoritative state from the provider.
     *
     * Distinguishes "Stripe says not payable" from "Studdy has not asked yet",
     * which are the same row otherwise and very different situations.
     */
    providerSyncedAt: timestamp('provider_synced_at', { withTimezone: true }),
    /**
     * The `created` timestamp of the newest provider event applied to this row.
     *
     * THE OUT-OF-ORDER GUARD. Webhook delivery is not ordered, and Stripe
     * retries freely, so a stale event can arrive after a newer one. Applying
     * it would silently roll payability backwards — the tutor becomes unpayable
     * because of an event describing a state they already left. Updates compare
     * against this and drop anything older.
     */
    lastProviderEventAt: timestamp('last_provider_event_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'connected_account_status_check',
      sql`${table.statusCode} in ('not_onboarded', 'pending', 'complete', 'restricted')`,
    ),
    check('connected_account_dashboard_check', sql`${table.dashboardCode} in ('express')`),
    /*
     * `recipient` only, and the constraint says so.
     *
     * Not defensive tidiness: a `merchant` configuration would make the tutor
     * the merchant of record and invert the approved money flow. If that ever
     * becomes a product decision it should require a migration and a
     * conversation, not a different string reaching an insert.
     */
    check(
      'connected_account_configuration_check',
      sql`${table.configurationCode} in ('recipient')`,
    ),
    /*
     * THE ACCOUNTS V2 CAPABILITY STATUS ENUM, not v1's.
     *
     * v2 distinguishes `restricted` (usually the tutor's to fix) from
     * `unsupported` (usually not), where v1 had one `inactive`. Carrying v1's
     * values forward would let a status Studdy cannot act on be written as one
     * it can.
     */
    check(
      'connected_account_transfers_capability_check',
      sql`${table.transfersCapabilityCode} in ('active', 'pending', 'restricted', 'unsupported')`,
    ),
    check(
      'connected_account_payouts_capability_check',
      sql`${table.payoutsCapabilityCode} in ('active', 'pending', 'restricted', 'unsupported')`,
    ),
    /*
     * ONE LIVE ACCOUNT PER TUTOR, enforced by the database rather than by the
     * code path that creates them.
     *
     * This is what makes "start onboarding" idempotent under a double-click or
     * a retried request: a second insert for the same tutor collides instead of
     * quietly creating a second Stripe account that nobody will ever transfer
     * to. Archived rows are outside the index, so an account that had to be
     * replaced does not block its replacement.
     */
    uniqueIndex('connected_account_live_per_tutor_unique_idx')
      .on(table.tutorProfileId)
      .where(sql`${table.archivedAt} is null`),
    index('connected_account_tutor_idx').on(table.tutorProfileId),
    // Operational: which tutors are stuck, without scanning every row.
    index('connected_account_status_idx')
      .on(table.statusCode)
      .where(sql`${table.archivedAt} is null`),
  ],
);
