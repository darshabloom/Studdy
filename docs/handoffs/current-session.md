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

**Branch:** `main`. **HEAD:** `7ad49238debca151dce5525243861a73a70f57be` (`7ad4923`) —
_feat: discovery and tutor-profile availability calendars (PR6) (#18)_
**Working tree:** clean. Nothing uncommitted, nothing stashed.

> **PR [#18](https://github.com/darshabloom/Studdy/pull/18) IS MERGED** (squash, 2026-08-23),
> as is [#17](https://github.com/darshabloom/Studdy/pull/17) before it (squash, 2026-08-20).
> No feature pull request is open; the only open PRs are Dependabot's. UX redesign **steps 1,
> 2 and 3 are complete and on `main`**; **steps 4–6 remain**. Branch fresh from `main` for
> step 4 — do not reuse `feat/discovery-and-profile-availability-calendars` or
> `feat/availability-and-multi-time-requests`, both now merged history.

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

**Expected state after a clean run:** 28 tables classified by `check:rls`; **307 unit and
integration tests passing with 1 skipped** (4 configuration, 50 design-system, 123 domain,
34 web, 96 database including its integration suite); **80 end-to-end**. `typecheck`,
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

Steps 1 to 3 are merged; step 4 is built and awaiting review. **Steps 5 and 6 remain.** Rewrite or update the end-to-end
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

### Step 4 — the `/book` journey — **AWAITING REVIEW**

On `feat/parent-booking-journey`, branched from `49df4cf`. Complete and verified;
**not merged, and not to be merged without the owner's approval.**

Child → Subject → Tutor → Lesson length → Online/In person → Times → Review → Send request.
One route per step under `/book`, server-rendered, with the answers held in the URL.

**Nothing is persisted while a family browses.** No draft row, no session blob, no half-made
subject section — opening the wizard cannot change a child's record. The corollary is that
every parameter is attacker-controlled, so `resolveBooking` re-checks all of them on every
request: the child against who the user may act for, the tutor through the bookable
allow-list, the version against that tutor's own rows for that subject. An answer that no
longer resolves is dropped along with everything downstream and the family lands on the first
open question. **Price and duration are never read from the URL** — only a version id.

**The send is atomic.** `createIntendedLessonRequest` now accepts a `subjectSectionDraft`
instead of a section id, and the find-or-create runs inside the transaction that already
writes the request, its time options, the tutor request and the hold. Either all of it commits
or none does, so a send that loses a race for a slot leaves the child unchanged rather than
carrying a subject they never agreed to study. Everything before the transaction stays
read-only, and the availability check and GiST exclusion constraint are untouched.
`student_subject_sections_live_unique_idx` already existed, so the find-or-create is
concurrency-safe with no lock and no migration.

**Slots are drawn as START MARKERS, one step tall — and this matters.** Drawn at their full
lesson length, slots derived every half hour OVERLAP, and absolutely positioned overlapping
blocks cover one another: every start but the last was physically unclickable. Marking the
start is also what is actually being chosen. They are still not merged — 4:00 and 4:30 are
the choice. **Step 5 and anything else touching this grid must keep both properties.**

**The format step appears only when it is a question.** Where a version can be delivered one
way, the answer is settled at the length step and the rail never promises a screen that is not
coming.

**Two latent bugs surfaced and were fixed.**

1. `createIntendedLessonRequest` keyed service versions by tutor id alone, so a tutor with two
   lengths silently kept whichever row came back last: a family choosing ninety minutes could
   be charged for sixty. The chosen id is now looked up among that tutor's rows for that
   subject only, so a version belonging to another tutor or subject is refused.
2. `bookableSlotsForSubjectSection` returned one entry per version, so once a tutor published
   two lengths a discovery card derived them twice and rendered whichever arrived last. It now
   returns one entry per tutor at the CHEAPEST length, which is the one the card's "from"
   price already quotes.

**Time options are 1–5 everywhere**, including the shortlist fan-out, with shared copy in
`TIME_OPTIONS_GUIDANCE`.

**Test isolation worth knowing about.** `booking-journey.spec.ts` sends real requests, which
take real calendar holds. It books **Mei / English**, whom no other spec touches — booking a
maths tutor made the lesson-request and discovery journeys fail on times this spec had quietly
taken. It is also excluded from the mobile project, like the other journey specs, because both
projects would otherwise race the same account. This is the same class of collision the
dedicated accounts already prevent, one level down: **a spec that sends a request needs its own
tutor, not just its own family.**

**New and changed files**

| File                                                    | What                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/web/src/app/book/**`                              | entry redirect plus seven step routes                        |
| `apps/web/src/lib/booking/draft.ts`                     | URL parsing, href building, dropping answers below a step    |
| `apps/web/src/lib/booking/resolve.ts`                   | re-authorises every parameter; decides the next open step    |
| `apps/web/src/lib/booking/availability.ts`              | derivation without a section; start markers; `stillBookable` |
| `apps/web/src/lib/booking/actions.ts`                   | the send, re-resolving everything server-side                |
| `apps/web/src/components/booking/**`                    | shell and rail, choice list, time picker, review form        |
| `packages/database/src/repositories/services.ts`        | `listBookableServices`, `formatsForVersion`                  |
| `packages/database/src/repositories/lesson-requests.ts` | chosen version, section draft, atomic send                   |
| `packages/database/src/repositories/availability.ts`    | one entry per tutor at the cheapest length                   |
| `packages/domain/src/availability/combine.ts`           | 1–5 bound and `TIME_OPTIONS_GUIDANCE`                        |
| `packages/design-system/.../week-calendar.tsx`          | optional `hourHeight` for the selection grid                 |
| `apps/web/src/middleware.ts`                            | `/book` is protected                                         |

**No migration, no schema change, no RLS change.**

**Verified:** typecheck, lint, format, `check:rls` (28 tables), `check:boundaries`, build,
**347 unit and integration tests with 1 skipped** (up from 333) and **93 end-to-end** (up from
86), all after `db:reset && db:migrate && db:seed`.

**A third bug, found by the tests and the most serious of them.** In `mini` density the
calendar BODY skipped the gutter cell while the header rendered it, so the two grids disagreed
about which track each day occupied: the first day landed in the zero-width gutter track and
the seventh was pushed off the end. Discovery cards were showing six days and a sliver. It
survived the whole of step 3 because the lost column was whichever day came first in the
rolling week, and no seeded tutor taught on it until a Monday. The header half of this was
fixed during step 3 — fixing only half is what left the grids disagreeing. Both calendar specs
now assert seven day columns each with real width; the old assertions compared block-bearing
columns against headings, which a zero-width column satisfies perfectly well.

**Screenshots** for the review point are in `.review/step4` (gitignored), from
`step4-review-shots.mjs` plus `step4-review-extras.mjs` for the two screens the main walk
cannot reach: the discovery entry point, which needs a subject context, and the format step,
which needs a tutor teaching both ways — James's Calculus, at Years 10–13, so a senior student.
Point both at a production server, never `pnpm dev`.

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
- you are on main, up to date with origin/main
- HEAD is 5b948b4928b68238b3eff2c2a5e038b4d901e45a (5b948b4), the squashed PR #17
- the working tree is clean
- there is no open pull request; PR #17 is merged
- UX steps 1 and 2 are present: packages/design-system/src/components/calendar/ holds
  geometry.ts, geometry.test.ts and week-calendar.tsx, and apps/web/src/app/tutor/availability/
  holds page.tsx, availability-calendar.tsx and availability-editor.tsx

Then, in your own words rather than copying the handoff back to me, summarise:
- the approved UX redesign, the normal parent booking journey, and why shortlisting is
  optional
- what WeekCalendar is, its wall-clock geometry model, its modes, and what
  familySafe/assertFamilySafe protects
- why "Preview as family" is a separate server render rather than a client toggle
- how lesson format scopes availability, and why a blocked period is never format-scoped

Then identify step 3 (discovery mini calendars and the large tutor-profile calendar) and
state what it involves.

Do NOT begin implementation. Branch fresh from main when we start. Stop after that summary
and wait for me to confirm your recovered context is correct.
```

---
