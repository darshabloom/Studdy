# Studdy — session handoff

**Rewritten during the UX-redesign slice.** Everything here was verified against the code
and git state at the time of writing, not copied forward from an earlier handoff.

This file is written for a **fresh Claude Code session with no memory of the previous
conversation**. It should be enough to continue safely on its own.

---

## 1. Read these first, in this order

1. `claude/studdy-fable-handoff-brief.md` — **authority rank 1.** The build brief: product
   model, implementation rules, approval checkpoints, what needs the owner's sign-off.
2. `docs/decisions/` — decisions approved during implementation. **These override the
   planning pack** where stated. Three files: approved product decisions, the multi-tutor
   state machine, security and privacy decisions.
3. `docs/design/payments-and-first-paid-booking.md` — **the authority for the current
   work.** The launch-critical payment slice: approved product decisions, schema, Stripe
   Connect architecture, webhooks, money model and the PR sequence.
4. `docs/source-material/README.md` — index of the fourteen planning documents, their
   status, and which decisions override each.
5. `docs/source-material/*.md` — the planning documents themselves, when you need detail.
6. `claude/studdy-planning-pack-digest.md` — a condensed extract of all fourteen. Useful as
   an index; the full sources are authoritative.

**Authority order when two documents disagree:** brief → `docs/decisions/` → planning
documents 01–14 in numbered order.

Note the repository has both `documentation/` (ADRs, build ledger, product rules, from the
bootstrap slice) and `docs/` (source material, decisions, handoffs, added later). Both are
current; they are not duplicates.

---

## 2. Where the work is

**Branch:** `feat/payments-schema-and-pricing`, branched from `main` at `cfc288c`.
**Working tree:** clean. Nothing uncommitted, nothing stashed.

> **SLICE 3 IS IN FLIGHT.** Payment slices 1 and 2 are merged; slice 3 is implemented on
> this branch, is NOT pushed, has NO pull request, and has **two review items to settle
> before closeout** — see the slice 3 section in §8. Read the CURRENT HEAD and ahead count
> out of git; `9cadce3` is the slice 3 implementation commit and stays true.

