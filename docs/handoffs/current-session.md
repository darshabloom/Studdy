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
**Latest commit:** `660ce1d` — _feat: intended lesson requests, fan-out, holds, withdrawal and expiry_
**Open pull request:** [#14](https://github.com/darshabloom/Studdy/pull/14) — awaiting the owner's review. **Do not merge without explicit approval.**
**Working tree:** clean at the time of writing, apart from the documentation added by this
checkpoint. Nothing is waiting to be committed before context reduction other than these
docs.

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

1. **Await the owner's review of PR #14.** Do not merge without explicit approval.
2. **`feat/tutor-request-response`** — tutor accept and decline. Must reuse
   `findRequestForTutor(reference, tutorProfileId-from-session)` and return identical
   responses for "not yours" and "does not exist". Adds the `accepted` and `declined`
   transitions and the acceptance hold semantics.
3. **`feat/multi-tutor-selection`** — the selection close-out. The highest-risk work in the
   project. Read the guard rails in `docs/decisions/multi-tutor-state-machine.md` before
   starting: losers must reach a status inside the tutor-visible set that maps to the
   neutral label, the same `tutor_request.closed` event type must be used, and all losers
   must close in one transaction so timing cannot differentiate. A Fable review of the
   close-out transaction is expected before its migration is finalised.
4. **`feat/stripe-booking-confirmation`** — gated. Requires the owner's approval before any
   provider account is created or configured.

Before starting 2 or 3, confirm with the owner: the provisional deadline and hold numbers
(PD-012), and whether a tutor may be told the platform allows multi-tutor requests.

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
