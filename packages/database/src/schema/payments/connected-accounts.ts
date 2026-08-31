import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { standardColumns } from '../shared/columns';
import { paymentsSchema } from '../shared/schemas';
import { tutorProfiles } from '../tutors/tutor-profiles';

/**
 * `payments.connected_accounts` — a Studdy tutor's provider payout account.
 *
 * Deferred out of slice 3 on purpose, because its shape is dictated entirely by
 * Connect onboarding and guessing it early would have produced columns that
 * matched nothing. It lands now, grounded in the installed Stripe SDK's own
 * Account type rather than in memory of the API.
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
 * `account.updated` — and the readiness rule in `@studdy/domain` reads them.
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
     * UNIQUE, which is what makes webhook routing safe: an `account.updated`
     * event is applied by looking this up, so an event can only ever touch the
     * one row that genuinely owns that account id.
     *
     * NEVER family- or tutor-facing. It appears in no projection, no URL and no
     * log line.
     */
    providerAccountId: text('provider_account_id').notNull().unique(),
    /**
     * `express` for Studdy. Stored rather than assumed because the account type
     * decides what onboarding and dashboard access mean, and a future account
     * created under a different type must not be silently read as this one.
     */
    accountTypeCode: text('account_type_code').notNull(),

    // --- payability, as the provider reports it ----------------------------
    /**
     * `not_onboarded | pending | complete | restricted` — derived from the
     * fields below by the domain rule, then stored so a list of tutors can be
     * filtered without recomputing per row.
     */
    statusCode: text('status_code').notNull().default('not_onboarded'),
    /**
     * Whether the CONNECTED account may create its own charges.
     *
     * RECORDED, NOT USED AS A GATE. Studdy uses separate charges and transfers,
     * so the parent's charge is created on the platform account and this flag
     * decides nothing about payability. It is kept because it costs nothing and
     * tells support what Stripe thinks. See `canTutorReceivePayments`.
     */
    chargesEnabled: boolean('charges_enabled').notNull().default(false),
    /** Whether Stripe will pay out to the tutor's bank. A real gate. */
    payoutsEnabled: boolean('payouts_enabled').notNull().default(false),
    /**
     * The `transfers` capability: `active | inactive | pending`.
     *
     * THE PRIMARY GATE. Without it active, a Transfer to this account is
     * refused, so the tutor cannot be paid however complete everything else is.
     */
    transfersCapabilityCode: text('transfers_capability_code').notNull().default('inactive'),
    /**
     * Whether the tutor finished submitting the onboarding form.
     *
     * NOT a payability signal, and deliberately not treated as one — Stripe can
     * accept a submission and still withhold the capability pending review.
     * Useful only for telling a tutor whether to expect a wait or an action.
     */
    detailsSubmitted: boolean('details_submitted').notNull().default(false),

    // --- what Stripe still wants -------------------------------------------
    /**
     * Requirement IDENTIFIERS Stripe is waiting on, e.g.
     * `["individual.id_number"]`. Identifiers only — never the values, which
     * are the tutor's identity documents and never reach Studdy.
     *
     * Genuinely useful rather than stored for completeness: it is what lets the
     * tutor's screen say "Stripe still needs your ID" instead of "something is
     * wrong", and lets support answer the same question without opening Stripe.
     */
    requirementsCurrentlyDue: jsonb('requirements_currently_due')
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Requirement identifiers already past their deadline. Drives `restricted`. */
    requirementsPastDue: jsonb('requirements_past_due')
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Stripe's own reason the account is disabled, when it is. Never a payload. */
    requirementsDisabledReason: text('requirements_disabled_reason'),
    /** When the currently-due requirements stop being optional. */
    requirementsCurrentDeadline: timestamp('requirements_current_deadline', { withTimezone: true }),

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
     * retries freely, so a stale `account.updated` can arrive after a newer one.
     * Applying it would silently roll payability backwards — the tutor becomes
     * unpayable because of an event describing a state they already left.
     * Updates compare against this and drop anything older.
     */
    lastProviderEventAt: timestamp('last_provider_event_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'connected_account_status_check',
      sql`${table.statusCode} in ('not_onboarded', 'pending', 'complete', 'restricted')`,
    ),
    check('connected_account_type_check', sql`${table.accountTypeCode} in ('express')`),
    check(
      'connected_account_transfers_capability_check',
      sql`${table.transfersCapabilityCode} in ('active', 'inactive', 'pending')`,
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
