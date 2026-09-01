# Payments and the first paid booking — approved design

**Status: APPROVED. Slices 1–6 are implemented; §§7–8 and §16's slice 6 row now describe
AS-BUILT behaviour, corrected on 2026-09-02 where implementation proved the original draft
wrong.** The three corrections worth knowing, each marked in place: Connect readiness is
Accounts v2 capability statuses and there is no `charges_enabled` (§3); a late success after
the sweep is recorded and flagged for refund rather than re-taking the reservation (§8); and
the authoritative PaymentIntent is re-fetched on every event rather than only on conflict
(§7). This document is the authority for the launch-critical payment slice. Where it disagrees with
`claude/studdy-implementation-plan.md`'s PR sequence or with the historical UX step 6, this
document wins — the owner overrode the step 6 visual pass in favour of the launch path on
2026-08-26.

Written after inspecting the live schema, the ILR/Tutor Request/reservation state machines,
`selectAcceptedTutorRequest`, `expireOverdueRequests`, the domain provider interfaces, the
Stripe placeholder, the outbox, and the card-on-file gate. Corrections from the owner's
review are incorporated throughout.

---

## 0. The goal

`parent sends request → tutor responds → family selects tutor/time → awaiting_payment →
payment → confirmed booking`

Everything before `awaiting_payment` already works and is merged. This slice builds the rest
of that line, and nothing else.

---

## 1. Approved product decisions (Gate 0)

These are settled. Do not reopen them without a concrete technical or legal contradiction,
and bring any such contradiction to the owner before acting on it.

| #   | Decision                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Payment window: 60 minutes** from family selection. **Near-lesson cutoff: 30 minutes.** Selection therefore requires the lesson to start at least **90 minutes** away. The two values are SEPARATE versioned rules, never one combined number |
| 2   | **No rule may produce a zero or negative window.** A lesson too close is REFUSED at selection with family-facing guidance, never allowed and then instantly lapsed                                                                              |
| 3   | **A confirmed booking is:** ILR `fulfilled` + reservation `booking_confirmed` + payment `succeeded`. **No `lessons` subsystem is built to launch**                                                                                              |
| 4   | **Launch currency NZD only.** Integer minor units everywhere. Floating-point money is prohibited                                                                                                                                                |
| 5   | **Studdy commission is 10% of the tutor's listed price**, defined centrally and versioned. No marketplace fee on top of the tutor's price. `$40` listed → parent sees `$40` → Studdy `$4` → tutor `$36`                                         |
| 6   | **The processing-fee payer is configurable and versioned.** Private alpha defaults to Studdy absorbing it. The final public policy is validated with parents before launch, so neither policy may be hard-coded                                 |
| 7   | **Stripe Connect, test mode first.** Payment success is **webhook-authoritative and idempotent**. Reaching a browser success page never fulfils anything                                                                                        |
| 8   | **Inngest** for launch-critical expiry, invoking existing domain behaviour rather than restating it                                                                                                                                             |
| 9   | **Resend** for transactional email, consuming the outbox rather than sending inside business transactions                                                                                                                                       |
| 10  | **Concierge tutor onboarding is acceptable for founding tutors.** Self-service is required before public soft launch, not before the first paid lesson                                                                                          |
| 11  | **Tutor entitlement is represented correctly from the first transaction.** Settlement may be manual for alpha, but tutor money is never undefined                                                                                               |

### The Tutor Request state machine does NOT change

Persisted Tutor Request states remain exactly:

```
sent | accepted | selected | declined | expired | acceptance_withdrawn | closed
```

An earlier draft of this plan proposed adding `confirmed`, because
`expireOverdueRequests` closes any `selected` request past its hold — which would have
closed a paid booking on the next sweep. **The owner rejected the new state, and the
rejection is correct.** Inspection confirms the fix belongs in the expiry query:

- The sweep's `selected` branch is the **only** place that closes a selected request on a
  deadline. Guarding it on the ILR's status fixes the problem exactly (§6).
- The partial unique indexes `tutor_request_live_position_unique_idx` and
  `tutor_request_live_tutor_unique_idx` are scoped to
  `status_code in ('sent','accepted','selected')`. With the winner staying `selected`, a
  confirmed booking keeps blocking duplicate requests **with no index change at all**.
  Adding `confirmed` would have required editing both.
- `withdrawRequest` already guards on `OPEN_ILR_STATUSES`
  (`awaiting_responses`, `ready_for_selection`), so a paid booking cannot be withdrawn
  through that path.

So the winner stays `selected` for the life of the booking, and the ILR's `fulfilled` is the
authoritative record that payment completed. **Do not expand this state machine.**

---

## 2. What already exists

| Piece                                                                             | State                                                                                                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Request send, fan-out, per-tutor time subsets                                     | Complete, merged                                                                                                                           |
| Tutor accept/decline, hold taken at acceptance                                    | Complete. GiST exclusion constraint on the effective interval, gap snapshotted per reservation                                             |
| Family selection, transactional close-out of losers                               | Complete. `selectAcceptedTutorRequest`                                                                                                     |
| ILR reaching `awaiting_payment`                                                   | Complete                                                                                                                                   |
| `awaiting_payment → fulfilled`                                                    | **Declared in the transition map and written by nothing**                                                                                  |
| `payments` / `lessons` / `communications` schemas                                 | Empty `export {}` stubs — no tables                                                                                                        |
| `PaymentProvider`, `ConnectedAccountProvider`, `RefundProvider`, `PayoutProvider` | Domain interfaces only, zero implementations                                                                                               |
| `packages/integrations/src/payments/stripe/`                                      | A README                                                                                                                                   |
| Card-on-file gate                                                                 | Implemented in `validateFanOut`, deliberately DISABLED (`requirePaymentMethodBeforeSend`)                                                  |
| Outbox                                                                            | `audit.outbox_entries` with a unique `idempotency_key`, `attempts`, `next_attempt_at`. **Nothing consumes it**                             |
| Expiry endpoint                                                                   | `POST /api/jobs/expire-requests`, authenticated, tested. **No scheduler invokes it**                                                       |
| Money primitives                                                                  | `Money` is `bigint` minor units + ISO code, floats rejected. `service_versions.price_amount_minor` is already `bigint`, currency `char(3)` |
| Reservation types                                                                 | `request_hold                                                                                                                              | booking_confirmed` — the second reserved and unused |

