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

**Branch:** `feat/parent-booking-journey`.
**HEAD:** `99cb74a373702a97ebf22080a5052b904d39a557` (`99cb74a`) —
_docs: record the swallowed-click failure mode and its helper_
**Working tree:** clean. Nothing uncommitted, nothing stashed.

> ### Checkpoint state, verified against git
>
> | Fact         | Value                                                       |
> | ------------ | ----------------------------------------------------------- |
> | Branch       | `feat/parent-booking-journey`                               |
> | HEAD         | `99cb74a373702a97ebf22080a5052b904d39a557`                  |
> | Base         | `origin/main` at `49df4cffa147f00fbe5076915385676972138eea` |
> | Divergence   | **14 ahead, 0 behind** `origin/main`                        |
> | Working tree | clean                                                       |
> | Pushed       | **NO** — the branch exists only locally                     |
> | Pull request | **NONE** open for it                                        |
> | Merged       | **NO**                                                      |
>
> **Step 4 is implemented, fully tested, and AWAITING THE OWNER'S MANUAL UX APPROVAL.**
> Steps 1, 2 and 3 are merged to `main` (PRs #17 and #18). **Step 5 has not started.**
>
> Do not push, open a pull request, merge, or begin step 5 until the owner confirms.
>
> `main` itself carries steps 1–3 only. Do not reuse the merged branches
> `feat/discovery-and-profile-availability-calendars` or
> `feat/availability-and-multi-time-requests`.

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

**Expected state after a clean run, at `99cb74a`:** 28 tables classified by `check:rls`;
**361 unit and integration tests passing with 1 skipped** (4 configuration, 50
design-system, 131 domain, 60 web, 116 database including its integration suite);
**95 end-to-end**. `typecheck`, `lint`, `format`, `check:rls`, `check:boundaries` and
`build` all green.

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

Steps 1 to 3 are merged. Step 4 is implemented on its own branch and awaiting the owner's manual UX approval. **Steps 5 and 6 remain.** Rewrite or update the end-to-end
journey alongside each step rather than leaving all test changes to the end; use targeted
tests while building and the full suite at major boundaries and before PR readiness.

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

### Step 4 — the parent `/book` journey — **IMPLEMENTED, AWAITING MANUAL UX APPROVAL**

On `feat/parent-booking-journey`, 14 commits off `main` at `49df4cf`. Complete, fully
tested, **not pushed, no pull request, not merged.** The owner has approved every decision
below; what remains is their manual review of the progressive-summary and mobile-accordion
screens, which changed after the last screenshots they saw.

**Do not push, open a PR, merge or start step 5 until the owner confirms.**

#### The journey

Child → Subject → Tutor → Lesson length → Online/in person _(only where it is a real
question)_ → Times → Review → **Send request**.

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

#### Verified gate state at `99cb74a`

| Gate                                       | Result                       |
| ------------------------------------------ | ---------------------------- |
| `pnpm typecheck`                           | green                        |
| `pnpm exec turbo run lint --concurrency=2` | green                        |
| `pnpm format`                              | green                        |
| `pnpm check:rls`                           | green — 28 tables classified |
| `pnpm check:boundaries`                    | green                        |
| `pnpm build`                               | green                        |
| Unit + integration                         | **361 passing, 1 skipped**   |
| End-to-end                                 | **95 passing**               |

All after `pnpm db:reset && pnpm db:migrate && pnpm db:seed`.

#### Review screenshots

`S:\Studdy\.review\step4\` (gitignored). Eighteen images: `desktop-0-discovery-entry`
through `desktop-8-tutor-minimum-gap`, and `mobile-0` through `mobile-7`.

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

Then confirm against the actual repo and git state:
- the branch is feat/parent-booking-journey
- HEAD is 99cb74a373702a97ebf22080a5052b904d39a557 (99cb74a)
- the branch is 14 commits ahead of origin/main and 0 behind
- origin/main is 49df4cffa147f00fbe5076915385676972138eea
- the working tree is clean
- the branch has NOT been pushed, there is NO pull request, and nothing is merged
- UX steps 1, 2 and 3 are merged to main; step 5 has not started

Then confirm step 4 is implemented, by checking the code rather than trusting this list:
- apps/web/src/app/book/ holds the entry redirect and one route per step
- apps/web/src/lib/booking/ holds draft.ts, resolve.ts, availability.ts, summary.ts, actions.ts
- apps/web/src/components/booking/ holds booking-shell.tsx, booking-summary.tsx,
  choice-list.tsx, time-picker.tsx, review-form.tsx
- tutors.tutor_profiles has minimum_gap_minutes, and tutor_time_reservations has
  gap_minutes and effective_end_at
- packages/database/migrations/reviewed-sql/constraints/0006_reservation_gap_exclusion.sql
  exists and excludes on the effective interval

Then verify the gates yourself, after pnpm db:reset && pnpm db:migrate && pnpm db:seed.
Expect 361 unit and integration tests passing with 1 skipped, and 95 end-to-end passing,
with typecheck, lint, format, check:rls (28 tables), check:boundaries and build all green.

Then, in your own words rather than copying the handoff back to me, summarise:
- the parent /book journey, why the shortlist stays optional, and why the subject section
  is created only as part of a successful send
- the progressive summary: what desktop shows, what mobile shows, why there is no separate
  client-side booking draft, and how Review relates to it
- the minimum-gap model: where the setting lives, what a reservation snapshots, what the
  exclusion constraint compares, and WHY derivation widens both sides while the persisted
  constraint pads one — they are the same rule seen from opposite ends
- why exact start times must stay distinct rather than being merged

Then state plainly that step 4 is awaiting my manual UX approval, and that the final
progressive-summary and mobile-accordion screenshots in S:\Studdy\.review\step4\ still
need my review.

Do NOT implement anything, push, open a pull request, merge, or start step 5 until I have
confirmed your recovered context is correct. Stop after the summary and wait for me.
```

---
