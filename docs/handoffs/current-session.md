# Studdy — session handoff

**Written 7 August 2026.** Everything here was verified against the code at the time of
writing, not copied forward from an earlier handoff.

This file is written for a **fresh Claude Code session with no memory of the previous
conversation**. It should be enough to continue safely on its own.

---

## 1. Read these first, in this order

1. `claude/studdy-fable-handoff-brief.md` — **authority rank 1.** The build brief: product
   model, implementation rules, approval checkpoints, what needs the owner's sign-off.
2. `docs/decisions/` — decisions approved during implementation. **These override the
   planning pack** where stated. Three files: approved product decisions, the multi-tutor
   state machine, security and privacy decisions.
3. `docs/source-material/README.md` — index of the fourteen planning documents, their
   status, and which decisions override each.
4. `docs/source-material/*.md` — the planning documents themselves, when you need detail.
5. `claude/studdy-planning-pack-digest.md` — a condensed extract of all fourteen. Useful as
   an index; the full sources are authoritative.

**Authority order when two documents disagree:** brief → `docs/decisions/` → planning
documents 01–14 in numbered order.

Note the repository has both `documentation/` (ADRs, build ledger, product rules, from the
bootstrap slice) and `docs/` (source material, decisions, handoffs, added later). Both are
current; they are not duplicates.

---

## 2. Where the work is