The foundations are in better shape than the gap suggests. Almost everything this slice needs
already has a place to live.

---

## 3. Schema changes

### New tables — `payments` schema

Kept deliberately lean. Anything not required for the first paid lesson is out.

**`payments.connected_accounts`** — tutor → Stripe Connect account.

`tutor_profile_id` (unique where live), `provider_account_id` (unique), `dashboard_code`
(`'express'`), `configuration_code` (`'recipient'`), `status_code`
(`not_onboarded | pending | complete | restricted`), `transfers_capability_code`,
`payouts_capability_code`, `capability_status_details jsonb`, `onboarded_at`,
`last_provider_event_at`.

> **ACCOUNTS V2, AND THERE IS NO `charges_enabled`.** An earlier draft of this section
> described v1's `charges_enabled` / `payouts_enabled` booleans and an `account.updated`
> webhook. Stripe refuses v1 account creation for new Connect platforms, so slice 4 built on
> Accounts v2, where payability is carried by CAPABILITY STATUSES
> (`active | pending | restricted | unsupported`) on a recipient configuration and maintained
> from v2 recipient THIN events, not `account.updated`.
>
> **Readiness is `transfers === 'active' AND payouts === 'active'`**, and `charges_enabled`
> is absent on purpose twice over: v2 does not expose it, and it would gate nothing if it
> did, because under separate charges and transfers the connected account never creates the
> parent's charge. Do not reintroduce it.

**`payments.payments`** — the money record. One live row per ILR.

| Group                        | Columns                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                     | `id`, `reference` (`PAY-`), `intended_lesson_request_id`, `tutor_request_id`, `service_version_id`                                                                                                                                                                                                                                                                        |
| Parties                      | `payer_user_id`, `family_account_id` (nullable), `tutor_profile_id`, `connected_account_id`                                                                                                                                                                                                                                                                               |
| Money (`bigint` minor units) | `currency_code char(3)`, `lesson_amount_minor`, `platform_fee_rate_bps int`, `platform_fee_rule_version int`, `platform_fee_amount_minor`, `tutor_entitlement_minor`, `processing_fee_payer_code`, `processing_fee_rule_version int`, `processing_fee_charged_minor`, `total_charged_minor`, `provider_cost_minor` (**nullable — recorded from Stripe, never estimated**) |
| Tax (recorded, not computed) | `tax_treatment_code text null`, `tax_metadata jsonb null`                                                                                                                                                                                                                                                                                                                 |
| Provider                     | `provider`, `provider_payment_intent_id` (unique, nullable), `provider_charge_id`, `provider_balance_transaction_id`                                                                                                                                                                                                                                                      |
| State                        | `status_code`, `payment_deadline_at`, `failed_attempt_count int not null default 0`, `last_failure_code text null`, `succeeded_at`, `failed_at`, `cancelled_at`, `refund_required_at` (nullable)                                                                                                                                                                          |

`status_code`: `requires_payment | processing | succeeded | failed | cancelled | expired`.

Constraints that make wrong money unrepresentable:

- `lesson_amount_minor = platform_fee_amount_minor + tutor_entitlement_minor`
- `total_charged_minor = lesson_amount_minor + processing_fee_charged_minor`
- `processing_fee_charged_minor = 0` when `processing_fee_payer_code = 'platform'`
- all amounts `>= 0`; `platform_fee_rate_bps between 0 and 10000`
- **partial unique on `intended_lesson_request_id` where
  `status_code in ('requires_payment','processing','succeeded')`** — one live payment per
  ILR, enforced by the database rather than by a code path. This is the double-payment guard

**`payments.payment_events`** — the raw webhook ledger and the idempotency spine.

`provider`, `provider_event_id` **unique**, `event_type`, `payload jsonb`, `received_at`,
`processed_at`, `status_code` (`received | applied | ignored | failed`), `payment_id`
(nullable), `error_note`. Index on `(status_code, received_at)` for the retry drain.

**`payments.tutor_transfers`** — settlement, written from the first transaction even while
settlement is manual (decision 11).

`payment_id` (unique where live), `connected_account_id`, `amount_minor`, `currency_code`,
`provider_transfer_id` (unique, nullable), `status_code`
(`pending | sent | failed | reversed`), `sent_at`, `idempotency_key` (unique).

### Column additions

**`bookings.tutor_requests`** — snapshot the window and the values it was computed from,
exactly as `acceptance_hold_expires_at` + `hold_rule_version` already do:

```
payment_deadline_at             timestamptz null
payment_window_minutes          integer null
payment_window_rule_version     integer null
near_lesson_cutoff_minutes      integer null
near_lesson_cutoff_rule_version integer null
```

**ONE RULE VERSION PER RULE, not one for the pair.** `platform.rule_settings` versions PER
KEY — `setRuleSetting` increments from that key's own current row, and uniqueness is
`(setting_key, version_number)`. Nothing in the model ties two keys to a shared ruleset
version, so an admin can move the cutoff while the window stays at v1. A single
`payment_rule_version` would claim to describe a decision half of which it could not account
for, and a support question months later would get a confident wrong answer rather than no
answer.

> Worth knowing, and NOT fixed here: the existing `deadline_rule_version` on both the ILR and
> the Tutor Request has the same ambiguity. It is taken from `requests.response_deadline_tiers`
> alone, while `calculateDeadlines` also reads `requests.decision_grace_hours` and
> `requests.minimum_notice_hours`, each versioned independently. Pre-existing, out of scope for
> the payment slices, and worth a small follow-up of its own.

Nullable because rows created before this slice have none; the sweep coalesces (§6).

**No change** to `tutor_requests.status_code`, to either partial unique index, to the ILR
schema, or to `tutor_time_reservations`. `reservation_type_code = 'booking_confirmed'` with
`expires_at = null` already expresses a confirmed booking.

### Tax metadata — recorded, never invented

The commercial intent is that **Studdy's 10% stays 10% from the tutor's perspective**. If
Studdy is GST-registered, the intent is for the commission to be GST-INCLUSIVE rather than
GST being added on top, which would deduct more than 10% from the tutor.

**No tax rules are implemented in this slice.** `tax_treatment_code` and `tax_metadata` are
written as `null` at launch and exist so the correct treatment can be recorded without a
migration over live money. Tutor GST registration varies per tutor and is **not** assumed —
no tutor-level tax field is added until the treatment is known.