> ### Checkpoint state, verified against git
>
> | Fact            | Value                                               |
> | --------------- | --------------------------------------------------- |
> | Branch          | `main`, level with `origin/main`                    |
> | UX steps 1–4    | merged (PRs #17, #18, #19)                          |
> | UX step 5       | merged as `a738913` (PR #20, squash, 2026-08-26)    |
> | UX step 6       | **DEFERRED** — replaced by the launch-critical path |
> | Payment slice 1 | merged as `8fa6051` (PR #21, squash, 2026-08-30)    |
> | Payment slice 2 | merged as `3eaddf3` (PR #22, squash, 2026-08-31)    |
> | Payment slice 3 | **IMPLEMENTED, NOT MERGED** — two review items open |
> | Payment slice 4 | not started                                         |
>
> Step 5 merged with all four CI jobs and both Vercel checks green, after a full
> sequential local verification from a fresh database. It was approved screen by
> screen by the owner.
>
> Payment slice 1 merged the same way. **One CI failure on the way, and it was not
> real:** `supabase/setup-cli@v1` died in 11 seconds with
> `Failed to resolve latest Supabase CLI release: rate limit exceeded` — a GitHub API
> rate limit in a third-party setup action, before migrations, seeds or any test ran.
> Re-running the job passed in 2m32s. If it recurs, re-run before investigating the
> diff, but confirm the failure is in the setup step first.
>
> Read the CURRENT HEAD out of git rather than from this file — a document cannot
> name the commit that contains it. `a738913` is the step 5 squash commit and
> stays true; the branch commits behind it were `fbc1757`, `923b16e`, `7c90069`
> and `ab39367`.
>
> Start step 6 on a NEW branch off `main`. Do not reuse the merged branches
> `feat/optional-shortlist-and-fan-out`, `feat/parent-booking-journey`,
> `feat/discovery-and-profile-availability-calendars` or
> `feat/availability-and-multi-time-requests` — they are kept on the remote, as
> this repository keeps every merged branch, but nothing new belongs on them.

### What PR #17 delivered

The whole availability and multi-time-request foundation, squashed into `5b948b4`:
the `availability` schema with recurring rules, one-off additions and blocked periods;
derived bookable-slot calculation; the family-facing availability surface; multi-time
requests with per-tutor offered subsets; tutor accept and decline with the hold taken at
acceptance; family selection close-out landing on `awaiting_payment`; the shared
`WeekCalendar` primitive (step 1); and the calendar-first `/tutor/availability` with its
visual, refinement and accessibility passes (step 2).

Merge convention on this repository is **squash**, one commit per PR with a `(#N)` suffix.
`main` is linear; every commit has a single parent. Preceding it: `b4464a8` (PR4 intended
lesson requests), `51c0135` (PR3), `d3116ed` (PR2), `91931e5` (PR1).

`main` is not branch-protected, but CI runs on every pull request and all four jobs
— typecheck/lint/unit/build, migrations+seeds+integration, Playwright end-to-end, secret
scanning — were green on the merged commit, as were the Vercel checks.

**Repository location: `S:\Studdy`.** Not `E:\ExternalStorage\Projects\Studdy` — that path
is on an exFAT volume which cannot store symlinks, so pnpm workspaces cannot install there.
A stale copy still exists at the E: path; **ignore it**. `S:` is an NTFS virtual disk
mounted at logon by the scheduled task "Mount StuddyDev Disk". If `S:` goes missing —
which happens mid-session, not only after a reboot — run
`Start-ScheduledTask -TaskName 'Mount StuddyDev Disk'`; it remounts without elevation,
whereas `Mount-DiskImage` fails with "Access is denied". Guard shell commands with
`if (-not (Test-Path 'S:\Studdy\package.json')) { exit 1 }` before `Set-Location`: when `S:`
is gone, `Set-Location S:\Studdy` fails but the rest of the command still runs, silently
executing against the stale exFAT copy.

---

## 3. Restore and verify the environment

```bash
cd S:\Studdy
pnpm install
pnpm supabase:start      # Docker Desktop must be running
pnpm db:migrate
pnpm db:seed
pnpm dev                 # http://localhost:3000
```

Verify everything:

```bash
pnpm typecheck && pnpm check:rls && pnpm test && pnpm test:integration && pnpm build
```

```bash
cd S:\Studdy\apps\web; pnpm test:e2e
```

Lint needs limited concurrency on this machine — nine parallel ESLint processes exhaust
memory:

```bash
cd S:\Studdy; pnpm exec turbo run lint --concurrency=2
```

**Local ports are non-standard.** Windows reserves the 543xx range for WSL/Hyper-V, so
Supabase runs on 14321 (API), 14322 (database), 14323 (Studio), 14324 (Mailpit inbox).
The analytics container is disabled locally.

**Expected state after a clean run, at the step 4 merge (`d676f13`):** 28 tables classified
by `check:rls`; **389 unit tests passing with 1 skipped** (4 configuration, 50
design-system, 131 domain, 88 web, 116 database); **110 integration passing with 1
skipped**; **98 end-to-end**. `typecheck`, `lint`, `format`, `check:rls`,
`check:boundaries` and `build` all green. Treat these as a shape, not a target — they move
whenever a test is added, so read the counts out of the run.

**Re-seed before every end-to-end run.** The e2e suite is not idempotent against a used
database — it creates students and leaves holds — so a second run without a reset fails in
ways that look like code defects. Run `pnpm db:reset && pnpm db:migrate && pnpm db:seed`
first. CI is unaffected because it seeds a fresh instance.

> **RUN THE HEAVY SUITES SEQUENTIALLY, NEVER AGAINST EACH OTHER.** This machine starves
> them, and a starved test fails in ways that read as product defects. The full end-to-end
> suite takes **about 2.5 minutes when it has the machine to itself**; run against a build
> and the unit suite it has taken **1.7 hours**, with one test reporting a 30-second
> timeout after 9.9 minutes of wall clock. **A recorded duration far larger than the
> test's own timeout is contention, not a bug** — re-run that spec alone against a fresh
> seed before characterising it.
>
> Playwright's `webServer` has `reuseExistingServer: true` locally and listens on **3100**.
> A `next start` left over from an earlier session is therefore SILENTLY REUSED, and the
> whole suite runs against stale code. Kill anything on 3000/3100/3200 before a run that
> has to be trustworthy.

---

## 4. Database and seed assumptions

- **Migrations** live in `packages/database/migrations/`. One generated Drizzle migration
  plus seven reviewed SQL files, applied in phase order: `pre` → generated → `rls` →
  `functions` → `triggers` → `constraints` → `transformations`. The runner is
  `packages/database/src/migrate.ts`.
- **Reviewed SQL is immutable once applied to a shared environment.** Nothing has been
  applied beyond local yet, so files have been edited in place during development; treat
  them as immutable from now on and add new files for corrections.
- **Seeds** (`pnpm db:seed --scenario <name>`): `clean_registration` (default — accounts,
  discovery tutors and request rules), `discovery_tutors`, `request_rules`,
  `multi_tutor_request_pending`, `request_expired`.
- **Accepted, selected and paid states are deliberately not seeded** — the code cannot
  produce them yet, and seeding them would fabricate data.
- **Synthetic accounts**, password `Studdy-local-only-1`, documented in
  `documentation/implementation/development-test-accounts.md`. The lesson-request
  journeys use **dedicated** accounts (`parent.requests@`, `student.requests@`) because
  Playwright runs spec _files_ in parallel — a journey mutating an account shared with
  another spec races it. This cost real debugging time; keep journey specs on their own
  accounts.
- Seeding creates real Supabase Auth users when `SUPABASE_SERVICE_ROLE_KEY` is present,
  so seeded accounts can genuinely sign in.

---

## 5. Environment variables (names only — never commit values)

`apps/web/.env.local`, copied from `.env.example`:

| Name                             | Purpose                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STUDDY_ENVIRONMENT`             | local / development / staging / production                                                                                                           |
| `NEXT_PUBLIC_STUDDY_ENVIRONMENT` | Drives the visible environment banner                                                                                                                |
| `NEXT_PUBLIC_SUPABASE_URL`       | Local Supabase API                                                                                                                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Publishable key                                                                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`      | **Server-only.** Never `NEXT_PUBLIC_*`, never committed, never requested through chat                                                                |
| `DATABASE_URL`                   | Direct Postgres connection                                                                                                                           |
| `CRON_SECRET`                    | Shared secret for `/api/jobs/expire-requests`, sent as `Authorization: Bearer`. Must be set in any deployed environment or the endpoint fails closed |

The local values are the Supabase CLI's standard demo keys, printed by
`pnpm supabase:start`.

---

## 6. What this branch delivered, and what is authoritative now

### The backend slice is complete and reviewed (checkpoints 1–5)

Tutor availability (recurring rules, one-off additions, blocked periods with private
reasons) in a server-only `availability` schema; derived bookable-slot calculation; a
family-facing availability surface scoped to a real student/subject context; multi-time
requests with per-tutor offered subsets; tutor accept and decline with the hold taken at
acceptance; and family selection close-out landing on `awaiting_payment`.

Each checkpoint had its own focused Fable review, and every finding was applied before the
checkpoint was committed. The substantive ones, all fixed: the request path was an
availability oracle; one shared response deadline leaked a time the tutor was never
offered; the tutor projection showed the family-side lesson length; availability
eligibility omitted `visibility_state_code`; and the winner's hold outlived its natural
expiry indefinitely.

**Key invariants to preserve.** Families receive derived positive slots only — two instants,
never a reason for a gap. Tutors see their own offered subset, never the size of the
family's full set. Every family-side and system-side ending collapses into one `closed`
status with the reason server-only. Lesson duration is server-authoritative from the tutor's
published service version. Nothing is held at send; the hold arrives at acceptance and dies
at its natural expiry.

### THE UX REDESIGN IS NOW AUTHORITATIVE

**The owner reviewed the working slice and directed a user-journey and interaction redesign,
which gated PR #17 and is now partly delivered (steps 1-2).** Where this handoff, `docs/design/multi-time-availability-redesign.md`
or any screen disagrees with the redesign below, **the redesign wins**. In particular the
older shortlist-first presentation described in the design document's §3.1 is superseded.

What changes, and what does not:

- **Backend is retained essentially unchanged.** This is a presentation-layer redesign. The
  multi-tutor and multi-time model stays.
- **Shortlisting is optional.** It is a saving and comparison feature, never a prerequisite
  for booking. A family requesting one tutor must never pass through the multi-tutor
  workflow.
- **Multi-tutor fan-out remains, as an optional power feature** reached from the shortlist
  as "Ask shortlisted tutors".
- **Lesson length comes from the tutor's published service durations.** The family chooses
  among what that tutor actually offers. No client-controlled arbitrary durations.
- **A `student_subject_section` is created only at send** — find-or-create at that moment,
  never as a side effect of browsing the booking wizard. At review it is honest to say
  "Mathematics will be added to Fox's subjects."
- **Time options become 1–5, not 2–5**, with copy that recommends rather than requires:
  "Choose one or more times that work for you. Choosing a few gives the tutor more options."
  Planned for step 4, where it is visible.
- **The final action must say it is sending a request**, not claiming a confirmed booking,
  even though the journey may begin under a "Book a lesson" intent.

### Step 1 is COMPLETE — the shared `WeekCalendar` (`10bc283`)

One calendar for the whole product, in `@studdy/design-system`:
`packages/design-system/src/components/calendar/`.

- **Geometry model:** `geometry.ts` is pure — no dates, no time zones. It works in
  wall-clock coordinates: **day index (0 = Monday) plus minutes past local midnight**. The
  caller converts instants using the one zone the platform schedules in, so the grid maths
  is testable without a clock and zone handling lives in one place rather than one copy per
  calendar.
- **Modes:** `read`, `select`, `edit`. Edit supports click-drag create, a resize handle and
  delete.
- **`density="mini"`** drops labels and shrinks rows but **preserves real day and time
  geometry** — it is deliberately not an abstract density heatmap, so a parent can glance
  and see "Tuesday and Thursday evenings".
- **`fittedWindow`** narrows the visible hours to the data, padded to whole hours, so a
  calendar does not waste its height on hours nobody teaches.
- **`familySafe` / `assertFamilySafe`** refuse tutor-private roles (`blocked`, `hold`,
  `lesson`) in any family-facing calendar. The component renders whatever blocks it is given
  and **cannot tell a derived slot from a raw rule by looking** — that is the risk of sharing
  one calendar, so the boundary is asserted rather than assumed.
- **"Preview as family" must be fed the derived positive-only bookable-slot projection**,
  exactly what a family receives — never raw rules, blocks, private notes or exception
  reasons. Only the tutor's own edit mode may receive raw rules and exceptions.

20 geometry tests cover placement, clamping, drag normalisation in both directions,
click-to-create, snapping, window fitting and the family-safe refusal.

---

## 7. Non-obvious things that will bite you

- **`locator.count()` in Playwright does not auto-wait.** Any conditional branch in a spec
  must first wait for the page to render, or the branch is silently skipped.
- **Turborepo runs in strict env mode**, so a task receives only the variables its
  `turbo.json` entry declares. Anything the e2e suite needs must be listed under
  `test:e2e`, or it is stripped before Playwright starts. This is invisible locally because
  `playwright.config.ts` reads `.env.local` off disk itself — so locally every variable
  arrives by a path that does not exist in CI. Adding a variable to the workflow alone does
  nothing. Verify by running with a deliberately wrong value: if nothing fails, it is being
  stripped and a fallback is in use.
- **An e2e journey must survive being run twice.** A Playwright retry of a `mode: 'serial'`
  file re-runs earlier tests against state they already mutated, so any step that assumes a
  pristine account fails on a retry — and reports the wrong cause. Two real instances: a
  shortlisted tutor renders "On your shortlist" instead of the add button, and re-booking an
  identical slot is correctly refused because the previous hold is still live.
- **A `'use server'` file may only export async functions.** Exporting a constant breaks
  the production build but not typecheck — it surfaces only at `pnpm build`.
- **Drizzle wraps driver errors**, so a Postgres SQLSTATE sits on the `cause` chain, not on
  the error itself. `postgresErrorCode()` in `lesson-requests.ts` walks it.
- **`sql.array()` is not valid postgres.js API** — pass a plain array. This typechecks and
  fails at runtime.
- **Never persist a last-used workspace during render.** Next.js prefetches links, which
  silently rewrites the preference. Persist only on explicit user action.
- **Column grants are per database role**, so they cannot distinguish a parent from a tutor.
  Never use them to carry an audience-specific privacy boundary.
- The shared student form uses different labels per path ("Your first name" / "Save my
  profile" vs "Student's first name" / "Add student").

---

## 8. The exact next tasks, in order

Steps 1 to 5 are merged to `main`. Rewrite or update the end-to-end journey alongside each
step rather than leaving all test changes to the end; use targeted tests while building and
the full suite at major boundaries and before PR readiness.

> ### THE NEXT TASK IS NOT STEP 6. IT IS PAYMENTS.
>
> **Directed by the owner on 2026-08-26, after a launch-priority assessment.** Studdy is now
> working against a launch-critical roadmap whose goal is the first real paid lesson, as
> quickly and safely as possible. The historical step 6 visual pass advances none of
>
> `parent sends request → tutor responds → family selects → awaiting_payment → payment →
confirmed booking`
>
> so it is **explicitly deferred**. Not cancelled: once the payment screens exist, a visual
> pass across the whole family journey including them is the natural follow-up.
>
> **Read `docs/design/payments-and-first-paid-booking.md` — it is the authority for this
> work** and carries the approved Gate 0 product decisions, the schema, the Stripe Connect
> architecture, the webhook and idempotency design, the money model and an eight-PR
> sequence. Where it disagrees with the PR sequence in
> `claude/studdy-implementation-plan.md` or with the step 6 section below, that document
> wins.
>
> **Slices 1 and 2 are merged** (`8fa6051` PR #21, `3eaddf3` PR #22). **Slice 3 is
> IMPLEMENTED on `feat/payments-schema-and-pricing` and not merged.** The immediate next
> task is not new implementation: it is the **two open review items** recorded in the slice
> 3 section below — the zero-price boundary, and the ownership of the missing expiry guard.
> Settle those two and nothing else, then stop for the owner's approval before any
> verification, pull request or merge.
>
> Do not reopen any step 5 behaviour: it was reviewed screen by screen and approved, and the
> decisions that look arbitrary are recorded with their reasons in the step 5 section above.

### THE LAUNCH-CRITICAL PAYMENT SLICES — **NOT STARTED**

Full detail, including every schema column and the reasoning behind each choice, is in
`docs/design/payments-and-first-paid-booking.md`. The sequence, in order:

| #   | Branch                                | What                                                          |
| --- | ------------------------------------- | ------------------------------------------------------------- |
| 1   | ~~`feat/payment-window`~~             | **MERGED `8fa6051` (PR #21)** — window, refusal, sweep guards |
| 2   | ~~`feat/inngest-scheduler`~~          | **MERGED `3eaddf3` (PR #22)** — Inngest, every minute         |
| 3   | `feat/payments-schema-and-pricing`    | **IMPLEMENTED `9cadce3`, NOT MERGED** — 2 review items open   |
| 4   | `feat/stripe-connect-onboarding`      | Express accounts, `account.updated`                           |
| 5   | `feat/stripe-payment-intent`          | Payment Element, server-authoritative pricing                 |
| 6   | `feat/stripe-webhooks-and-fulfilment` | **First real paid booking possible here**                     |
| 7   | `feat/resend-outbox-notifications`    | Outbox drain, the seven launch-critical emails                |
| 8   | `feat/admin-settlement`               | Weekly manual tutor settlement                                |

Two rules from that document are worth repeating here, because both are easy to get wrong:

- **The Tutor Request state machine does NOT gain a `confirmed` state.** A paid booking is
  ILR `fulfilled` + reservation `booking_confirmed` + payment `succeeded`, with the winning
  request staying `selected`. The expiry sweep is guarded on the ILR's status instead.
- **No real money is accepted while expiry depends on a manual endpoint.** That is why
  Inngest lands at slice 2 rather than later.

#### Payment slice 3 — **IMPLEMENTED, NOT MERGED. TWO REVIEW ITEMS OPEN.**

On `feat/payments-schema-and-pricing`, branched from `main` at `cfc288c`. Implementation
commit `9cadce3`. **Not pushed. No pull request. Nothing merged.** Read the current HEAD and
ahead count out of git rather than from this file.

The durable, provider-neutral payment ledger and pricing model, built BEFORE any Stripe
integration. No Stripe SDK, no PaymentIntent, no webhook route, no Connect account, no card
on file, no refunds, no payouts. Migrate, seed and every test run with **no provider
configured at all**, which is the point: the ledger has to say what is owed before anything
can be charged.

##### What the schema now contains

Three tables, all in `payments`:

- **`payments.payments`** — the money record. Identity (`PAY-` reference, ILR, tutor request,
  service version), parties (payer user, nullable family account, tutor profile), money, tax,
  provider, state. All money is `bigint` minor units with `char(3)` currency.
- **`payments.payment_events`** — the provider-event ledger. **Schema only; nothing writes
  it.** `provider_event_id` is UNIQUE, so the webhook slice's idempotency will be a database
  constraint rather than an `if` somebody forgets.
- **`payments.tutor_transfers`** — the tutor's entitlement, recorded when a payment succeeds
  and settled manually later. Unique `idempotency_key`, plus a partial unique on `payment_id`
  where `pending|sent` so a re-run of a manual settlement script cannot pay twice.

**`payments.connected_accounts` is DELIBERATELY DEFERRED TO SLICE 4.** Its shape is dictated
entirely by Stripe Connect onboarding — account type, `charges_enabled`/`payouts_enabled`, a
requirements snapshot — so it belongs with the integration that fills it. Nothing in the
ledger needs it: the tutor is identified by their Studdy profile, and `provider_transfer_id`
is nullable until a provider moves money. Slice 4 adds the table and, if wanted, a nullable
`connected_account_id` on `payments` and `tutor_transfers`.

##### The money rules, as implemented

- **NZD only.** Currency is stored per row with a regex CHECK, so a second currency is a data
  change rather than a migration.
- **Studdy's commission is 10%**, held centrally as `payments.platform_fee_rate_bps = 1000`.
- **Alpha default processing-fee payer is `platform`** — Studdy absorbs the cost, and the
  parent is charged exactly the tutor's listed price.
- **Provider cost is nullable and NEVER ESTIMATED.** It is recorded from the provider's own
  figures after settlement. A modelled figure would be a guess wearing a ledger's clothes.
- **No GST logic exists anywhere.** `tax_treatment_code` and `tax_metadata` are present and
  stay null. No tutor registration is assumed. The treatment needs a New Zealand
  accountant's confirmation before production money moves.
- **THE ROUNDING INVARIANT:** the fee is computed and rounded half up, and the entitlement is
  the REMAINDER — never a second rounded calculation. `$33.33` gives `333 + 3000` by
  construction, so the database CHECK that they sum to the lesson cannot fire.
- **ONE VERSION PER RULE**, the slice 1 lesson applied before it could be repeated.
  `rule_settings` versions per key, so the rate and the payer policy move independently and a
  payment snapshots both. `payments.disclosed_processing_fee_minor` is **not seeded and has
  no fallback percentage** — enabling parent-pays without configuring a real amount throws
  rather than putting an invented number on a receipt.

A `$40` lesson: `lesson 4000 · rate 1000 bps · fee 400 · entitlement 3600 · processing fee 0
· total 4000 · provider cost null`.

##### Status model

`requires_payment → processing → succeeded`, plus `failed`, `cancelled`, `expired`. Named for
what Studdy acts on rather than mirrored from Stripe. Two deliberate absences: **no
`processing → expired`** (the sweep must not close a payment whose confirmation is in
flight), and **no `requires_payment → requires_payment`** — a recoverable decline is not a
transition, just `failed_attempt_count` moving, which is what keeps retries on one row.

##### Migration `0007`

Three `CREATE TABLE`s. Integer money throughout, currency regex CHECK, **all nine foreign
keys `ON DELETE restrict`** so a request carrying a payment cannot be deleted, status CHECKs
on all three tables, three arithmetic CHECKs, two partial unique indexes, every provider
column nullable.

The live-payment index is `intended_lesson_request_id WHERE status_code in
('requires_payment','processing','succeeded')`. `succeeded` is inside the set so a paid
lesson can never be paid twice; the three terminal failures are outside it so a family whose
payment genuinely failed can start fresh while their window is open. Ordinary recoverable
declines never create a second row at all.

##### RLS

All three tables classified **`server_only`** — no browser policy, no grant. `check:rls`
passes with **31 tables** (was 28). Family- and tutor-facing figures will be served by
explicit projections; the tutor's projection may show lesson price, Studdy fee and
entitlement, and must never show Studdy's provider cost.

##### Verified at `9cadce3`

| Gate                                           | Result                        |
| ---------------------------------------------- | ----------------------------- |
| domain `src/payments` (pricing + window)       | **35 passing**                |
| `payments.integration.test.ts`                 | **17 passing**                |
| full integration suite                         | **144 passing, 1 skipped**    |
| typecheck / lint / format / `check:boundaries` | green                         |
| `check:rls`                                    | green — 31 tables             |
| fresh `db:reset` → `db:migrate` → `db:seed`    | green, no provider configured |

**Targeted only.** The full sequential verification has NOT been run, and neither has the
full unit suite, the build or the end-to-end suite since this branch began.

> ### THE TWO REVIEW ITEMS. DO THESE FIRST, AND NOTHING ELSE.
>
> **1. The zero-price / payment boundary.**
>
> The pure pricing function intentionally supports arithmetic at zero — `0` in gives
> `0 / 0 / 0` out, and the invariant sweep starts there — because a total function is easier
> to reason about than one with a hole in it.
>
> What is NOT settled is whether the LEDGER should refuse it. Decide whether
> `payments.payments` needs a `lesson_amount_minor > 0` CHECK, or whether the existing
> service-version constraints plus server-side pricing already make a zero-price payment
> structurally unreachable. Inspect before changing: the answer may be that no constraint is
> needed, and adding one that duplicates an existing guarantee is its own cost.
>
> **DO NOT INVENT FREE-LESSON SUPPORT.** This is a question about whether an impossible row
> can be written, not about whether Studdy offers free lessons.
>
> **2. The missing expiry guard, and who owns it.**
>
> `expireOverdueRequests` still lacks the payment-status guard slice 1 deliberately left
> unwritten rather than faked: **a payment that is `processing` or `succeeded` must not have
> its request lapsed out from under a webhook in flight.** The `payments` table now exists,
> so the guard is finally writable.
>
> **IT IS ASSIGNED TO LAUNCH SLICE 5, `feat/stripe-payment-intent`** — before payment rows
> become operational, and not before. **Slice 4 (Connect onboarding) must not own it**:
> onboarding creates no payment rows, so the guard would sit there untested and unexercised.
> Record the assignment; do not implement it in slice 3.

#### Payment slice 2 — **COMPLETE AND MERGED**

Merged as `3eaddf3` (PR #22, squash, 2026-08-31). All four CI jobs and both Vercel checks
green first time, after a full sequential local verification from a fresh database.

**Expiry is now automatic, which was the precondition for accepting real money.** A payment
window measured in minutes is not a promise you can keep with a scheduler that runs only
when a person remembers.

- **Inngest is TRANSPORT and owns no rule.** `apps/web/src/inngest/functions/expire-requests.ts`
  calls `runExpirySweep`, which calls `expireOverdueRequests` — unchanged, still covered by
  integration tests that never mention a scheduler. Swapping Inngest out later is a transport
  change, not a domain one. **Do not move booking or expiry logic into a scheduled function.**
- **Cadence `* * * * *`**, function id `expire-overdue-requests`, slug
  `studdy-expire-overdue-requests`. The cadence is a product promise: the sweep's period is
  the error bar on the hold expiry a tutor is shown.
- **ONE PRODUCTION SCHEDULER.** There is no `vercel.json` and no `"crons"` anywhere. **Do not
  add a Vercel cron back** — the Hobby plan allows a daily schedule, and two schedulers make
  "did it run?" a question with two places to look.
- **`POST /api/jobs/expire-requests` is retained** for operations, and shares the same
  `runExpirySweep`, so the two doors cannot describe one sweep differently. Nothing invokes
  it on a timer.
- **Endpoint config:** `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 300`,
  exporting GET/POST/PUT. Checkpointing's `maxRuntime` is deliberately unset — the function
  has no steps and one database call, and the SDK creates that timer only when explicitly
  configured.
- **Overlapping runs and retries are safe WITHOUT a scheduler-side lock**, because the sweep
  is one status-guarded transaction over `FOR UPDATE SKIP LOCKED` rows. A lock in the
  scheduler would duplicate a guarantee the repository already gives.

> ### PRODUCTION PREREQUISITES — STILL OUTSTANDING, OWNER ACTION
>
> Expiry runs automatically in LOCAL development only until these are done. Nothing expires
> in any deployed environment without them.
>
> 1. **Install the Inngest Vercel integration** and point the app at
>    `https://<host>/api/inngest`. The integration syncs the app on every deploy.
> 2. **Set `INNGEST_SIGNING_KEY`** per deployed environment. Server-only, never
>    `NEXT_PUBLIC_`. Without it the SDK refuses invocations and expiry silently never runs.
> 3. **Configure operational alerting on `expiry run failed`.** A scheduler that stops
>    quietly is indistinguishable from one with nothing to do.
>
> `INNGEST_EVENT_KEY` is OPTIONAL and a deployment must not fail for its absence: the SDK
> needs it only inside `inngest.send()`, which Studdy never calls. Neither key is declared in
> `turbo.json`, deliberately — nothing reads them at build or test time, and Vercel supplies
> them to the deployed function directly.
>
> Note on provider behaviour, recorded as OPERATIONAL DOCUMENTATION rather than a Studdy
> invariant: Inngest's free plan pauses a function after consecutive failures, which at a
> one-minute cadence is a short window. It is a reason to alert, not a rule Studdy enforces.

#### Payment slice 1 — **COMPLETE AND MERGED**

Merged as `8fa6051` (PR #21, squash, 2026-08-30). All four CI jobs and both Vercel checks
green, after a full sequential local verification from a fresh database. What it
established, and what must not be undone:

- **A 60-minute payment window and a 30-minute near-lesson cutoff**, as two INDEPENDENT
  versioned rules (`payments.window_minutes`, `payments.near_lesson_cutoff_minutes`).
  Selection needs the lesson at least 90 minutes away.
- **Nothing clamps.** The deadline is `selectedAt + windowMinutes`, never `min()`'d against
  the lesson start — clamping is exactly what produced zero and negative windows. A lesson
  too close is REFUSED at selection with `LessonTooCloseForPaymentError`, and the
  transaction rolls back, so a refusal writes nothing.
- **Five nullable snapshot columns** on `bookings.tutor_requests`: the deadline, both
  inputs, and ONE RULE VERSION PER INPUT.
- **The expiry sweep is guarded on `ilr.status_code = 'awaiting_payment'`**, which is what
  lets a paid booking keep its winning request `selected` without a new Tutor Request
  state. Rows with no deadline fall back to `acceptance_hold_expires_at`, so nothing in
  flight changed behaviour.
- **The winner's hold moves to the payment deadline** — usually sooner than the acceptance
  hold it replaces, never later. Still `request_hold` until a payment succeeds.
- Slice 3 adds the second sweep guard: a payment that is `processing` or `succeeded` must
  not be swept out from under a webhook in flight. That table does not exist yet, so the
  guard is deliberately unwritten rather than faked.

> ### STANDING TECHNICAL DEBT: `deadline_rule_version` is ambiguous
>
> Carried forward deliberately, and not fixed by slice 1. `deadline_rule_version` on both
> the ILR and the Tutor Request is taken from `requests.response_deadline_tiers` alone,
> while `calculateDeadlines` also reads `requests.decision_grace_hours` and
> `requests.minimum_notice_hours` — each versioned independently, because
> `platform.rule_settings` versions PER KEY. That column therefore cannot say which grace
> or notice value produced a given deadline.
>
> It is the same class of ambiguity the owner caught in slice 1's payment snapshot, where
> it was fixed by splitting the version columns. This one is PRE-EXISTING, touches no
> money, and was left alone rather than widening a payment slice. Worth a small follow-up
> of its own; also recorded in `docs/design/payments-and-first-paid-booking.md`.

### Step 2 — calendar-first `/tutor/availability` — **COMPLETE**

Delivered across `793937a` (function), `e37933b` (a real week grid), `a0d3507` (teaching-day
window, shared editor, format scoping) and the accessibility close-out at HEAD.

What it is now: days as columns with time down a gutter, a fixed 08:00–22:00 teaching window
widened — never narrowed — by anything already on the calendar, click-drag create, resize,
delete, week navigation by URL, visually distinct holds and confirmed lessons, and
"Preview as family" as a SEPARATE SERVER RENDER on `?preview=1`.

Availability is editable two ways on purpose: direct manipulation for speed, and one shared
dialog for precision and discoverability. `+ Add`, a drag, and clicking a block all open the
SAME editor — prefilled where there is something to prefill. Resize stays outside it.

Availability now carries a lesson-format scope (`online` / `in_person` / `any`) that really
decides what is bookable: `availability_rules.lesson_format_code` used to be dead — the
domain type dropped it before the derivation ever saw it — and one-off additions gained the
same column in migration `0004`. A `removes` is deliberately never format-scoped. Passing no
format behaves exactly as before, which is what keeps the still format-blind callers correct.

The original step-2 file list below is kept for orientation; the code has moved on.

Rebuild the tutor's availability screen around the week calendar: days as columns, time
vertical, click-drag to create, resize, edit, delete, repeat-weekly, one-off additions,
one-off blocked periods, week navigation, and visually distinct holds and confirmed lessons
when they exist. Replace the long "What families can book" pill list with a
**"Preview as family"** mode fed the derived projection.

**Backend addition required.** Availability rules and exceptions currently support create
and archive only — there is no update path, so a resize would otherwise archive-and-recreate
and lose identity. Add `updateAvailabilityRule` and `updateAvailabilityException`, guarded on
ownership exactly as `archiveAvailabilityRule` is.

Most relevant files:

| File                                                                 | Why                                                                                                       |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/tutor/availability/page.tsx`                       | the screen to rebuild                                                                                     |
| `apps/web/src/app/tutor/availability/availability-forms.tsx`         | the list-and-form UI being replaced                                                                       |
| `apps/web/src/lib/availability/actions.ts`                           | server actions; needs update actions                                                                      |
| `packages/database/src/repositories/availability.ts`                 | `listAvailabilityRules`, `listAvailabilityExceptions`, create/archive — add the two update functions here |
| `packages/database/src/index.ts`                                     | export the new functions                                                                                  |
| `packages/design-system/src/components/calendar/week-calendar.tsx`   | the primitive to drive                                                                                    |
| `packages/design-system/src/components/calendar/geometry.ts`         | wall-clock coordinates and `assertFamilySafe`                                                             |
| `packages/domain/src/availability/presentation.ts`                   | `zonedDateOnly`, `zonedClockTime`, `zonedTimeToUtc` — instant ↔ wall-clock conversion                     |
| `apps/web/src/lib/time.ts`                                           | `PLATFORM_TIME_ZONE`, `availabilityWindow`                                                                |
| `packages/database/src/integration/availability.integration.test.ts` | privacy assertions that must keep passing                                                                 |

### Step 3 — discovery mini calendars and the tutor-profile calendar — **COMPLETE**

Approved by the owner and **merged as `7ad4923`** (PR #18, squash, 2026-08-23), branched from
`e37d9c5`. All four CI jobs and the Vercel checks were green on the merged commit.

Discovery cards carry a mini week calendar (`density="mini"`, `familySafe`) and the tutor
profile a full-size read-only one with paged navigation. `tutor-slots.tsx` and its pill
lists are gone. The primary action on a card is "See times & book" and on the profile
"Request a lesson"; shortlisting is a quiet "Save for later" beside them.

**Seven days from TODAY, not from Monday.** The tutor's own calendar stays Monday-anchored
because a tutor arranges a repeating week. A family asks "when could we start?", and a
Monday anchor opened on a Saturday spends five of seven columns on days already gone — which
come back empty, because availability is only derived forwards. An empty column on a family
calendar reads as time the tutor is not free. `availabilityView` in
`apps/web/src/lib/discovery/availability-view.ts` decides the days once, so a card and the
profile a parent clicks into always show the same seven.

**Three different windows, on purpose.** The tutor's editor keeps a broad fixed day because a
tutor is CREATING availability and needs somewhere new to draw. Discovery cards share ONE
window across the page (`familyCalendarWindow`, 8am–9pm widened to cover every block on the
page) because their whole job is comparison — fitted per card, the same height would mean 4pm
on one and 7pm on the next. A profile is neither: `profileCalendarWindow` fits that one tutor's
own hours, with ninety minutes of context either side and a six-hour minimum so it cannot hug
the blocks. A parent on a profile has already chosen the tutor and is reading, not comparing or
drawing, so empty morning hours cost legibility and buy nothing.

**Do not give discovery the profile window.** The unit suite asserts the two differ; a
per-tutor window on the cards silently destroys the comparison the cards exist for.

**Read-only views merge contiguous slots.** Derived slots are start times, so an hour lesson
offered every half hour reads as overlapping stripes. `mergeContiguousBlocks` joins runs that
touch or overlap and labels each band "4 pm – 7 pm". A genuine gap survives; nothing is joined
across days or across roles. **Step 4 must NOT merge** — once a family picks a time, the
difference between a 4:00 and a 4:30 start is the thing being chosen.

**Signed-out visitors get no derived availability, and no empty calendar either.** Cards keep
the coarse label plus "Sign in to see available times"; the profile shows "Sign in to view this
tutor's live availability" where the grid would be. Seven blank columns would be a claim about
that tutor rather than about what the visitor may see. The access boundary was not weakened.
There are three of these prompts, not one — signed out, signed in without a subject, and signed
in with no subjects at all — because the reason differs and none of them is "this tutor is busy".

**No control promises anything `/book` cannot yet deliver.** The card's primary action reads
"View availability" and opens the profile — step 4 renames it once `/book` exists. The profile
carries an informational callout, "Booking a lesson here opens shortly", and NO booking button
at all. An earlier draft had a disabled primary there; a greyed-out primary still reads as an
action withheld from this parent, as though something about them were incomplete, when in fact
the journey simply does not exist yet. The e2e asserts no such control is present.

**Navigation is bounded by the published horizon** (`?week=1|2`, clamped server-side). Walking
past 14 days would render empty days that read as an absence of availability rather than of
data.

**Two bugs found and fixed on the way, both invisible to text assertions.**

1. `WeekCalendar` skipped the time-gutter cell in its header when `density="mini"`. Header and
   body share one column template and grid fills tracks in order, so every heading sat one
   track left: Monday's name over Sunday's column. Nothing was missing from the page — the
   calendar simply named the wrong days. Both discovery and tutor geometry specs now assert
   that every column's left edge is also a heading's left edge.
2. The `discovery_tutors` seed placed its blocked period at `now + 3 days`, which fell into
   NEXT week whenever the seed ran on a Friday, Saturday or Sunday — so
   `tutor-availability.spec.ts`'s "preview as family" test failed on three days in seven, for a
   reason unrelated to privacy. It is now anchored to the Sunday of the current New Zealand
   week (`endOfCurrentNewZealandWeek`). The weekday is read in the scheduling zone, not UTC,
   because those disagree for half of every New Zealand day.

**New and changed files**

| File                                                               | What                                                                                                                                                |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/discovery/availability-view.ts`                  | the seven days, labels, paging bounds and the screen-reader summary                                                                                 |
| `apps/web/src/components/discovery/tutor-availability-mini.tsx`    | the card calendar and its three prompts                                                                                                             |
| `apps/web/src/components/discovery/tutor-availability-week.tsx`    | the profile calendar, navigation and sign-in placeholder                                                                                            |
| `apps/web/src/lib/availability/calendar-projection.ts`             | `familyPreviewBlocks` renamed `bookableSlotBlocks`; added `FAMILY_CALENDAR_WINDOW`, `familyCalendarWindow`, `mergeContiguousBlocks`                 |
| `packages/design-system/src/components/calendar/week-calendar.tsx` | mini body height 96 → 132; header gutter cell always rendered; edge hour labels no longer clipped; quieter mini hour rules; `data-calendar-heading` |
| `apps/web/src/components/discovery/tutor-card.tsx`                 | rebuilt around the calendar; booking primary, shortlist quiet                                                                                       |
| `apps/web/src/app/(discovery)/tutors/page.tsx`                     | derives blocks once, shares one window                                                                                                              |
| `apps/web/src/app/(discovery)/tutors/[reference]/page.tsx`         | calendar replaces the list; `max-w-3xl` → `max-w-5xl` so seven columns fit                                                                          |
| `packages/database/src/seed/scenarios/discovery-tutors.ts`         | the seed date fix above                                                                                                                             |
| `apps/web/scripts/step3-review-shots.mjs`                          | throwaway: writes the review screenshots into `.review/step3`                                                                                       |

**No backend or query change was needed.** `bookableSlotsForSubjectSection` already accepts an
arbitrary `from`/`to`, so paging is a page concern; `bookableSlotBlocks` was already the one
projection that crosses the privacy boundary.

**Verified:** typecheck, lint, format, `check:rls` (28 tables), `check:boundaries`, build,
**333 unit and integration tests passing with 1 skipped** (up from 307), **86 end-to-end**
(up from 80), all after `db:reset && db:migrate && db:seed`.

**Reviewed by the owner on 2026-08-23 and corrected**: the profile window was fitted rather
than fixed, the card action renamed from "See times & book" to "View availability", and the
disabled booking primary replaced with a callout. The rolling seven-day view and the mobile
horizontal scroll with its hint were both confirmed as wanted and left alone.

**Screenshots** for the review point live in `.review/step3` (gitignored), regenerated by
`node apps/web/scripts/step3-review-shots.mjs <baseURL> <outDir>`. Point it at a production
server (`pnpm build` then `pnpm --filter @studdy/web start --port 3200`) rather than `pnpm dev`:
the dev server on this machine wedges when a build runs against the same `.next` directory.

### Step 4 — the parent `/book` journey — **COMPLETE AND MERGED**

Approved by the owner and **merged as `d676f13`** (PR #19, squash, 2026-08-26), from
`feat/parent-booking-journey`. All four CI jobs and both Vercel checks were green on the
merged commit.

> **One CI failure on the way, and it was not real.** The first run failed
> `Typecheck, lint, unit tests, build` with
> `Could not find the module ".../reset-password/reset-request-form.tsx#ResetRequestForm"
in the React Client Manifest` while prerendering `/reset-password` — a page this branch
> never touched. Its only auth-adjacent change was adding `/book` to the middleware's
> protected prefixes, which cannot affect a client manifest. A cold local build
> (`rm -rf .next` plus `turbo run build --force`, exactly CI's conditions) compiled and
> prerendered fine, and re-running the identical commit passed. It is a
> non-deterministic Next.js RSC bundler fault. **If it recurs, re-run before investigating
> the diff — but confirm the failing page is one the branch does not touch first.**

#### The journey

Child → Subject → Tutor → Lesson length → Online/in person → Times → Review →
**Send request**. Every question is asked, however few options it has (see the
auto-selection reversal below).

- One route per step under `/book`, server-rendered. `/book` itself redirects to the first
  question still genuinely open.
- **Single-tutor is the normal journey.** The shortlist stays optional and is never a
  prerequisite; the multi-tutor fan-out remains reachable only from the shortlist.
- **Direct entry prefills.** A tutor card or profile links to
  `/book?child=…&subject=…&tutor=…`, and any answer that still validates is skipped.
- **Multiple lesson durations are supported.** A tutor may publish several priced versions
  for one subject; the family chooses among them.
- **The service version is server-authoritative.** Only a version id travels in the URL —
  never a price or a duration — and it is validated as belonging to that tutor and that
  subject, published and current, before anything is priced from it.
- **A single-option step is settled, not asked.** Where a version can be delivered one way,
  the format answer is carried forward and the screen never appears.
- **1–5 acceptable times.** Copy recommends more without requiring it:
  `TIME_OPTIONS_GUIDANCE` — "Choose one or more times that work for you. Choosing a few
  gives the tutor more options." The bound is a single configured rule shared with the
  fan-out journey, so the two cannot drift apart.
- **Selectable starts every 15 minutes**, and **exact starts stay distinct** — the booking
  calendar must never call `mergeContiguousBlocks`, because 4:00 and 4:30 are the choice.
- **Optional tutor note at Review** (`notesForTutors`), not a wizard step of its own.
- **The final action says "Send request to <tutor>"**, never Book or Confirm. A tutor still
  has to accept.
- **No Stripe or payment work.** `hasPaymentMethodOnFile` is false and the gate is disabled.

#### Nothing is persisted while browsing

There is no draft row, no session blob and no half-made `student_subject_section`: opening
the wizard cannot change a child's record. The answers live in the URL, which means every
parameter is attacker-controlled, so `resolveBooking` re-checks all of them on every request
— the child against who this user may act for, the tutor through the bookable allow-list,
the version against that tutor's own rows. An answer that no longer resolves is dropped
along with everything downstream.

**The subject section is created atomically with a successful send.**
`createIntendedLessonRequest` takes a `subjectSectionDraft` instead of an id, and the
find-or-create runs inside the transaction that already writes the request, its time
options, the tutor request and the hold. Either all of it commits or none does, so a send
that loses a race for a slot leaves the child unchanged rather than carrying a subject they
never agreed to study. All validation before the transaction is read-only.
`student_subject_sections_live_unique_idx` already existed, so it is concurrency-safe with
no lock and no migration.

#### The progressive summary

- **Desktop:** the current question beside a persistent `Your request so far` panel.
- **Answered rows carry a `Change` action**, which drops the answers that depended on them
  exactly as `paramsUpTo` already did.
- **Mobile:** the same rows as an accordion — completed above, waiting below, only the
  current route visually expanded. Tapping a completed section reopens it.
- **Completed and skipped single-option choices stay visible as settled context**, the
  latter marked `(only option)` so the parent is not credited with a decision they were
  never offered.
- **The same server-authoritative URL/resolution model underneath.** No separate
  client-side booking draft exists.
- **Review is the completed version of that same summary**, not a second presentation. The
  shell suppresses the panel on Review so the six answers never appear twice at once.

ONE DOM, TWO SHAPES: only the static summary markup is duplicated, each copy hidden by
`display: none` at the other width so neither is read twice. **The question is rendered
once** — duplicating it would double-mount its form.

#### Timing and the minimum gap between lessons

- **`tutors.tutor_profiles.minimum_gap_minutes`, default 15.** One tutor-level figure; NOT
  split by online/in-person. A per-format travel buffer (§8.8) is a larger idea and half of
  one would be worse than one honest number.
- **The tutor configures it from `/tutor/availability`**, beside the calendar, because it
  decides what families can be offered exactly as the drawn hours do.
- **15-minute granularity is server-authoritative.** `SLOT_STEP_MINUTES` lives in
  `packages/domain/src/availability/slots.ts`; the booking calendar imports it so drawn
  markers cannot drift from what is derivable. The send path still passes `stepMinutes: 1`
  deliberately — that asks "is this exact interval inside open time", not "does it sit on
  our display grid".
- **Each reservation snapshots the gap** in force when it was taken (`gap_minutes`).
- **Real `start_at` and `end_at` are never padded** — the tutor's calendar, the request
  records and the family's confirmation all read them.
- **A persisted effective interval enforces the snapshotted gap:**
  `effective_end_at = end_at + gap_minutes`.
- **The GiST exclusion constraint uses the effective interval**
  (`constraints/0006_reservation_gap_exclusion.sql`), not the bare lesson interval.
- **Later changes to the tutor's setting never alter existing reservations.** The live value
  governs only what may be taken next.

**THE ASYMMETRY IS DELIBERATE AND BOTH HALVES ARE LOAD-BEARING.** `bookableSlots` widens
each existing reservation on **both** sides, because it evaluates ONE candidate against
existing reservations holding only those reservations — the candidate must neither begin too
soon after one nor end too soon before one, and there is no second row's padding to lean on.
The database pads **one** side per reservation, because there every row carries its own
padding, so exactly one gap is counted between any two; padding both sides of both rows
would demand two. A lesson placed too close _before_ an existing one is still caught, by its
own padding running into that lesson's start.

**Blocked availability periods are NOT widened.** A holiday is time off, not a lesson
needing turnaround; widening it would quietly cost bookable time either side of every break.

#### Fixes, traps and debts found during step 4

1. **Chosen service version was last-wins.** `createIntendedLessonRequest` keyed versions by
   tutor id alone, so a tutor with two lengths kept whichever row returned last — a family
   choosing 90 minutes could be charged for 60, with nothing recording it. Now looked up
   among that tutor's rows for that subject only.
2. **Multi-version tutors duplicated in discovery.** `bookableSlotsForSubjectSection`
   returned one entry per version, so a card derived the same tutor twice and rendered an
   arbitrary length. Now one entry per tutor at the cheapest published length — the one the
   card's "from" price already quotes.
3. **The mini calendar silently lost a day.** In `mini` density the body skipped the gutter
   cell while the header rendered it, so the first day fell into the zero-width gutter track
   and the seventh was pushed off the end. Both grids now always render the cell; both
   calendar specs assert seven day columns each with real width.
4. **Overlapping booking slots were unclickable.** Drawn at full lesson length, half-hourly
   slots overlap, and an absolutely positioned block covers the one beneath it — every start
   but the last was unreachable. Slots are now **start markers** one step tall, which is
   also what is being chosen; the length is stated once in the heading.
5. **The generated migration would have failed on a populated table.** Drizzle emits a bare
   `ADD COLUMN effective_end_at ... NOT NULL`. Hand-completed to add with a temporary
   default, backfill from `end_at`, then tighten — **before the file had been applied
   anywhere.** The immutability rule protects migrations that have already run.
6. **New reviewed SQL replaces the exclusion constraint** rather than mutating the applied
   `constraints/0005_reservation_exclusion.sql`.
7. **A `'use server'` file may only export async server actions.** Exporting
   `MINIMUM_GAP_CHOICES` from one passed typecheck and broke only `pnpm build`. Constants
   belong elsewhere; it lives in the domain, where it is policy anyway.
8. **Playwright swallowed clicks before hydration.** The first interaction after a load can
   land before React hydrates and vanish — no navigation, no error. No timeout fixes it, and
   waiting for a URL _pattern_ succeeds spuriously because a swallowed click leaves the URL
   unchanged. `e2e/helpers/navigation.ts` waits for the URL to **change**, and treats a
   vanished link as success. Reach for it where a link is clicked soon after a load or
   another navigation.
9. **State-mutating E2E needs its own account AND its own tutor.** `booking-journey` sends
   real requests, taking real calendar holds. It uses `parent.booking@` and books
   **Mei / English** exclusively; sharing either broke other specs in ways that read as
   product bugs. It is also excluded from the mobile project, as the other journey specs are.

#### Verified gate state after the final UX pass

| Gate                                       | Result                                |
| ------------------------------------------ | ------------------------------------- |
| `pnpm typecheck`                           | green                                 |
| `pnpm exec turbo run lint --concurrency=2` | green — 9/9                           |
| `pnpm format`                              | green                                 |
| `pnpm check:rls`                           | green — 28 tables classified          |
| `pnpm check:boundaries`                    | green                                 |
| `pnpm build`                               | green — clean rebuild, cache bypassed |
| Unit                                       | **389 passing, 1 skipped** (was 361)  |
| Integration                                | **110 passing, 1 skipped**            |
| `booking-journey.spec.ts`                  | **12 passing** (was 9)                |

All after `pnpm db:reset && pnpm db:migrate && pnpm db:seed`. The +28 unit tests are
`sections.test.ts` (18) and `time-labels.test.ts` (10); the +3 end-to-end cover the mobile
accordion, that a one-option question is still asked, and that a chosen time is shown as
the whole lesson interval.

> **The full suite was run clean before merge**, sequentially from a fresh database with
> nothing else on the machine: **98 end-to-end passing in 2.6 minutes**. An earlier run of
> the same suite, sharing the machine with a build and the unit suite, took 1.7 hours and
> produced one failure — which passed 8/8 when re-run alone. Same code, same seed.
>
> **Contention, not code.** A test whose recorded duration far exceeds its own timeout — a
> 30s timeout reported after 9.9 minutes — is a starved machine. Re-run the spec alone
> before characterising it as a defect.

#### The final UX pass (owner-directed, after the step 4 direction was approved)

Four changes, all presentation-layer. The route-per-step, server-authoritative model is
unchanged; no client-side booking draft was introduced.

1. **Mobile is a real accordion.** Completed sections collapse above the open question,
   each with its label, its answer and a chevron; the open question sits beneath its own
   section header; the rest wait below, dashed. Tapping a completed section reopens it and
   closes the current one — which needs no client state, because each ROUTE already is one
   section expanded. Only the static summary markup differs between the two widths, each
   copy hidden by `display: none` at the other, so nothing is read twice; the question is
   still rendered once.
2. ~~A question with one valid answer is no longer asked.~~ **REVERSED — see below.**
3. ~~Settled answers offer no `Change`.~~ **REVERSED — see below.**
4. **Subject copy is one sentence,** in the step description. The `Nothing is saved yet`
   callout is gone; the prominent notice stays on Review, where the write actually happens.

#### THE AUTO-SELECTION RULE WAS REVERSED BY THE OWNER. Do not reinstate it.

An intermediate version of this pass skipped any step whose question had a single valid
option — one child, one eligible tutor, one length, one format — and marked the answer
`(only option)` in the summary. **The owner withdrew that rule before merge, and the
distinction they drew is the thing to remember:**

> `only one option currently matches` is NOT `the parent chose that option`.

Studdy does not make preference decisions on a family's behalf. That Aroha is the only
tutor teaching this subject at this level is a fact about SUPPLY; it says nothing about
whom this parent wants, and a parent shown "Aroha is the only tutor" may perfectly well
decide to browse instead. Skipping the question removes that decision while appearing to
have made it. The same holds for format: "online only" is a condition of the lesson, and a
family who needs someone in the room must meet it while going back is still cheap.

**So every step is asked, however few options it has.** The screens stay light and say why
there is only one — the tutor step names the scarcity and keeps "Browse every tutor"
beside it; the format row reads "Mei offers this lesson online only". `(only option)` is
gone, and every answered row offers `Change` again, because every one of them is now a
choice the parent actually made.

**PREFILLING IS DIFFERENT AND STILL ALLOWED.** An answer already in the URL is there
because the family did something — `Aroha profile → Book a lesson` IS choosing Aroha — so
it is carried in, shown in the receipt and accordion, and stays changeable. The rule in one
line: **prefill an explicit prior choice; never infer one from the fact that only one row
happens to match.**

`resolveBooking` therefore adds nothing the family did not supply; it only CLEARS answers
that no longer validate, so a stale tutor or an unpublished price cannot travel forward.

#### 5. A chosen time is shown as the lesson's interval

Starts are offered every fifteen minutes, but the family is not choosing fifteen-minute
blocks. On the calendar a marker stays compact (`4:15`) because the heading has just said
how long the lesson is; the moment a time is chosen it leaves that context, so from then on
it reads as the span the lesson occupies — in the chips under the calendar, the desktop
receipt, the mobile Times section and Review. `bookingIntervalLabel` in
`apps/web/src/lib/booking/time-labels.ts` is the single place that decides the wording.

- 60 minutes: `4:00–5:00 pm`, `4:15–5:15 pm`, `4:30–5:30 pm`
- 90 minutes: `4:00–5:30 pm`
- crossing midday: `11:30 am–12:30 pm` (the meridiem is said once only when both ends agree)

> **THE MINIMUM GAP IS NEVER IN THE DISPLAYED INTERVAL.** A 60-minute lesson at four
> o'clock is `4:00–5:00 pm` even where the tutor keeps fifteen minutes clear and cannot
> take another lesson until 5:15. That gap is scheduling protection for the tutor, not
> lesson time the family asked for or is paying for.

#### 6. Preferred times read as alternatives

`TIME_OPTIONS_GUIDANCE` is now "Choose one or more times that work for you. The tutor can
accept one of them." The picker counts "2 preferred times chosen" and adds "These are
alternatives — Mei can accept any one of them"; the receipt, accordion and Review list each
interval on its own line under `Any one of these`, never comma-joined. A joined list reads
as several lessons being requested, which may make a family offer fewer times — the exact
opposite of what the guidance is for.

**A note on where times appear.** While the family is still picking, the selection lives in
the picker and only reaches the URL on Continue, so the receipt correctly reads "Not yet"
mid-selection. It holds intervals once the times are in the URL — on Review, and on the
times step reached by going Back. This is by design, not a gap in the wiring.

**`minimum_gap_minutes`, the 15-minute grid, 1–5 times, the desktop receipt, Review as its
completed form, mobile calendar scrolling, the snapshotted gap and effective-interval
exclusion, the atomic send and the request-not-booking language are all unchanged.**

New: `apps/web/src/lib/booking/sections.ts` (pure — the accordion model, `unaskedSteps`,
`previousAskedStep`), `apps/web/src/lib/booking/time-labels.ts` (pure — the interval
wording), their two test files, and
`apps/web/src/components/booking/booking-accordion.tsx`. `previousAskedStep` fixed a real
bug on the way: the old Back walk stopped at index 0 even when the first step was skipped,
so Back could land on a question the journey had just decided not to ask.

#### Review screenshots

`S:\Studdy\.review\step4\` (gitignored), **twenty-two images**, regenerated after the
auto-selection reversal. The previous set is kept at `S:\Studdy\.review\step4-previous\`.

Every question is now shown, so the walk is the full journey again:

| Screen                            | Desktop                            | Mobile                            |
| --------------------------------- | ---------------------------------- | --------------------------------- |
| Discovery entry point             | `desktop-0-discovery-entry`        | `mobile-0-discovery-entry`        |
| Child — one option, still asked   | `desktop-1-child`                  | `mobile-1-child`                  |
| Subject                           | `desktop-2-subject`                | `mobile-2-subject`                |
| Tutor — one option, reason given  | `desktop-3-tutor-single-option`    | `mobile-3-tutor-single-option`    |
| Lesson length                     | `desktop-4-length`                 | `mobile-4-length`                 |
| Format — one option, reason given | `desktop-5-format-single-option`   | `mobile-5-format-single-option`   |
| Format — two options (other walk) | `desktop-5b-format-two-options`    | —                                 |
| Times, none chosen                | `desktop-6-times-empty`            | `mobile-6-times-empty`            |
| Times, two chosen (intervals)     | `desktop-7-times-chosen`           | `mobile-7-times-chosen`           |
| Review                            | `desktop-8-review`                 | `mobile-8-review`                 |
| Receipt holding times             | `desktop-9-receipt-with-intervals` | `mobile-9-receipt-with-intervals` |
| Tutor minimum gap                 | `desktop-10-tutor-minimum-gap`     | —                                 |

`-9-receipt-with-intervals` is reached by going BACK from Review, which is the state where
the receipt itself holds the times. `desktop-5b` comes from a separate walk on a Year 12
student and James's Calculus, the one seeded version delivered both ways.

Two of these carry the corrections most directly: `*-3-tutor-single-option` shows the sole
tutor OFFERED with the scarcity named and "Browse every tutor" beside it, and
`mobile-9-receipt-with-intervals` shows compact quarter-hour markers on the grid
(`4 pm`, `4:15 pm`) alongside chosen chips reading `Wed 26 Aug · 4:00–5:00 pm` and
`4:30–5:30 pm`, under "These are alternatives".

> **THREE ENVIRONMENT TRAPS COST REAL TIME HERE. All three present as product bugs.**
>
> 1. **A `next start` from a previous session can still hold port 3200.** A readiness probe
>    then passes against YESTERDAY's code, and the walk photographs the old build — with
>    CSS 404s, because `.next` was rebuilt underneath that process and its asset hashes no
>    longer exist. It reads exactly like a broken stylesheet plus a feature that does not
>    work. Kill the port and prove the listener is yours before trusting a screenshot.
> 2. **Building over a `.next` that a server is reading corrupts it:**
>    `TypeError: a[d] is not a function` from `webpack-runtime.js` on every route. It still
>    answers `/`, so probe a real page — the scripts now require `/sign-in` to return 200.
>    Only `rm -rf .next` plus `turbo run build --force` clears it; the cache will otherwise
>    restore the same broken output.
> 3. **Never branch a walk on `page.url()` after a redirect.** A settled step forwards, so
>    the URL read can catch the step being LEFT rather than the one arrived at, and the
>    branch then waits for a heading that is never coming. Both scripts now decide on the
>    heading that actually rendered, and treat every skippable hop as optional.

Regenerate against a PRODUCTION server, never `pnpm dev`:

```bash
pnpm build && pnpm --filter @studdy/web start --port 3200
```

```bash
node apps/web/scripts/step4-review-shots.mjs http://localhost:3200 S:/Studdy/.review/step4
```

```bash
node apps/web/scripts/step4-review-extras.mjs http://localhost:3200 S:/Studdy/.review/step4
```

The extras script covers the three screens the main walk cannot reach: the discovery entry
point (needs a subject context), the format step (needs a tutor teaching both ways — James's
Calculus at Years 10–13, so a senior student), and the tutor's minimum-gap control.

> **THE FINAL PROGRESSIVE-SUMMARY AND MOBILE-ACCORDION SCREENSHOTS STILL NEED THE OWNER'S
> REVIEW BEFORE ANY PR OR MERGE.** They changed after the last set the owner approved.

### Step 5 — the optional multi-tutor journey — **COMPLETE AND MERGED**

Approved by the owner and **merged as `a738913`** (PR #20, squash, 2026-08-26), from
`feat/optional-shortlist-and-fan-out`. All four CI jobs and both Vercel checks were green on
the merged commit. This section records the APPROVED behaviour; do not change any of it
without the owner asking.

**Verified gate state before merge**, run sequentially from a fresh database with nothing
else on the machine:

| Gate                                       | Result                                |
| ------------------------------------------ | ------------------------------------- |
| `pnpm typecheck`                           | green                                 |
| `pnpm exec turbo run lint --concurrency=2` | green — 9/9                           |
| `pnpm format`                              | green                                 |
| `pnpm check:rls`                           | green — 28 tables classified          |
| `pnpm check:boundaries`                    | green                                 |
| `pnpm build`                               | green — clean rebuild, cache bypassed |
| Unit                                       | **430 passing, 1 skipped** (was 389)  |
| Integration                                | **115 passing, 1 skipped** (was 110)  |
| End-to-end                                 | **98 passing in 2.4 minutes**         |

> **THE FIRST FULL END-TO-END RUN CAUGHT SOMETHING TARGETED RUNS NEVER TOUCHED.**
> `family-students-discovery` still looked for the shortlist's old two-sentence
> reassurance, which the reframing had rewritten into one sentence several commits
> earlier. The page still made the promise, so the spec now pins the GUARANTEE
> rather than the phrasing — but the failure sat there undetected through every
> targeted run of the slice. Targeted tests while building, the full suite before
> a pull request: both halves of that rule earn their keep.

#### The shape of the product, and why

- **The shortlist is a saving-and-comparison surface, not a way to book.** A family saves
  tutors against one `student_subject_section` in order to compare them. Each card's primary
  action is `Book a lesson`, into the ordinary single-tutor journey.
- **The normal way to book is `/book`.** Single-tutor is the main road. Shortlisting is never
  a prerequisite, and a family asking one tutor must never be routed through the multi-tutor
  workflow.
- **`Ask multiple tutors` is the optional power journey**, a quiet block at the foot of the
  shortlist, offered **only where more than one tutor is saved** — with one saved it is the
  booking journey wearing a longer coat.
- **`/requests/new` is folded in, not patched**, and `/shortlist/[id]/times` redirects into
  the journey. One composer, one set of rules. The old composer asked for times without ever
  establishing what lesson was being requested, and defaulted the format to `online` without
  asking.

#### One request is one lesson

`/shortlist/[id]` → `/ask/length` → `/ask/format` → `/ask/times` → `/ask/review` → send.
Answers live in the URL and are re-resolved on every request, exactly as `/book` does.

- **One shared duration and one shared format for the whole request.** A chosen start has to
  mean the same interval for every tutor asked, which is only possible if both are settled
  before anyone's availability is drawn. That is why length is asked FIRST.
- **A mixed set of lesson lengths is REFUSED SERVER-SIDE, unconditionally.** It used to be
  reconciled — `familyDurationMinutes = Math.max(...)` took the longest — which is exactly
  what this abolishes. The guard does not depend on the caller asserting
  `requestedDurationMinutes`: a caller that says nothing about length must not be handed a
  reconciled one.
- **A format the tutor's own version cannot deliver is REFUSED SERVER-SIDE.** `formatsForCode`
  is extracted so the request path and `/book` share one rule; two copies is how an
  online-only tutor gets sent an in-person lesson.
- **Both guards live in the repository, not in the screens.** Every URL parameter is
  attacker-controlled and the screens are one caller among several, so a rule about what a
  request may CONTAIN belongs where the request is written.
- **Compatibility counts are shown, not acted on**: `60 minutes · 2 of 2 shortlisted tutors
offer this`, `90 minutes · 1 of 2`. The denominator is tutors who still offer the subject.
- **Nobody is silently dropped.** A shortlisted tutor who cannot take the request stays
  VISIBLE under `Not included`, with a neutral reason about the LESSON rather than about
  them — "Doesn't offer 90-minute Mathematics lessons". They stay on the shortlist. A tutor
  quietly missing from a request is, to the family, indistinguishable from one who declined.
- **A question with one eligible option is still asked**, here as in `/book`. That one
  duration reaches this shortlist is a fact about SUPPLY, never a preference this family
  expressed.

`packages/domain/src/bookings/fan-out-eligibility.ts` is the pure rule the journey draws
from: `durationChoices`, `formatChoices`, `resolveFanOutEligibility`, `exclusionLabel`.

#### The times step IS the booking calendar

The screen was a chronological list of every quarter-hour start across the whole fortnight —
about a hundred and eighty checkboxes, **roughly 7,300 pixels tall**. It is now the step 4
interaction, and the desktop page is about 1,600.

- **`WeekCalendar` in `select` mode**, one seven-day week at a time, `hourHeight={128}`,
  `Earlier`/`Later` paging that CARRIES the selection, a window fitted to the tutors being
  asked, the today marker, the screen-reader summary and `familySafe`. A `week` parameter
  travels in the URL exactly as it does in `/book`, and `askParamsUpTo` drops it so reopening
  an earlier question lands on week one rather than on whichever page the calendar was left
  showing.
- **Availability is derived at the SELECTED SHARED DURATION AND FORMAT**, over the INCLUDED
  tutors' profile ids, through `bookableSlotsForTutors` — `apps/web/src/lib/ask/availability.ts`.
  **This was a real defect the rebuild had to fix.** The old screen used
  `bookableSlotsForSubjectSection`, which derives at each tutor's own CHEAPEST published
  length and takes no format at all, because it exists to draw discovery cards — so a family
  choosing 90 minutes was offered starts derived for 60-minute lessons.
- **15-minute start granularity**, from `SLOT_STEP_MINUTES`, imported rather than restated so
  a marker cannot drift from what is derivable.
- **The union across the included tutors**, via `combineSlotsByStart`. A start is selectable
  when **at least one** included tutor can offer it.
- **Starts are drawn as one-step MARKERS, never at full lesson length.** Slots derived every
  fifteen minutes and drawn an hour long overlap, and an absolutely positioned block covers
  the one beneath it — so every start but the last became physically unclickable. And never
  call `mergeContiguousBlocks` here: 4:00 and 4:30 are the choice being made.
- **A marker carries its start time and nothing else** — `4 pm`, `4:15 pm`, from the shared
  `clockLabel`, visually identical to `/book`.
- **COMPATIBILITY NAMES BELONG IN THE SELECTED-TIMES SUMMARY, NOT ON EVERY MARKER.** A ratio
  on each marker (`1 of 2`, `2 of 2`) was built, screenshotted and REJECTED by the owner: a
  second line on a hundred and eighty quarter-hour blocks makes the week unreadable, worst on
  a phone, and the parent's job on the grid is simply to find times that suit their family.
  The data is still derived and kept (`namesByStart`) and is spent BENEATH the calendar,
  against the times actually chosen — `Aroha can do this`, `Aroha and James can do this`. The
  copy above the grid promises it: "After you choose a time, we'll show which of your tutors
  can do it."
- **1–5 preferred times**, the same configured bound `/book` uses, so the two cannot drift.
- **A chosen time reads as the full lesson interval** — `Thu 27 Aug · 4:15–5:15 pm` — in the
  chips, the desktop receipt, the mobile accordion and Review. `bookingIntervalLabel` is the
  one place that wording is decided. The minimum gap is NEVER in the displayed interval.
- **Selected times stay framed as ALTERNATIVES, never several lessons**: one interval per
  line under `Any one of these`, with "These are alternatives — one tutor can accept any one
  of them." A comma-joined list reads as several lessons being requested, which may make a
  family offer fewer times.
- **Mobile reuses step 4's behaviour** — the calendar scrolls horizontally inside the shared
  `JourneyShell` accordion, with the "Scroll sideways" hint. **The sticky action bar is
  gone**: it existed only because the list was unreachably long, and `/book` never needed one.
- **PRIVACY IS UNCHANGED.** Only positive derived slots ever reach the screen, so a gap stays
  indistinguishable between booked, blocked, held, on holiday and outside working hours. What
  is said about a chosen time names the family's OWN included tutors and nothing else — never
  a platform-wide figure, never a competitor, never a reason for a gap.

#### One picker, two journeys

`JourneyTimePicker` (`apps/web/src/components/journey/time-picker.tsx`) holds the
interaction; `components/booking/time-picker.tsx` and `components/ask/ask-time-picker.tsx`
are thin wrappers supplying their own wording — the same relationship `BookingShell` and
`AskShell` already have with `JourneyShell`. The multi-tutor screen drifted into a second,
far worse time picker precisely because it had been written separately.
`/book/times/page.tsx` did not change.

#### Review reads naturally with one tutor

The exclusion journey routinely leaves exactly one tutor being asked — choosing 90 minutes
where only one shortlisted tutor publishes it. Four strings on Review branch on
`tutorCount === 1`, so the screen never describes a group that does not exist: "A time is
only held once **the tutor** accepts it", "Anything you'd like the **tutor** to know?",
"**The tutor** you ask will see this", "**The tutor** can accept one of your times or
decline". Plural wording is unchanged at two or more.

#### Review screenshots

`S:\Studdy\.review\step5\` (gitignored), **sixteen images**, all current against the approved
behaviour: desktop and mobile at each of `1-shortlist`, `2-length`, `3-format`,
`4-times-empty`, `5-times-chosen`, `6-review`, `7-format-fewer-tutors`,
`8-review-with-exclusion`. The `5b-times-viewport` crops are gone; they existed only because
the old list was too tall to photograph whole.

Regenerate against a PRODUCTION server, never `pnpm dev`. The script takes an optional list
of `prefix-name` shots after the output directory — the walk always runs in full and only
the SAVING is filtered, so correcting one screen cannot silently replace shots the owner has
already accepted.

```bash
node apps/web/scripts/step5-review-shots.mjs http://localhost:3200 S:/Studdy/.review/step5
```

**A format-driven exclusion is not reachable with the current seed.** Both Aroha's and
James's Mathematics versions are `formatCode: 'online'`, so `formatChoices` correctly offers
online only; the only `either` version is James's Calculus, which he alone teaches, so it
never reaches a multi-tutor shortlist. The exclusion shots therefore demonstrate the DURATION
path (90 minutes excludes James). Showing a format exclusion would need a new seed fixture,
which has not been added.

#### Two bugs found by tests written alongside

A duration parsed from the URL with `parseInt` turned `12.5` into `12` and `60abc` into `60`
— a duration is a price, so it is matched strictly now. And `availability-discovery` counted
shortlist buttons before the cards had rendered, so the save never happened and it failed
several screens later as "no tutor offers this subject".

### Step 6 — cohesive visual-design pass — **DEFERRED, NOT CANCELLED**

**Deferred by the owner on 2026-08-26 in favour of the launch-critical payment path.** Do
not start it. See the box at the top of §8 and
`docs/design/payments-and-first-paid-booking.md`.

What it is, for when it returns: hierarchy, spacing, card proportions, typography, button
hierarchy, calendar states, selected/hover/focus states, responsive behaviour, useful empty
states — using the existing design system. The owner's standard: the review should feel like
a real product, not a demonstration that the backend works.

**A final consistency pass, not the first time styling happens** (§8.1) — and when it does
return it should cover the payment screens too, which will not exist until the slices in the
payments design document have landed. Each of those slices still reaches a reviewable visual
state before the next begins; §8.1 is unaffected by this deferral.

---

## 8.1 STYLING IS NO LONGER DEFERRED TO STEP 6

**Directed by the owner after the step 2 manual review.** Every UX step must reach a
coherent, reviewable visual state **before** the next step begins. Not final branding and
not pixel-perfect polish at every stage — enough layout and styling that the owner can
judge whether the interaction itself is right.

The reason is concrete. Step 2 was function-complete and fully tested, and still could not
be reviewed: the week calendar was rendering as a vertical stack of full-width bars because
the design system's utility classes were being purged from the CSS bundle (see below). Every
test passed throughout. Deferring the visual state to step 6 meant a whole step was built,
verified and handed over on top of a screen nobody could actually assess — and the next step
would have built parent-facing calendars on that same foundation.

**A trap worth knowing about, because it is silent.** The design system is a workspace
package, so it resolves through a symlink in `node_modules`, and Tailwind's automatic
content detection skips `node_modules`. Any utility class used _only_ inside a design system
component is dropped from the bundle: markup and class names look right, the rules do not
exist. `apps/web/src/app/globals.css` now carries an `@source` line pointing at
`packages/design-system/src`. **Do not remove it**, and if new packages start holding
components, they need the same line.

Colour survived this because application code uses the same tokens; only layout collapsed.
So the failure presents as a design problem, not a build problem. `tutor-availability.spec.ts`
now asserts measured geometry — distinct column lefts, one shared top, absolutely positioned
blocks, bounded height — because text and role assertions cannot see a missing stylesheet.

---

## 9. Standing rules

- **Never merge without explicit approval.** Never enable live services. Never commit
  secrets. Never present example tutors as real. Never put business rules client-side.
- Stop for approval before: merging, starting a new major slice, creating or configuring
  provider accounts, adding production secrets, or running destructive cloud commands.
- **Each UX step reaches a reviewable visual state before the next one starts** (§8.1).
- Run targeted tests while building and the **full suite once** before opening a pull
  request.
- When a test fails, isolate and prove the cause before characterising it. Treat a fixture
  failure as potentially masking real behaviour until shown otherwise.
- Model use: Opus for implementation; Fable for focused security reviews of migrations,
  policies and privacy boundaries before they are finalised; Sonnet for repetitive work
  once an approved pattern exists.

---

## 10. Deferred, non-blocking follow-ups

These are known, deliberate and **not** blockers for the UX steps. Do not spend the slice on
them; do not silently drop them either.

- **The payment window is a real dependency.** Without it every selection eventually lapses
  when the acceptance hold expires — honest, but it means the journey ends in a lapse rather
  than a booking. A proposed rule awaits the owner's review in
  `docs/decisions/payment-window-proposal.md`. No Stripe or ledger work has been done, and
  none is in scope.
- **Rate limiting on the availability surface.** One request derives up to 50 tutors'
  fortnight calendars and cadence is unbounded; a platform sweep is single-digit requests.
  Characterised with a concrete recommendation (20/min per account, 500/day, 60s derivation
  cache) in the checkpoint 2 review.
- **Local e2e re-runs assume a fresh database** (see §3).
- **Cosmetic and audit nits** from the checkpoint 5 review: a loser's family time option
  stays labelled "taken" after the loser closes; the expiry sweep hard-codes the open-ILR
  status list in three places rather than referencing `OPEN_ILR_STATUSES`.
- **CI runs on every pull request and was fully green on the merged commit.** Note the trap
  it caught: `packages/database` has no vitest config of its own, so `pnpm test` sweeps the
  integration suites into the unit run. Every integration file therefore needs the
  `describe.skipIf(!available)` guard AND must keep its `beforeAll`/`afterAll` inside the
  guarded `describe` — module-scope hooks run even when the suite is skipped, so a file that
  guards only the describe still fails in the DB-less CI job. Copy an existing file when
  adding one.

---

## 11. FIRST PROMPT FOR FRESH CLAUDE SESSION

Paste this verbatim into a new Claude Code session:

```text
Work in S:\Studdy (not E:\ExternalStorage\Projects\Studdy — that is a stale exFAT copy).
If S: is missing, run: Start-ScheduledTask -TaskName 'Mount StuddyDev Disk'

Read docs/handoffs/current-session.md first, in full, before anything else.

Then confirm against the actual repo and git state, reading the CURRENT HEAD and the exact
ahead/behind counts out of git rather than from any number written in this prompt — a
document cannot name the commit that contains it:
- which branch you are on, and whether the working tree is clean
- whether local main matches origin/main
- UX steps 1 to 5 ARE ALL merged to main; step 4 was merged as d676f13 (PR #19) and
  step 5 as a738913 (PR #20)
- step 6 is DEFERRED, not next — the launch-critical payment path replaced it
- the next task needs a NEW branch off main

Then confirm step 5 is on main, by checking the code rather than trusting this list:
- apps/web/src/app/shortlist/[subjectSectionId]/ask/ holds length, format, times, review
  and an entry redirect
- apps/web/src/lib/ask/ holds draft.ts, resolve.ts, sections.ts, summary.ts, actions.ts
  and availability.ts
- apps/web/src/components/journey/ holds the shell, summary, accordion AND time-picker,
  all SHARED with /book — the booking and ask components delegate to them
- /ask/times draws WeekCalendar in select mode, one week at a time, deriving availability
  at the chosen SHARED duration and format through bookableSlotsForTutors
- packages/domain/src/bookings/fan-out-eligibility.ts is pure and decides who is included
  and who is excluded with a reason
- createIntendedLessonRequest REFUSES a mixed set of lesson lengths unconditionally, and
  refuses a format the tutor's version cannot deliver
- /requests/new and /shortlist/[id]/times are redirects into the new journey

STEP 5 IS CLOSED. Its UX was reviewed screen by screen and approved; do not reopen it, and
do not "improve" the times calendar. Two things there look arbitrary and are not: a marker
carries only its start time (a per-marker tutor ratio was built and rejected as unreadable),
and compatibility names appear only against times the family has actually chosen.

THE NEXT TASK IS NOT STEP 6. Studdy is working against a launch-critical roadmap aimed at
the first real paid lesson. Read docs/design/payments-and-first-paid-booking.md — it is the
authority.

Payment slices 1 and 2 are MERGED (8fa6051 PR #21, 3eaddf3 PR #22). SLICE 3 IS IMPLEMENTED
BUT NOT MERGED, on the branch feat/payments-schema-and-pricing. You are NOT starting new
implementation.

Confirm from git, not from this prompt: the branch, the current HEAD, that it is ahead of
origin/main and 0 behind, that the working tree is clean, that the branch has NOT been
pushed (no remote ref), and that there is NO pull request. 9cadce3 is the slice 3
implementation commit and stays true; a handoff commit may sit on top of it.

Then read the "Payment slice 3" section in §8. It records the three payment tables, the
deliberate deferral of payments.connected_accounts to slice 4, the money rules, the status
model, migration 0007, the RLS classification and the targeted results.

YOUR FIRST TASK IS THE TWO REVIEW ITEMS RECORDED THERE, AND NOTHING ELSE:

  1. The zero-price / payment boundary. The pure pricing function intentionally supports
     arithmetic at zero. Decide whether payments.payments needs a lesson_amount_minor > 0
     CHECK, or whether existing service-version constraints plus server-side pricing already
     make a zero-price payment structurally impossible. INSPECT BEFORE CHANGING — the honest
     answer may be that no constraint is needed. DO NOT invent free-lesson support.

  2. The missing expiry guard. expireOverdueRequests still needs the guard that a payment in
     `processing` or `succeeded` cannot have its request lapsed. It is ASSIGNED TO SLICE 5,
     feat/stripe-payment-intent — record that assignment, and do NOT implement it now. Slice
     4 (Connect onboarding) must not own it, because onboarding creates no payment rows.

THEN STOP AND WAIT FOR APPROVAL. Do not run the full sequential verification, do not push,
do not open a pull request, do not merge, and do not start slice 4.

Three things are already decided and easy to get wrong: the Tutor Request state machine does
NOT gain a `confirmed` state (a paid booking is ILR fulfilled + reservation
booking_confirmed + payment succeeded, and the sweep is guarded on the ILR's status);
Inngest holds no rules and no scheduled function may contain booking or expiry logic; and
there is exactly ONE production scheduler, so do not add a Vercel cron.

Then, in your own words rather than copying the handoff back to me, summarise:
- why the shortlist is a saving-and-comparison surface rather than a way to book, and how
  a family reaches the single-tutor journey from it
- why the multi-tutor journey asks lesson length FIRST, and what would break if it did not
- what "one request is one lesson" means, where it is enforced, and why the enforcement is
  in the repository rather than only in the screens
- why a shortlisted tutor who cannot take the request is shown rather than dropped, and why
  the reason describes the lesson rather than the tutor
- why a question with one eligible option is still asked, in this journey as in /book
- why the times calendar shows only start times on its markers, and where the tutor
  compatibility information went instead

Do NOT implement anything until I have confirmed your recovered context is correct. Stop
after the summary and wait for me.
```

---