**Branch:** `feat/intended-lesson-request`
**Latest commit:** `64c8ad6` — _docs: preserve source material and add a durable session checkpoint_
(code commit `660ce1d` — _feat: intended lesson requests, fan-out, holds, withdrawal and expiry_)
**Open pull request:** [#14](https://github.com/darshabloom/Studdy/pull/14) — **ready for the
owner's review.** Every item of the approved branch scope is complete: the protected expiry
route, the seeded request scenarios, both end-to-end booking journeys, the tutor read-only
request and temporary-hold experience, the Fable security review with its findings applied,
and the full suite run. **Do not merge without explicit approval.**
**Working tree:** clean. Nothing is waiting to be committed.

> **CI has not run on this branch.** There are zero GitHub Actions runs for
> `feat/intended-lesson-request` — not a broken workflow (`CI` is active and ran
> successfully on PR3's branch), most likely exhausted Actions minutes or a repository
> restriction. **Check the Actions tab and billing before relying on CI.** All verification
> reported for this branch was run locally against a real database. The one thing local
> runs do not fully substitute for is proving migrations apply from an empty database on a
> fresh CI Supabase instance.

**Merged so far:** PR1 bootstrap (`91931e5`), PR2 identity (`d3116ed`), PR3 family/students/discovery (`51c0135`).

**Repository location: `S:\Studdy`.** Not `E:\ExternalStorage\Projects\Studdy` — that path
is on an exFAT volume which cannot store symlinks, so pnpm workspaces cannot install there.
A stale copy still exists at the E: path; **ignore it**. `S:` is an NTFS virtual disk
mounted at logon by the scheduled task "Mount StuddyDev Disk". If `S:` is missing after a
reboot, run elevated: `diskpart /s E:\ExternalStorage\StuddyDev-mount.txt`.

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

**Expected state after a clean run:** 24 tables classified by `check:rls`; 143 unit tests
(4 configuration, 30 design-system, 67 domain, 42 database); 42 integration tests + 1
skipped; 50 e2e.

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

## 6. What `feat/intended-lesson-request` delivered

> ### PARTLY SUPERSEDED — read before building on this branch
>
> On 7 August 2026, after manually reviewing the parent and tutor journeys, the owner
> approved a redesign: **[docs/design/multi-time-availability-redesign.md](../design/multi-time-availability-redesign.md)**.
>
> **Superseded by that design — do not extend:**
>
> - The **single-time composer.** A family no longer proposes one universal lesson time.
>   Requests carry 2–5 acceptable times, and each tutor is offered only the subset they can
>   actually do. `intended_lesson_requests.proposed_start_at/proposed_end_at` move out to a
>   new `bookings.request_time_options` table.
> - **Hold-at-send.** Sending a Tutor Request will create **no** calendar reservation. One
>   reservation is created when a tutor accepts one offered time, revalidated atomically at
>   that moment.
> - **PD-010 as written.** Fan-out stays atomic, but its precondition becomes "every invited
>   tutor has at least one currently offerable time" rather than "every tutor's hold
>   succeeded".
>
> **Remains authoritative — the redesign builds directly on it:**
>
> - `availability.tutor_time_reservations` and its **GiST exclusion constraint**. Kept
>   exactly as built; the redesign leans on it harder than this branch does.
> - All **seven Tutor Request statuses**, including every family-side and system-side ending
>   collapsing into `closed` with the real reason in the server-only `close_reason_code`.
> - The whole **privacy architecture**: SP-005 (server-only tables, no browser grants),
>   SP-006 (the four-layer tutor boundary), SP-008 (server-side pricing), SP-009 (random,
>   non-correlatable `TREQ-` references), SP-010 (the protected expiry route).
> - **Transaction discipline**: status-guarded updates, audit event, status transition,
>   domain event and outbox entry written in one transaction.
> - `expireOverdueRequests` — idempotent, batched, scheduler-independent. Extended, not
>   rewritten.
> - Versioned rule settings with **snapshotted deadlines** (PD-012), the shortlist surviving
>   request creation (PD-009), and the `LR-`/`TREQ-` prefixes (PD-018).
>
> **The next slice branches cleanly from `main` after this merges** — it is not stacked on
> this branch.

**Approved scope:** ILR creation, fan-out to up to three tutors, temporary holds,
withdrawal and expiry. **Explicitly excluded:** tutor accept/decline, selection close-out,
Booking creation, Stripe, ledger.

**Database — four tables, all server-only:**
`bookings.intended_lesson_requests` (`LR-`), `bookings.tutor_requests` (`TREQ-`),
`availability.tutor_time_reservations`, `platform.rule_settings`.

Guarantees enforced by the database rather than application logic:

- GiST exclusion constraint — overlapping **active** holds for one tutor are
  unrepresentable (`reviewed-sql/constraints/0005`).
- Partial unique indexes — fan-out cap of three, and one live request per tutor per ILR.
- No `anon`/`authenticated` grants, no schema usage, RLS enabled with no policies
  (`reviewed-sql/rls/0004`).
- `bookings.generate_tutor_request_reference()` (`reviewed-sql/functions/0006`) mirrors the
  TypeScript generator in `packages/database/src/schema/bookings/reference.ts`.

**Routes added:** `/requests`, `/requests/new`, `/requests/[reference]`, `/tutor/requests`,
`/api/jobs/expire-requests`. Entry point added to `/shortlist/[subjectSectionId]`.

**Expiry has no scheduler attached.** The Vercel Cron entry was removed — the Hobby plan
allows a once-daily schedule only, which is too coarse for hour-based deadlines, and the
frequency was deliberately not reduced to fit. Inngest is the required production
mechanism. See `documentation/operations/scheduled-jobs.md`.

**Commands:** `createIntendedLessonRequest` (all-or-nothing fan-out; ILR, tutor requests,
holds, audit, transitions, domain event and outbox entries in one transaction),
`withdrawRequest`, `expireOverdueRequests` (idempotent, batched, scheduler-independent).

**Tests passing:** 67 domain unit (30 in bookings), 42 integration, 50 e2e. Integration
proves fan-out atomicity, the concurrent race for one slot, terminal states surviving a
later expiry sweep, expiry idempotency, per-tutor pricing, and the privacy assertions.

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

**The slice plan changed on 7 August 2026.** The owner replaced the very small slices with
one fuller vertical slice, because the small ones were technically safe but left each role
with little usable functionality. `feat/tutor-request-response` and
`feat/multi-tutor-selection` no longer exist as separate branches — both are folded in below.

1. **Owner's manual review of PR #14, then the owner merges it.** Do not merge without
   explicit approval. §6 records what it supersedes and what stays authoritative.
2. **`feat/availability-and-multi-time-requests`** — branched **cleanly from `main`** after
   PR #14 merges, never stacked on it. One vertical slice: tutor availability management →
   family sees real availability → multi-time request → per-tutor offered subsets → tutor
   accept/decline → hold at acceptance → family response view → tutor selection →
   close-out. Build against
   [docs/design/multi-time-availability-redesign.md](../design/multi-time-availability-redesign.md),
   which carries the approved decisions D-1 to D-8, the five ordered checkpoints, and the
   tutor-workspace acceptance criterion. **Do not start without the owner's go-ahead.**
3. **`feat/stripe-booking-confirmation`** — still separately gated. Requires the owner's
   approval before any provider account is created or configured.

Fable security reviews are expected before the migrations for checkpoints 2, 3 and 4 are
finalised: the widened family availability surface, the per-tutor option subset, the
acceptance transaction, and the selection close-out.

**Both questions that used to block this work are now answered.** PD-012 has approved
provisional launch values (design §2, D-8), and the multi-tutor disclosure question is
settled: tutors may be told generally that Studdy allows families to contact several tutors,
but no individual Tutor Request may reveal whether others were contacted, their number,
identity, responses, or why it closed.

---

## 9. Standing rules

- **Never merge without explicit approval.** Never enable live services. Never commit
  secrets. Never present example tutors as real. Never put business rules client-side.
- Stop for approval before: merging, starting a new major slice, creating or configuring
  provider accounts, adding production secrets, or running destructive cloud commands.
- Run targeted tests while building and the **full suite once** before opening a pull
  request.
- When a test fails, isolate and prove the cause before characterising it. Treat a fixture
  failure as potentially masking real behaviour until shown otherwise.
- Model use: Opus for implementation; Fable for focused security reviews of migrations,
  policies and privacy boundaries before they are finalised; Sonnet for repetitive work
  once an approved pattern exists.

---

## 10. The prompt to start a fresh session

Paste this verbatim. It is recorded here so it survives the loss of the conversation that
produced this checkpoint.

```
Continue the Studdy build. Read docs/handoffs/current-session.md first, then
claude/studdy-fable-handoff-brief.md and docs/decisions/. Work in S:\Studdy.

Current state: branch feat/intended-lesson-request, commit 64c8ad6.
PR #14 is ready for my review. Do not merge without my explicit approval.

Confirm you have read the handoff and tell me: the approved seven Tutor Request
statuses, what is in and out of scope for this branch, and the next task in order.
Do not start implementation until I approve.
```

If the branch has moved on since this file was written, correct the commit and the
pull-request line before using it — and use **"PR #N is open and in progress"** instead of
"ready for my review" whenever any part of that branch's approved scope is still unfinished.