> **Final GST and accounting treatment must be confirmed with a New Zealand accountant
> before production money moves.** This is a commercial and legal matter, not an
> implementation detail, and nothing in this document settles it.

### Deliberately out of scope

- **`payments.payment_customers`.** Saved cards, SetupIntent and card-on-file enforcement are
  all deferred for alpha, and a PaymentIntent does not require a Customer. Building customer
  storage now would be infrastructure for a feature that is explicitly not shipping
- **`communications.notification_deliveries`** — belongs to the Resend/outbox slice, not to
  the payment migration
- `lessons.*`, refund/dispute tables, invoices and receipt documents, payout schedules,
  multi-currency, tutor earnings dashboards

---

## 4. Domain and repository changes

### Pure domain — `packages/domain/src/payments/`

**`pricing.ts`** — the central, versioned fee rule. There is no `0.10` anywhere else.

```
PRICING_RULE_KEYS = {
  platformFeeRateBps: 'payments.platform_fee_rate_bps',
  processingFeePayer: 'payments.processing_fee_payer',
  processingFeeModel: 'payments.processing_fee_model',
}

PROVISIONAL_PRICING_RULES = {
  platformFeeRateBps: 1000,          // 10%
  processingFeePayer: 'platform',    // alpha default: Studdy absorbs
  processingFeeModel: null,          // no disclosed fee while the platform absorbs
}
```

**No provisional Stripe percentage is encoded.** A figure like "2.7% + 30c" would be a guess
presented as fact; actual provider cost varies by card, and is recorded from Stripe's balance
transaction after the fact. `processingFeeModel` stays `null` under Policy A and is
configured as an **explicitly disclosed fee** if and when Policy B is adopted.

**Three separate concepts, never conflated:**

| Concept               | Column                         | Meaning                                                                         |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| Studdy commission     | `platform_fee_amount_minor`    | 10% of the tutor's listed price                                                 |
| Parent processing fee | `processing_fee_charged_minor` | What the parent was explicitly charged and shown. `0` under Policy A            |
| Actual provider cost  | `provider_cost_minor`          | What Stripe actually took. Nullable, recorded after settlement, never estimated |

`computePaymentBreakdown({ lessonAmountMinor, currencyCode, rules })` returns the full
snapshot. All `bigint`. **The rounding invariant: the fee is computed and rounded; the
entitlement is the remainder** (`lesson − fee`), never computed independently — so the two
always sum exactly and the CHECK constraint cannot fail.

**A payable lesson is worth something: `payment_lesson_amount_positive_check`.** The ledger
enforces `lesson_amount_minor > 0` itself, decided during slice 3 review after inspecting
whether a zero-value payment was already unreachable. It was **not**:

- `services.service_versions.price_amount_minor` carries **no CHECK constraint at all** —
  not `> 0`, not even `>= 0`. There is no upstream service-price invariant to lean on.
- Slice 5 prices server-side by copying that column into `lesson_amount_minor`, so whatever
  the version says is what the payment row gets.
- Every other CHECK on `payments` passes on a zero row: `0 = 0 + 0` satisfies the fee split,
  `0 = 0 + 0` satisfies the total, and all six amounts are `>= 0`.

So the constraint is **not a duplicate of an existing guarantee** — it is the only thing
refusing the row. It is stated on the ledger because it is a **historical** invariant: a
payment row is the durable record that money was owed, and a row saying nothing was owed is
one that should never have been written. `lesson_amount_minor >= 0` was dropped from
`payment_amounts_non_negative_check` at the same time, so one column is not answered for by
two constraints.

This is **not free-lesson support**, and `computePaymentBreakdown` was deliberately left
total at zero — a pure arithmetic function with a hole in it is harder to reason about than
a constraint at the boundary where the record is actually written.

**`payment-window.ts`** — decision 1, with the near-lesson rule explicit rather than folded
into deadline arithmetic.

```
PAYMENT_RULE_KEYS = {
  windowMinutes:          'payments.window_minutes',            // 60
  nearLessonCutoffMinutes:'payments.near_lesson_cutoff_minutes',// 30
}

paymentWindowFor({ selectedAt, lessonStartAt, rules })
  → { deadlineAt }                  when lessonStartAt − selectedAt ≥ window + cutoff
  → { refused: 'lesson_too_close' }  otherwise
```

The deadline is `selectedAt + windowMinutes`, full stop. It is **never** clamped against the
lesson start, because clamping is precisely what produces a zero or negative window. The
near-lesson threshold is a separate, server-authoritative refusal.

This must be evaluated **at selection**, not inherited from request time: `minimumNoticeHours`
was checked when the request was sent, and selection can happen hours later.

**`payment-transitions.ts`** — the payment status machine and its allowed transitions, in the
style of `bookings/transitions.ts`.

### Repository — `packages/database/src/repositories/payments.ts`

