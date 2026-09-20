<!--
  THE CURRENT HANDOFF. Written 20 September 2026, after the notification slices
  (PR #33 and PR #35) merged.

  This file replaces a 130KB handoff written during the UX-redesign slice. That
  version described payment slice 7 as NOT STARTED, which stopped being true
  when PR #33 merged, and a handoff that is wrong is worse than one that is
  short. The previous text remains in git history at f913b1d~1 if the
  payment-slice detail is ever needed.
-->

# Studdy — session handoff (20 September 2026)

Written for a fresh Claude Code chat with no memory of the previous conversation. Everything
here was verified against the code and git state at the time of writing, not copied forward.

---

## 1. Where things are right now

| Fact              | Value                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo / worktree   | **`S:\Studdy`** — an NTFS VHDX. `E:\ExternalStorage\Projects\Studdy` is exFAT, cannot hold a JS monorepo, and is a **stale copy** — do not work there                                     |
| Mount             | If `S:\` is missing, run the scheduled task **"Mount StuddyDev Disk"** (`diskpart` attach of `E:\ExternalStorage\StuddyDev.vhdx`). `Start-ScheduledTask -TaskName 'Mount StuddyDev Disk'` |
| `main`            | **`f913b1d`** — "Tutor request notifications (the request lifecycle) (#35)"                                                                                                               |
| Current branch    | `feat/tutor-request-notifications` (merged; content identical to `main`)                                                                                                                  |
| PR #33            | **MERGED** `af821c0` — Resend outbox notifications (payment slice 7)                                                                                                                      |
| PR #35            | **MERGED** `f913b1d` — tutor request notifications                                                                                                                                        |
| Production deploy | `f913b1d` deployed **successfully** to Vercel Production                                                                                                                                  |
| Deadline          | **One month from 20 September 2026. Firm.**                                                                                                                                               |

Merging to `main` **auto-deploys to Vercel Production** (26 Production deployments exist).
That environment sits behind Vercel Deployment Protection — `/api/inngest` returns 302 to
`vercel.com/sso-api`, so Inngest cannot currently reach the app to register or invoke it.

---

## 2. Scope rules — read before proposing anything

- **One-month deadline is firm.**
- **MVP scope is frozen.**
- **Do not start** Resources, chat/messaging, organisations, advanced analytics, or any other
  post-launch feature.
- **Do not redesign** already-locked Parent screens.
- **Say so immediately if context or repository state is uncertain — do not guess.** Three CI
  cycles were burned in the previous session by inferring causes from log tails instead of
  reading failing test names.

---

## 3. Architecture discoveries from the full repo audit

These cost real effort to establish. Do not re-derive them.

**There is no `bookings` table.** A "confirmed booking" is the `intended_lesson_requests` row
at `fulfilled` plus the `tutor_time_reservations` row carried forward to `booking_confirmed`.
This single schema decision is what blocks lessons, homework, progress, reschedule, cancel and
recurring bookings — they have no entity to attach to.

**Eleven of nineteen schema modules are two-line placeholders**: `lessons`, `learning`,
`resources`, `communications` (until PR #33), `support`, `organisations`, `integration`,
`migration` and others.

**The documented capability engine does not exist.** `packages/permissions/src/capabilities.ts`
has `RECORD_SCOPES`, a `PermissionDecision` interface and a `deny()` helper — no `allow()`, no
evaluator, no catalogue. Real access control is role→workspace mapping + middleware +
server-side ownership filters + RLS. Those filters are correct, but every feature re-implements
scoping by hand.

**Tutors cannot join the platform.** No code path inserts `tutor_profiles` outside seeds.
`/welcome` records "interest" as a `pending` role; there is no application form, no approval UI.

**Discovery and availability both require a published service.** `public.public_tutor_search`
and the bookable-slot projection both inner-join `service_versions` at `current`. A tutor with
availability but no published service is invisible and unbookable, with no feedback. Services
have no tutor UI at all (seed-only).

**Payments require a Stripe Connect account.** `createPaymentForRequest` refuses with
`tutor_not_payable` unless `connected_accounts` has active transfers+payouts. **No seed creates
one**, so in a fresh environment no tutor can be paid.

**`identity.contact_points` is defined, migrated and entirely unused.** `tutor_verifications`
is seed-only. `tutor_transfers` is written but never read — tutors can never be paid out.

**`migrate.ts` is a phased reviewed-SQL runner** (`pre` → generated → `rls`/`functions`/
`triggers`/`constraints`/`transformations`), each file tracked in
`drizzle.reviewed_sql_migrations`. RLS policies and the public view genuinely do get applied.

**`/demo` on `feat/portfolio-demo` is entirely static fixtures** — invented people, no database,
no actions. It contains built UI for tutor lessons/earnings/resources/students that is easy to
mistake for product. It also mutates three shared design-system files.

---

## 4. What is genuinely implemented today

**Working end to end:** public site and tutor discovery; sign up / sign in / verify / password
reset (e2e via Mailpit); MFA enrol + challenge; workspace routing and chooser; add student and
subject need; shortlist (cap 3, DB-enforced); both booking journeys (`/book` single-tutor and
`/shortlist/[id]/ask` multi-tutor); the multi-tutor request state machine with fan-out, holds,
withdrawal and expiry; tutor availability (recurring rules, exceptions, minimum gap, family
preview); tutor request accept/decline; family selection; Stripe payment via Payment Element;
webhook-authoritative fulfilment (four records, one transaction); Stripe Connect onboarding;
commission arithmetic; Inngest scheduling (expiry, reconcile, drain).

**Notifications — as of PR #33 + #35**, eight deliverable outbox event types:

| Event                             | Recipient                           | Purpose                                 |
| --------------------------------- | ----------------------------------- | --------------------------------------- |
| `payment.required`                | family                              | pay within the 60-minute window         |
| `booking.confirmed`               | family + tutor                      | the lesson is real                      |
| `payment.refund_required`         | ops                                 | money held, booking not confirmed       |
| `tutor_request.sent`              | tutor                               | you have been asked — accept or decline |
| `tutor_request.accepted`          | family                              | a tutor can do one of your times        |
| `tutor_request.closed`            | tutor, **only where time was held** | your held time is released              |
| `intended_lesson_request.expired` | family                              | everyone declined, or time ran out      |
| `tutor_request.declined`          | **nobody**                          | deliberately not delivered              |

Delivery machinery: one row per recipient in `communications.notification_deliveries`,
deterministic idempotency keys used both as a unique column and as Resend's key, attempts
capped at 8 with exponential backoff, exhaustion reported and queryable via
`exhaustedDeliveries()`, non-production safety valve, Inngest drain every minute plus a manual
`POST /api/jobs/drain-outbox` guarded by `CRON_SECRET`.

---

## 5. Designed but NOT implemented

Lessons, homework, progress tracking, resources, messaging/chat, recurring bookings,
reschedule/cancel, refund execution, tutor payout settlement, tutor earnings view, tutor
service/pricing UI, tutor self-onboarding and approval, dependent-student login, all admin
tooling (`/manager`, `/owner`, `/organisation` are `EmptyState` pages), rule configuration UI
(`setRuleSetting` has seed-only callers), audit/history viewing (written everywhere, read
nowhere), notification pruning.

`/demo` contains a **built visual specification** for tutor lessons, earnings, resources and
the student record — so those are "planned/designed", not "not started". Build against it.

---

## 6. Critical bugs already identified — Week 1 work

### Task 1 — workspace fail-open access bug

`apps/web/src/components/workspace/chrome.tsx:98`

```
{hasAccess || !identity.databaseAvailable ? (children) : <RestrictedState/>}
```

`apps/web/src/lib/identity/resolve.ts:91-93` — a bare `catch { return unavailable; }` sets
`databaseAvailable: false` on **any** exception, including a transient connection error.

The MFA gate at `chrome.tsx:46` is `if (hasAccess && requireMfa)`, so when access is skipped
the MFA check is skipped too.

**Effect:** one database blip renders `/manager` and `/owner` to any signed-in user, without
MFA. Harmless today because those pages are empty; critical the moment admin modules land.
**Fix:** deny on `!databaseAvailable`, and move the MFA check outside the `hasAccess` branch.

### Task 2 — dependent-student role/conversion bug

The seed creates `student.dependent@local.studdy.test` with an active `dependent_student` role
and `workspaceEnabled: true`, but `clean-registration.ts` creates **zero** `student_profiles`
(verified: `grep -c studentProfiles` → 0).

That account signs in, reaches `/student`, sees "Set up your learning profile", and the only
available action calls `setUpOwnProfileAction` →
`packages/database/src/repositories/students.ts:172` writes
`independenceStatusCode: 'independent'` and `loginAccessStateCode: 'independent_access_active'`.

**Effect:** a dependent student is silently converted to an independent one, bypassing the 18+
declaration that gates that role everywhere else. No application code path ever assigns
`dependent_student` or sets `dependent_login_active`.

### Task 3 — `/requests` unreachable, and stale tutor messaging

`grep -rn 'href="/requests"' apps/web/src --include=*.tsx` → **zero matches**. The list page
renders and is revalidated by four actions, but nothing links to it. `parent/layout.tsx` and
`student/layout.tsx` pass no `navLinks`; every sidebar item renders with a "soon" chip.

`apps/web/src/app/tutor/page.tsx:198` — an Alert titled **"Responding to requests opens in the
next release"** saying "Nothing here affects a request yet." Responding shipped in PR #17 and
is e2e-tested. Two more stale promises: `welcome/page.tsx:49` and
`(public)/for-tutors/page.tsx:22` both say "we'll email you", which is now nearly true but was
not when written.

Also in that file: the header comment of `lesson-requests.spec.ts` still claims "selection and
payment are deliberately absent".

### Task 4 — then Stripe / refund / payout work

Refund execution does not exist: `flagForRefund` sets `refund_required_at` and writes a
high-risk audit row, and nothing reads it. `tutor_transfers` obligations are written and never
settled — no Stripe Transfer, no payout, no tutor earnings view. `RefundProvider` in
`packages/domain/src/core/providers.ts` is an unimplemented interface.

---

## 7. Decisions made — do not relitigate

**PD-021 — historical notification backlog.** Supersede, never send. No permanent date cutoff
in the drain (it would make `pending` mean "owed, or abandoned, and you cannot tell which").
`pnpm db:notifications:supersede`, report by default, refuses while any payment is flagged
`refund_required` or any confirmed booking is still in the future, never touches refund alerts.

**PD-022 — Resend approved** as the transactional email provider, closing the open
email-provider question. Decisive reason: the architecture depends on a **send-time idempotency
key**, which Resend honours for 24 hours and Postmark/SES do not offer. Counter-argument
recorded: `payment.required` opens a 60-minute window, so inbox placement is load-bearing on
revenue, and Postmark's transactional-only IP pool is better on that axis. Reassess if a family
reports a missing email Resend shows as delivered, if sending exceeds 100/day on the free plan,
or if marketing email is added.

**SP-011 — notification delivery records.** Plaintext `to_address` accepted (same address
`auth_identity_links` already holds; must be readable to send). **90-day retention, then
DELETE** — the event survives in `audit_events`/`status_transitions`/`domain_events`, which
carry no address. **Pruning must only remove deliveries whose outbox entry is terminal**
(`sent` or `superseded`) — omitting that is a duplicate-email bug. Deadline: before any row can
exceed 90 days, and no later than 90 days after the first production send. **Not a launch
blocker** unless that date falls before launch.

**SP-006 covers the tutor-privacy boundary** and already extends to notifications (its fourth
enforcement layer is about them). **No new SP entry was created for PR #35** — deliberately, to
avoid ceremony. The hardening in `f913b1d` moved enforcement from layer 3 (templates decline to
render the family reference) to layer 2 (the projection never resolves it).

**Matrix decisions:** no per-decline email; no tutor acceptance confirmation (cut for launch);
closure emails only where the tutor had time held.

---

## 8. THE ONE THING THAT MUST NOT BE FORGOTTEN

**Do not set `RESEND_API_KEY` in any persistent environment until the historical backlog has
been reviewed and superseded.**

The outbox has carried `tutor_request.*` and `intended_lesson_request.expired` since payment
slice 1, and PR #35 made them deliverable. `resolveContext` refuses only entries whose records
have GONE, and nothing in this schema is ever hard-deleted — so **every historical entry
resolves cleanly and would be sent**. The first drain would tell tutors about requests that
closed weeks ago and families about requests long dead.

Merging was safe **only because** `RESEND_API_KEY` is confirmed unset in Vercel Production —
without it the drain falls back to the in-memory provider and nothing leaves the host.

Required order, per environment with history:

1. `DATABASE_URL="<env>" pnpm db:notifications:supersede --types=tutor_request.sent,tutor_request.accepted,tutor_request.closed,intended_lesson_request.expired`
   (report mode, no flags)
2. Read the counts and date range. **Check nothing in it is a request still at
   `awaiting_responses`** — superseding a live `tutor_request.sent` means that tutor is never
   told. The script's gates do NOT cover this; it is a person's check.
3. Apply with an explicit `--before`.
4. Only then set `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` (verified domain), `STUDDY_OPS_EMAIL`
   (required in production or the drain throws), and `EMAIL_DEV_REDIRECT_TO` on non-production.

Recorded in `documentation/implementation/build-ledger.md` under "Outstanding commitments",
alongside the notification-pruning commitment.

---

## 9. Selection does not notify the tutor — APPROVED, not a gap

**Decided by the owner, 20 September 2026.**

For launch, Studdy will **not** send a tutor notification merely because a family selected
them. Selection is not a confirmed booking. The chosen tutor instead receives either:

- **`booking.confirmed`** once payment succeeds, or
- the **generic closed / request-released notification** (`tutor_request.closed`) if the
  booking does not complete.

**This is intentional. It is not a missing notification, and it must not be "fixed".**

The reasoning matches the payment design's central insistence that _confirmed is not booked_:
telling a tutor they have been chosen, while the money has not landed and the request can
still lapse, creates exactly the false certainty the rest of the system is built to avoid. The
tutor holds their time either way, and receives a definitive answer within the payment window
— at most sixty minutes.

Mechanically there is no `tutor_request.selected` event in the outbox at all, so nothing needs
removing; the absence is the implementation of this decision.

If a future slice proposes adding one, treat it as reopening an approved product decision
rather than closing a gap.

---

## 10. Environment traps (these have cost real time)

- **`jq` is not installed.** `gh` is. Use `gh --jq`/`--template`; a pipe to standalone `jq`
  fails silently and a monitor reads as "still pending". Cost: a 20-minute silent monitor.
- **A JS `Date` in hand-written SQL throws inside postgres-js** — "Received an instance of
  Date". Pass `${value.toISOString()}::timestamptz`. Drizzle's typed query builder marshals
  `Date` correctly; hand-written SQL does not. Typecheck and lint never catch it. Cost: two CI
  cycles, in two different files.
- **Docker Desktop is usually not running**, so `pnpm supabase:start` fails and integration
  tests cannot run locally. CI is then the only feedback loop (~7 minutes per cycle). Ask the
  owner to start Docker before diagnosing database behaviour.
- **Stale `.next` artefacts** after switching branches produce dozens of phantom "Cannot find
  module" typecheck errors. `rm -rf apps/web/.next`.
- **When CI fails, read the failing test NAMES first** (`gh run view <id> --log-failed`, grep
  for `FAIL `), not the assertion tails. Logs only release once the whole run completes.

---

## 11. Verification commands

```
pnpm typecheck && pnpm lint && pnpm format && pnpm test && pnpm check:rls && pnpm build
```

Integration and e2e need Docker + `pnpm supabase:start`, `pnpm db:migrate`, `pnpm db:seed`.
CI runs four jobs: checks, database (migrations+seeds+integration), Playwright e2e, gitleaks.
Local test accounts are in `documentation/implementation/development-test-accounts.md`
(shared password `Studdy-local-only-1`).

---

## 12. Read these, in this order

1. `claude/studdy-fable-handoff-brief.md` — authority rank 1
2. `docs/decisions/` — approved product decisions, multi-tutor state machine, security and
   privacy decisions. **These override the planning pack.**
3. `docs/design/payments-and-first-paid-booking.md`
4. `documentation/implementation/build-ledger.md` — note the capability table is stamped
   7 August 2026 and predates the payment and notification slices; the "Outstanding
   commitments" section is current
5. `docs/source-material/` — the fourteen planning documents
