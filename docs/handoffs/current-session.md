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

**Branch:** `feat/availability-and-multi-time-requests`
**HEAD:** `e37933b551788dc7e47db5c600d9b8e7524007ab` (`e37933b`) — _fix: make the week calendar a real week grid (step 2 visual pass)_
**Open pull request:** [#17](https://github.com/darshabloom/Studdy/pull/17) — **DRAFT, open, unmerged.**
**Working tree:** clean. Nothing uncommitted, nothing stashed.

> **Do not merge PR #17 without the owner's explicit approval.** It is deliberately a draft.
> The backend is complete and reviewed; the UX redesign below is what makes the slice
> acceptable, and it is only one step in.

### Commits on this branch, oldest first

| Commit    | What                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `bf3ff05` | checkpoint 1 — availability schema, slot calculation, `/tutor/availability` |
| `5a9e8ad` | checkpoint 2 — discovery availability signals, combined time grid           |
| `3c1f465` | checkpoint 3 — multi-time requests, per-tutor option subsets                |
| `e8371af` | checkpoint 4 — tutor accept and decline, hold at acceptance                 |
| `9d1ea53` | checkpoint 5 — family selection close-out, `awaiting_payment`               |
| `905cf9e` | close-out audit fidelity, family-visible lapse reasons                      |
| `10bc283` | UX redesign step 1 — shared `WeekCalendar` primitive                        |
| `bb2ecaf` | fresh-session checkpoint and handoff rewrite                                |
| `793937a` | **UX redesign step 2 — calendar-first `/tutor/availability`**               |
| `e37933b` | **step 2 visual pass — a real week grid, and the CSS purge that hid it**    |

Branched from `b4464a8` (PR #14, intended lesson requests). Merged before that: PR1 bootstrap
(`91931e5`), PR2 identity (`d3116ed`), PR3 family/students/discovery (`51c0135`).

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

**Expected state after a clean run:** 28 tables classified by `check:rls`; **292 unit and
integration tests passing with 1 skipped** (4 configuration, 50 design-system, 117 domain,
26 web, 95 database including its integration suite); **72 end-to-end**. `typecheck`,
`lint`, `format`, `check:rls` and `check:boundaries` all green.

**Re-seed before every end-to-end run.** The e2e suite is not idempotent against a used
database — it creates students and leaves holds — so a second run without a reset fails in
ways that look like code defects. Run `pnpm db:reset && pnpm db:migrate && pnpm db:seed`
first. CI is unaffected because it seeds a fresh instance.

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

**The owner reviewed the working slice and directed a user-journey and interaction redesign
before PR #17 may merge.** Where this handoff, `docs/design/multi-time-availability-redesign.md`
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

Step 1 is done. **Steps 2–6 remain, in this order.** Rewrite or update the end-to-end
journey alongside each step rather than leaving all test changes to the end; use targeted
tests while building and the full suite at major boundaries and before PR readiness.

### Step 2 — calendar-first `/tutor/availability` — **DONE** (`793937a`, `e37933b`)

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

### Step 3 — discovery mini calendars and the large tutor-profile calendar (NEXT)

Tutor cards get a compact real week view (`density="mini"`, `familySafe`) showing actual
derived bookable time. The profile gets the same concept at full size with time labels and
selectable availability. Replace the pill lists. Touches
`apps/web/src/components/discovery/tutor-card.tsx`, `tutor-slots.tsx`,
`apps/web/src/app/(discovery)/tutors/page.tsx` and `.../tutors/[reference]/page.tsx`.

### Step 4 — the `/book` journey

Child → Subject → Tutor → Lesson length → Online/In person → Availability → Review → Send
request. Entering from a tutor card or profile prefills the tutor and any known child and
subject context so those steps are skipped. Lesson length is chosen from that tutor's
published service versions. The subject section is find-or-created **at send**. This is where
the **1–5 time options** change lands: `PROVISIONAL_REQUEST_RULES.minTimeOptions`, the seeded
`requests.min_time_options` value, and the copy in `validateChosenTimes`.

### Step 5 — demote the shortlist

`/shortlist/[id]` keeps saving and comparing. `/shortlist/[id]/times` becomes the optional
"Ask shortlisted tutors" multi-tutor journey, reached only from the shortlist.

### Step 6 — cohesive visual-design pass

Hierarchy, spacing, card proportions, typography, button hierarchy, calendar states,
selected/hover/focus states, responsive behaviour, useful empty states — using the existing
design system. The owner's standard: the next manual review should feel like a real product,
not a demonstration that the backend works.

**Now a final consistency pass, not the first time styling happens.** See §8.1.

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
- **CI has not run on this branch.** All verification reported here was run locally against a
  real database. Check the Actions tab before relying on CI.

---

## 11. FIRST PROMPT FOR FRESH CLAUDE SESSION

Paste this verbatim into a new Claude Code session:

```text
Work in S:\Studdy (not E:\ExternalStorage\Projects\Studdy — that is a stale exFAT copy).
If S: is missing, run: Start-ScheduledTask -TaskName 'Mount StuddyDev Disk'

Read docs/handoffs/current-session.md first, in full, before anything else.

Then confirm against the actual repo and git state:
- the branch is feat/availability-and-multi-time-requests
- HEAD is 10bc2839ada0963d4e0b34ec1a71b6735111569d (10bc283)
- the working tree is clean
- PR #17 exists, is a draft, and is unmerged
- step 1 is present: packages/design-system/src/components/calendar/ contains geometry.ts,
  geometry.test.ts and week-calendar.tsx, and WeekCalendar is exported from
  @studdy/design-system

Then, in your own words and without copying the handoff's phrasing back to me, summarise:
- the approved UX redesign and why it supersedes the older shortlist-first presentation
- what WeekCalendar is, its geometry model, its three modes, what density="mini" and
  fittedWindow do, and what familySafe/assertFamilySafe protects
- why "Preview as family" must be fed derived bookable slots rather than raw tutor rules

Then identify the next task and state what it involves, including any backend addition it
needs.

Do NOT begin implementation. Stop after that summary and wait for me to confirm your
recovered context is correct.
```

---