| Command                                 | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(extend)_ `selectAcceptedTutorRequest` | New step between releasing losers and moving the ILR: compute the window; **refuse with `LessonTooCloseForPaymentError` if too close, writing nothing**; snapshot deadline, rule version and both timing inputs onto the winner's TR; set the winner's reservation `expires_at` to the deadline; emit a `payment.required` outbox entry. Inside the transaction that already exists                                                                                                                                                 |
| `createPaymentForRequest`               | Idempotent. Guards: ILR `awaiting_payment`, TR `selected`, deadline in the future, tutor payable under the Accounts v2 readiness rule (transfers and payouts both `active`), read LIVE. **Prices server-side from `service_version_id`.** Writes the `payments` row, creates the PaymentIntent with a deterministic Stripe idempotency key, returns the client secret. If a live row already exists with a reusable intent, returns that instead of creating another                                                                |
| `applyPaymentProviderEvent`             | **The authoritative transition, and ONE entry point for all four events** — built as a single command rather than the `applyPaymentSucceeded` / `applyPaymentFailed` pair this document first sketched, so the webhook and the reconciler cannot drift apart. Writes the event ledger first (unique `provider_event_id` ⇒ `duplicate`, nothing re-run), then takes the payment `FOR UPDATE` and dispatches. Correlates by `provider_payment_intent_id` (unique), with Studdy's own metadata as a cross-check, never as the selector |
| _(success, booking still valid)_        | One transaction: payment → `succeeded` with charge, balance-transaction and provider cost; ILR `awaiting_payment → fulfilled`; the SAME reservation → `booking_confirmed` with `expires_at = null`; one `tutor_transfers` row as `pending`; status transitions; audit event; domain event; `booking.confirmed` outbox entry. The Tutor Request stays `selected`. Every update status-guarded, so a second delivery matches zero rows                                                                                                |
| _(success, booking no longer valid)_    | Payment → `succeeded`, `refund_required_at` set, high-risk audit event and `payment.refund_required` outbox alert. **No fulfilment, no reservation change, no obligation** (§8 late success)                                                                                                                                                                                                                                                                                                                                        |
| _(amount or currency mismatch)_         | **Nothing is written.** The provider's `amount_received` and currency must equal the immutable Studdy snapshot before any fulfilment write; the event is recorded `failed` for ops                                                                                                                                                                                                                                                                                                                                                  |
| _(recoverable decline)_                 | An ANNOTATION, not a transition. `failed_attempt_count` incremented and `last_failure_code` set, payment stays `requires_payment`, so the family retries on the same PaymentIntent. The ILR is not closed and the reservation is not released                                                                                                                                                                                                                                                                                       |
| `paymentsAwaitingReconciliation`        | Payments still `processing`, for the reconciliation safety net                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| _(extend)_ `expireOverdueRequests`      | The `selected` branch gains two guards (§6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## 5. Stripe Connect architecture

**Account type: Express.** Stripe-hosted onboarding and KYC, minimal build, and Studdy keeps
control of the customer relationship and the charge. Custom puts compliance on Studdy;
Standard hands the tutor a full dashboard and takes control away.

**Charge pattern: separate charges and transfers.**

```
parent pays  →  PaymentIntent on the platform account (no transfer_data)
             →  funds settle in the platform balance
             →  Transfer to the tutor's connected account, created later
```

A destination charge (`transfer_data.destination` + `application_fee_amount`) is one API call
and less code. It is the wrong shape for Studdy: with `transfer_data` the tutor's share lands
in their balance **at capture**, days before the lesson happens. Admin-assisted refunds are
required before public launch, and clawing money back out of a connected account after a
cancellation is materially harder than never having sent it. Moving from destination charges
to separate transfers later would be a migration of the money model — exactly what the
"support both fee policies without redesigning the ledger" requirement forbids.

Consequences:

- The **platform fee is not an `application_fee_amount`** under this pattern. It is simply the
  part of the charge Studdy does not transfer. `tutor_entitlement_minor` is the transfer
  amount; `platform_fee_amount_minor` is the arithmetic difference
- **Tutor entitlement is correct from transaction one:** the `tutor_transfers` row is written
  in the same transaction that confirms the booking, as `pending`, with the exact amount
- Both parties are NZ and both amounts NZD, so the same-country requirement for separate
  transfers is satisfied

### Merchant of record — NOT settled by this choice

Creating the PaymentIntent on the platform account is a **technical** arrangement. It does
not, by itself, establish who the legal supplier is, who the merchant of record is, or how
the transaction is treated for tax.

> **The legal supplier, merchant-of-record and tax treatment must be confirmed
> professionally before production.** `on_behalf_of` is not set in V1, which keeps disputes
> and refunds operationally on the platform where the admin tooling will be — an operational
> choice, deliberately not a legal assertion. If professional advice requires a different
> arrangement, `on_behalf_of` and the settlement pattern are the levers, and both are
> reachable without redesigning the money model.

### Alpha settlement — deliberate and manual

1. **Reviewed weekly.**
2. Transfer tutor entitlement only for payments that **succeeded** and whose lesson's
   **scheduled end time has passed** (read from the confirmed reservation's `end_at`).
3. **Transfer nothing** flagged for refund or support investigation — `refund_required_at`
   is not null, or a support hold is recorded.
4. The `tutor_transfers` row exists from the confirming transaction regardless, carrying its
   own `idempotency_key`, so a manual run can never double-send and the tutor's money is
   never undefined.

Automated settlement timing is a later slice. The record is not.

---

## 6. PaymentIntent vs Checkout

**PaymentIntent + Stripe Payment Element, on Studdy's own `/requests/[reference]/pay` page.**

| Dimension          | Assessment                                                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity         | Checkout is less code for a one-off charge — perhaps a day's difference                                                                                                                                                                                        |
| UX                 | The clock is running. A 60-minute window with a redirect to a hosted page and a return-URL round trip puts a context switch at the worst possible moment. The Element keeps the lesson summary and the remaining time on screen                                |
| Card-on-file       | Deferred for alpha, but the approved end-state (`requirePaymentMethodBeforeSend`) needs "add a card before you send a request", which has no charge to attach to and therefore needs SetupIntent + Elements. Building Checkout now means two payment UIs later |
| Connect            | Neutral — separate charges and transfers works identically under both                                                                                                                                                                                          |
| Webhooks           | The Element is simpler: `payment_intent.*` only. Checkout adds `checkout.session.completed` as a second thing to reconcile against the same payment                                                                                                            |
| Retries            | The Element retries on the **same** PaymentIntent after a recoverable decline, which is what decision 7 asks for. Checkout tends toward a new session per attempt                                                                                              |
| Future flexibility | Control over 3DS handling and saved-card selection — the one-tap repeat payment that makes a 60-minute window humane                                                                                                                                           |

PCI posture is identical: the Payment Element is a Stripe-hosted iframe, card data never
reaches Studdy's servers, SAQ-A either way.

---

## 7. Webhooks and idempotency

### Events that matter

**TWO ENDPOINTS, AND STRIPE LEAVES NO CHOICE.** Connect account events are Accounts v2
**thin** events, verified with `parseEventNotification`; PaymentIntent events are v1
**snapshot** events, verified with `constructEvent` — and Stripe issues a different signing
secret per endpoint. One route would have to choose a secret and a parser before it had
verified anything, which is a decision made on unverified input. So the two verification
paths stay separate, and everything else is shared: same client, same error types, same
`payment_events` ledger, same idempotency spine.

**`/api/webhooks/stripe/payments`** — `STRIPE_PAYMENTS_WEBHOOK_SECRET`. A deployed
subscription must carry **only these four**, and no unrelated Stripe events:

| Event                           | Effect                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `payment_intent.succeeded`      | **Authoritative for the money; authoritative for the booking only while Studdy's state is still valid** (see §8 late success) |
| `payment_intent.processing`     | Payment → `processing`. Also what protects the row from the expiry sweep, which is why this event is not optional             |
| `payment_intent.payment_failed` | An ANNOTATION, never a transition: `failed_attempt_count` and `last_failure_code`, payment stays `requires_payment`           |
| `payment_intent.canceled`       | Payment → `cancelled`, which releases the one live-payment slot so the family can start a fresh attempt in their window       |

**`/api/webhooks/stripe/connect`** — `STRIPE_CONNECT_WEBHOOK_SECRET`, slice 4. Accounts v2
recipient thin events (`v2.core.account[configuration.recipient].*`), **not** v1
`account.updated`.

Deferred, and deliberately not subscribed to yet: `charge.refunded` and
`charge.dispute.created` (they record history rather than change what Studdy owes — refund
slice), `transfer.created` / `transfer.failed` (settlement slice).

### The route

`/api/webhooks/stripe/payments`. The middleware matcher already excludes `api/`, so it is not
auth-gated — covered by an explicit test. `export const runtime = 'nodejs'`. Read the **raw
body** with `await request.text()`; `request.json()` breaks signature verification.

1. `stripe.webhooks.constructEvent(rawBody, signature, secret)`. Invalid ⇒ `400`, nothing
   sensitive logged. **No branch reaches a write before this succeeds.**
2. Refuse a **livemode mismatch** against Studdy's own environment, before any write. A
   live-mode event at a sandbox deployment means the endpoint is wired to the wrong account.
3. **Re-fetch the authoritative PaymentIntent from Stripe.** The event embeds a copy; it is
   the state at emission, and delivery can be delayed, retried or reordered. Re-reading makes
   a stale delivery harmless by construction.
4. Insert into `payment_events`. **A unique violation on `provider_event_id` means duplicate
   ⇒ return 200 and stop.** The idempotency guarantee is a database constraint, not a code
   path, so Stripe's retries are free.
5. Dispatch to the matching domain command.
6. Every transition is `UPDATE … WHERE status_code = <expected>`. **Zero rows means someone
   already did it — success, not an error.**
7. Return 200 as soon as the event is recorded — including for the outcomes that need a
   human. A money mismatch or a blocked fulfilment is a decision Studdy has already made and
   recorded; asking Stripe to redeliver would not change it, and would bury the real signal
   under retries. The event ledger carries `failed` and the log carries the alert.

**Out-of-order events** are handled by guarding on _state_, never on sequence. A
`payment_failed` arriving after `succeeded` finds the payment already `succeeded`, matches
zero rows, and is marked `ignored`.

**As built, the re-fetch is UNCONDITIONAL rather than conflict-only.** An earlier draft
re-read the PaymentIntent only when a terminal event contradicted a terminal state. Doing it
on every event is simpler, is one API call, and removes the question of what counts as a
conflict — Stripe's current state is always what Studdy acts on, so out-of-order delivery is
harmless by construction rather than by a special case.

**If applying an event fails** (a database blip), leave the event `received` and still return 200. An Inngest drain retries from the ledger. Never 500 at Stripe repeatedly; never lose the
event.

**No double payment:** the partial unique index on `intended_lesson_request_id`, plus a
deterministic Stripe idempotency key. **No double fulfilment:** the ILR update is guarded on
`awaiting_payment`. **Never from the browser:** the success page _reads_ the payment row; if
still pending it says "confirming your payment" and refreshes. It has no write path at all.

---

## 8. Deadline and expiry behaviour

### The expiry fix

`expireOverdueRequests`'s `selected` branch currently closes any `selected` request whose
`acceptance_hold_expires_at` has passed. It gains two guards and one coalesce:

```sql
WHERE tr.status_code = 'selected'
  AND coalesce(tr.payment_deadline_at, tr.acceptance_hold_expires_at) <= now
  AND ilr.status_code = 'awaiting_payment'          -- not a fulfilled booking
  AND NOT EXISTS (                                   -- not mid-payment
        SELECT 1 FROM payments.payments p
        WHERE p.tutor_request_id = tr.id
          AND p.status_code IN ('processing', 'succeeded')
      )
```

The ILR guard is what protects a paid booking: once the ILR is `fulfilled`, its winning
request is out of the sweep's reach without any new Tutor Request state. The coalesce keeps
rows created before this slice behaving exactly as they do today.

> ### OWNERSHIP: THE `NOT EXISTS` PAYMENT GUARD BELONGS TO SLICE 5
>
> **Status: STILL UNWRITTEN.** Slice 1 shipped the ILR guard and the coalesce. Slice 3
> created `payments.payments`, so the guard above is finally _writable_ — but slice 3 does
> **not** write it, and the earlier note in the PR sequence claiming slice 3 "completes"
> it was wrong and has been corrected.
>
> **It is assigned to launch slice 5, `feat/stripe-payment-intent`.** The requirement is
> unchanged and unconditional: `expireOverdueRequests` must skip any `selected` request
> holding a payment in `processing` or `succeeded`, so a webhook in flight cannot have its
> request lapsed out from under it.
>
> **It must land before any operational PaymentIntent or payment row can be processed.**
> Slice 5 is exactly that boundary — the first branch that creates real payment rows — so
> the guard ships in the same branch as the rows it protects, and never a branch later.
>
> **Slice 4 (`feat/stripe-connect-onboarding`) must NOT own it.** Connect onboarding
> creates no payment rows at all, so the guard would sit there unexercised and untestable:
> a guard whose predicate no test can make true is indistinguishable from one that does not
> work. Writing it in slice 4 would buy nothing and would retire a real risk on paper only.
>
> Until it lands, no operational payment row may exist — which is precisely why slices 3
> and 4 create none.

### What happens, moment by moment

| Moment                          | Behaviour                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Family selects**              | Window computed. Too close ⇒ selection **refused**, nothing written, family told plainly ("This lesson starts too soon to arrange payment safely — choose another time"). Otherwise deadline snapshotted on the TR, reservation `expires_at` set to the deadline, ILR → `awaiting_payment`, `payment.required` outbox entry |
| **Payment begins**              | `payments` row `requires_payment`, PaymentIntent created, client secret returned. A refresh reuses the row                                                                                                                                                                                                                  |
| **Payment succeeds**            | Webhook only. Payment → `succeeded`, reservation → `booking_confirmed` with `expires_at = null`, ILR → `fulfilled`, transfer row `pending`, `booking.confirmed` outbox entry. TR stays `selected`                                                                                                                           |
| **Payment fails (recoverable)** | Failure recorded, `failed_attempt_count` incremented, payment stays `requires_payment`. **Reservation stays held.** The family retries on the same PaymentIntent while the window is open. No arbitrary retry cap — Stripe's own fraud and rate controls apply                                                              |
| **Payment abandoned**           | Nothing until the deadline; then identical to expiry                                                                                                                                                                                                                                                                        |
| **Window expires**              | The sweep closes the TR (`payment_window_lapsed`), releases the reservation, closes the ILR — behaviour that already exists, now reading the new deadline. `request.payment_lapsed` outbox entry                                                                                                                            |
| **Webhook just before expiry**  | Normal success. The `processing` guard keeps the sweep away from a payment in flight                                                                                                                                                                                                                                        |
| **Webhook just after expiry**   | The hard case, below                                                                                                                                                                                                                                                                                                        |

### Late success — **APPROVED LAUNCH RULE: refund required, never an automatic re-take**

The family paid; the sweep already closed the request and released the slot. Neither
silently confirming nor silently refunding is acceptable, and **neither is silently putting
the booking back together.**

**This supersedes an earlier draft of this section, which proposed re-taking the released
reservation and confirming if the slot was still free.** That draft was wrong, on two
counts found while implementing slice 6:

- **The ILR is already `closed` by then.** The same sweep that releases the reservation
  closes the request, and `closed` is TERMINAL in the approved ILR state machine —
  `closed → fulfilled` is not a transition. Re-taking the hold would fix only half the
  record; confirming from there would mean resurrecting a terminal state or inventing a new
  one, and the owner has rejected expanding these machines.
- **The tutor's slot may already have been allocated elsewhere.** A re-take that happens to
  succeed proves the slot is free _at that instant_, not that reinstating a booking the
  family has stopped expecting is the right outcome. That is a commercial decision about
  someone's calendar, not something a webhook handler should improvise.

**The approved behaviour, exactly:**

| Do                                                                         | Do NOT                                   |
| -------------------------------------------------------------------------- | ---------------------------------------- |
| Record the payment as `succeeded`                                          | Fulfil the ILR                           |
| Record authoritative provider information and cost                         | Re-take or recreate the reservation      |
| Set `refund_required_at`                                                   | Create a `booking_confirmed` reservation |
| Write a high-risk audit event and a `payment.refund_required` outbox alert | Create a `tutor_transfers` obligation    |

**Refund EXECUTION remains outside slice 6.** What this slice guarantees is that the money
is recorded honestly, the booking is not fabricated, no tutor is owed for a lesson that is
not happening, and a human is told.

The `processing` guard plus reconciliation shrink this window to near-nothing. "Near-nothing"
is not "never", and real money needs the branch to exist — visibly, for an operator, rather
than quietly, for nobody.

### A successful payment is authoritative for fulfilment ONLY while the booking is still valid

**"Stripe payment succeeded" and "Studdy booking fulfilled" are two different facts, and
late success is the proof.** A payment succeeding is authoritative about MONEY: it is the
only thing that may mark a Studdy payment `succeeded`, and no browser path may do it. It is
authoritative about the BOOKING only when Studdy's own state is still capable of carrying
one — the ILR still `awaiting_payment`, the reservation still live, and the tutor still
holding a payout account.

Every fulfilment therefore checks Studdy's state _after_ verifying Stripe's, and takes one
of exactly two paths:

```
verified event → authoritative PaymentIntent → amount + currency match the snapshot
   → Studdy state still valid   ⇒ FULFIL   (payment succeeded, ILR fulfilled,
                                            reservation booking_confirmed, one obligation)
   → Studdy state no longer valid ⇒ RECORD  (payment succeeded, refund_required_at,
                                            high-risk alert, and nothing else)
```

Conflating the two is how a platform ends up either taking money for nothing or confirming a
lesson nobody can deliver.

### Reconciliation — the safety net for a webhook that never arrived

`processing` is the one payment status the expiry sweep will never release, which is correct
while a confirmation is in flight and a hole if one never resolves: the tutor's calendar
would stay blocked indefinitely. `reconcile-payments` closes it by asking Stripe.

- It **owns no rules.** It re-reads the authoritative PaymentIntent and hands it to the same
  `applyPaymentProviderEvent` the webhook uses — one code path, one set of guards, so a
  reconciled late success is refused exactly as a late webhook is.
- Its event id is deterministic (`reconcile:<intent>:<status>`), so re-running is absorbed by
  the same unique constraint that absorbs Stripe's retries. A reconciler racing a webhook is
  resolved by the payment row's `FOR UPDATE`: one fulfils, the other reports already done.
- **A provider failure never becomes success.** Each payment is reconciled in its own
  try/catch; an unreadable one is counted and left `processing` for the next run, so one bad
  row cannot starve the batch and nothing is written from a failed read.
- **Its fifteen-minute cadence is an operational polling interval, not a business rule.** No
  deadline, entitlement, window or refund derives from it. It lives in the Inngest function
  beside the expiry schedule; Studdy's rules live in `@studdy/domain` and versioned
  `rule_settings`.

---

## 9. Reservation behaviour

| Event                       | Reservation                                                                                                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection                   | Stays `active`, type `request_hold`. `expires_at` **moves to the payment deadline** — usually earlier than the acceptance hold (60 minutes vs up to 8 hours). Consistent with never holding longer than needed. The tutor's screen must not present the earlier expiry as a penalty |
| Awaiting payment            | Unchanged, `active`, protected by the exclusion constraint                                                                                                                                                                                                                          |
| Payment succeeds            | `reservation_type_code → 'booking_confirmed'`, `expires_at → null`, status stays `active`. The same row carried forward, which is what the schema comment always anticipated                                                                                                        |
| Payment fails (recoverable) | **Unchanged and still held.** A declined card is not a lapsed window                                                                                                                                                                                                                |
| Window expires              | `released`, reason `payment_window_lapsed` — existing behaviour                                                                                                                                                                                                                     |

---

## 10. Money model

A `$40.00` NZD lesson. `lesson_amount_minor = 4000`, `platform_fee_rate_bps = 1000`.

| Field                                         | Policy A — Studdy absorbs (alpha default) | Policy B — parent pays a disclosed fee |
| --------------------------------------------- | ----------------------------------------- | -------------------------------------- |
| `currency_code`                               | `NZD`                                     | `NZD`                                  |
| `lesson_amount_minor`                         | `4000`                                    | `4000`                                 |
| `platform_fee_rate_bps` / `_rule_version`     | `1000` / `1`                              | `1000` / `1`                           |
| `platform_fee_amount_minor`                   | `400`                                     | `400`                                  |
| `tutor_entitlement_minor`                     | `3600`                                    | `3600`                                 |
| `processing_fee_payer_code` / `_rule_version` | `platform` / `1`                          | `payer` / `2`                          |
| `processing_fee_charged_minor`                | `0`                                       | configured disclosed fee               |
| **`total_charged_minor`**                     | **`4000`**                                | **`4000` + disclosed fee**             |
| `provider_cost_minor`                         | recorded from Stripe after settlement     | recorded from Stripe after settlement  |

The tutor's four figures are **identical under both policies**. That is the point of the
design: switching policy is a new `rule_settings` version plus a delta on two fields
(`processing_fee_charged_minor`, `total_charged_minor`). The transfer amount never moves,
the ledger is not redesigned, and no migration is required.

`provider_cost_minor` is **never estimated**. It is populated from the Stripe balance
transaction once known, and its absence is honest rather than a gap.

Historical explainability: every rate and rule version is snapshotted on the row, so changing
the commission later never re-reads an old transaction.

### What the tutor sees

Tutors see the economics of their own transaction, plainly:

```
Lesson price   $40
Studdy fee      $4
You earn       $36
```

**Studdy's 10% commission is not hidden from tutors.** It is not competitor information and
it is not covered by the tutor-request privacy rule, which exists to stop a tutor learning
about _other tutors_ on the same request.

Tutors do **not** see `provider_cost_minor` — Studdy's cost of doing business is not part of
their transaction. If Policy B is ever adopted, whether the tutor also sees the parent's
disclosed processing fee is a copy decision at that time; it changes no structure.

---

## 11. Scheduler and outbox

**Inngest is transport. It holds no rules.** Each function authenticates and calls a domain
command that already exists and is already tested.

| Function             | Cadence      | Calls                                                                                                                                                                                                                                          |
| -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expire-requests`    | every minute | `expireOverdueRequests` — unchanged signature                                                                                                                                                                                                  |
| `drain-outbox`       | every 30 s   | `drainOutbox` → Resend                                                                                                                                                                                                                         |
| `reconcile-payments` | every 15 min | Re-fetches PaymentIntents stuck in `processing` and applies the result through `applyPaymentProviderEvent` — the safety net for a webhook Stripe never delivered. **The cadence is an operational polling interval, not a business rule** (§8) |

Functions live at `/api/inngest` in the Next app and call the repository commands directly —
one fewer hop, the same command. `POST /api/jobs/expire-requests` stays for manual and ops
invocation. Neither is a source of truth; both are doors into the same command.

**The outbox remains the record of what happened.** Business transactions write outbox
entries; the drain sends email. `outbox_entries.idempotency_key` is already unique;
`communications.notification_deliveries` (added in the Resend slice, not the payment one)
records provider message ids so a retry after a partial failure cannot double-send.

Launch-critical notifications:

`tutor_request.sent` · `tutor_request.accepted` · `intended_lesson_request.selected` ·
`payment.required` · `booking.confirmed` · `request.payment_lapsed` · `tutor_request.closed`

Four already emit today; only the payment ones are new.

---

## 12. Testing strategy

**Unit (pure, no database).** `computePaymentBreakdown` — the sum invariant across a spread
of amounts including awkward ones (`$33.33`), both policies, and a property test that
`fee + entitlement === lesson` always. `paymentWindowFor` — the refusal boundary at exactly
the cutoff and one minute either side, plus an assertion that **no input produces a
non-positive window**. The payment transition map.

**Repository / integration (real Postgres).** Selection sets the deadline and shortens the
reservation. Selection is refused when the lesson is too close, and **writes nothing**.
`createPaymentForRequest` prices from `service_version_id` and ignores any amount a caller
supplies. `applyPaymentSucceeded` moves all four records or none.

**The expiry guards get their own tests, because they are the correction this plan turns on:**
a lapsed selection is closed and its hold released; a selection whose payment is `processing`
is **skipped**; a selection whose **ILR is `fulfilled` is never touched, however old its
deadline**.

**Stripe webhooks.** Signature verification passes on a correctly signed fixture and fails on
a tampered body, a wrong secret and a stale timestamp. Fixtures for each handled event,
applied against a real database.

**Idempotency.** The same event twice ⇒ one fulfilment, second recorded duplicate.
`succeeded` then `failed` ⇒ still fulfilled. `failed` then `succeeded` ⇒ fulfilled. Two
concurrent `payment_intent.succeeded` deliveries ⇒ exactly one confirmation.

**Concurrency / race.** Two families paying for colliding slots ⇒ the exclusion constraint
refuses one, handled as a lost race rather than a 500. Sweep running concurrently with a
succeeding webhook. **The late-success rule end to end**, driven through the REAL expiry
sweep rather than by editing rows: payment `succeeded` + `refund_required_at`, ILR NOT
fulfilled, no `booking_confirmed` reservation, ZERO `tutor_transfers` — and redelivery of
that blocked success still harmless. **A reconciler racing a webhook** on the same
successful intent, which the unique event id does NOT absorb because the two ids differ:
exactly one succeeded payment, one fulfilled ILR, one confirmed reservation, one obligation,
one logical outcome.

**E2E (Playwright, Stripe test mode).** The full path on `/book` with `4242…` ending in a
confirmed booking. A decline (`4000000000000002`) leaving the reservation intact and the
family able to retry on the same intent. A 3DS card. Its own account and its own tutor, per
the existing rule — payment E2E takes real holds and must not collide with `booking-journey`.

**Failure paths.** Stripe unreachable at intent creation. A webhook for an unknown
PaymentIntent. A tutor whose Accounts v2 capabilities are not `active` at payment time.

---

## 13. Security and privacy

- **Webhook verification before anything else.** Raw body, `constructEvent`, Stripe's
  timestamp tolerance for replay. An unverified request never reaches a query
- **Payment ownership is part of the authoritative query**, exactly as selection already does
  it: the ILR is matched against the session's own student profiles in the same `WHERE`. A
  payment for another family's request matches zero rows rather than being found and refused
- **Server-authoritative price, always.** The amount comes from `service_version_id` on the
  tutor request. No amount, fee or currency is read from the client — the existing rule that
  only a version id travels in the URL extends unchanged into payment
- **No client-authoritative commission.** The fee rate is read from `rule_settings`
  server-side and snapshotted. The browser is told the total to display; it never supplies one
- **Amount tampering is structurally impossible** rather than validated against — there is no
  field to tamper with
- **Connected-account boundaries.** A tutor's `provider_account_id` never appears in any
  family-facing projection, and no tutor learns anything about another tutor. Tutors DO see
  their own lesson price, Studdy's fee and their earnings (§10)
- **Secrets.** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INNGEST_SIGNING_KEY`,
  `RESEND_API_KEY` — server-only, never `NEXT_PUBLIC_`. Only the publishable key reaches the
  browser. **Every one must be declared in `turbo.json`'s task `env` list** or strict env mode
  strips it. This is invisible locally because Playwright reads `.env.local` off disk itself
- **PCI: SAQ-A.** The Payment Element is a Stripe iframe; card data never touches Studdy
  servers, logs or database. Never log a PaymentIntent payload wholesale
- **Logging** keeps the existing discipline: counts, correlation ids and timings — never a
  reference, amount, tutor, student or family

---

## 14. Deferred until after the first paid lesson

- Automated settlement timing (transfers recorded from transaction one; sending is manual)
- Self-service refunds and cancellation — required before **public** launch, not before the
  first paid lesson with a known tester
- Disputes and chargebacks beyond recording the event
- Saved cards, SetupIntent, and enabling `requirePaymentMethodBeforeSend`
- Receipts and invoice documents
- Multi-currency, tax computation, tutor earnings dashboards, payout schedules
- **The historical UX step 6 whole-product visual pass** — only the new payment screens get
  design attention
- Rate limiting on the availability surface — not in this slice, but required before the site
  is broadly exposed
- Resurrecting a lapsed selection: if the window expires, the family starts over

---

## 15. Open decisions

Only genuinely open items. Everything in §1 is settled.

1. **GST and accounting treatment** — confirm with a NZ accountant before production money
   moves. Intent recorded in §3: commission GST-inclusive so the tutor's 10% stays 10%. No
   tax logic is built until confirmed
2. **Legal supplier / merchant of record** — professional confirmation required (§5)
   2b. **Connect account responsibilities — `losses_collector: 'application'`.** Approved for
   the sandbox implementation and **explicitly NOT approved for live money.** Stripe Accounts
   v2 requires `defaults.responsibilities` on any recipient holding the transfers capability,
   and Studdy sets both collectors to `application`: Studdy collects Stripe's fees, and
   **Studdy carries unresolved negative balances a tutor cannot pay back.** The fee half
   follows from the approved money model. The LOSSES half is a genuine liability position and
   needs professional confirmation before production, alongside item 2 — it is the same
   question wearing a different hat, and the two should be answered together. Changeable
   while no production account exists and no money has moved.
3. **The disclosed processing fee model**, if Policy B is ever adopted — its shape only,
   since the structure already supports it
4. **Alpha settlement cadence** — weekly review is approved; the specific day and who runs it

---

## 16. Implementation slices

Eight PRs. Sequenced so that **expiry is automated before any real money can be taken** — the
owner's explicit requirement — and so the first paid booking arrives as early as is safe.

| #     | Branch                             | What                                                                                                                                                                                                              | Why here                                                                                                                                                                                                                               |
| ----- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `feat/payment-window`              | Window and cutoff rules, near-lesson refusal, TR snapshot columns, reservation `expires_at` moved to the deadline, expiry sweep guarded on ILR status and in-flight payment                                       | **No Stripe at all.** Fixes the sweep before it can ever threaten a booking, and is fully testable today. The `payments` table does not exist yet, so the sweep's payment guard lands as a no-op predicate and is completed in slice 3 |
| **2** | `feat/inngest-scheduler`           | Inngest app at `/api/inngest`, `expire-requests` every minute, deployment wiring                                                                                                                                  | **Expiry becomes operational before any money exists.** No real payment can be accepted while expiry depends on someone calling an endpoint by hand                                                                                    |
| **3** | `feat/payments-schema-and-pricing` | `payments` tables, pure pricing and window domain, tax metadata columns, RLS classification. **The sweep's payment guard is NOT completed here — reassigned to slice 5 (§8)**                                     | Schema and pure logic, no integration. Fable security review on the migration before it is finalised, per the standing rule                                                                                                            |
| **4** | `feat/stripe-connect-onboarding`   | Express account creation, onboarding link, `account.updated` webhook, `connected_accounts`                                                                                                                        | A tutor must be payable before anyone can pay. Also proves webhook verification end to end on a low-risk event                                                                                                                         |
| **5** | `feat/stripe-payment-intent`       | `createPaymentForRequest`, `/requests/[ref]/pay` with the Payment Element, server-authoritative pricing, retry on the same intent, **and the sweep's in-flight payment guard (§8) — it must land in this branch** | The parent can pay. Nothing is fulfilled yet — deliberately. **This is the first branch that writes operational payment rows, so it is the first branch where the guard can be exercised rather than merely written**                  |
| **6** | `feat/stripe-payment-fulfilment`   | `/api/webhooks/stripe/payments`, `payment_events`, `applyPaymentProviderEvent`, late success as refund-required (**no re-take** — §8), transfer obligation, `reconcile-payments`                                  | **The first real paid booking is possible at the end of this PR.** The riskiest code, reviewed alone rather than buried in a large branch                                                                                              |
| **7** | `feat/resend-outbox-notifications` | `drainOutbox`, Resend adapter, `communications.notification_deliveries`, the seven launch-critical emails                                                                                                         | The tutor stops needing to log in to discover anything. Last because alpha testers are known people who can be told by hand                                                                                                            |
| **8** | `feat/admin-settlement`            | Weekly settlement view, eligibility rules from §5, idempotent transfer creation                                                                                                                                   | Tutors are paid. The record existed from slice 6; this is the tooling around it                                                                                                                                                        |

After 8, and gating **public** rather than first-paid launch: admin refund and cancellation,
availability rate limiting, tutor self-service onboarding.

---

## 17. Where this sits with the rest of the plan

The historical UX **step 6 visual pass is deferred**, by the owner's decision, in favour of
this path. It is not cancelled: when the payment screens exist, a visual pass over the whole
family journey including them is the natural follow-up.

Steps 1–5 of the UX redesign are merged. This document replaces "step 6" as the next work.
