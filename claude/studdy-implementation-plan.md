# Studdy — Implementation Plan and Session State

Last updated: 5 August 2026 (NZT). Written by Claude for continuity across sessions.

Companion documents in this project:

* `claude/studdy-fable-handoff-brief.md` — the handoff brief verbatim. Authority rank 1.
* `claude/studdy-planning-pack-digest.md` — extracted specifics from all 14 planning PDFs (schemas, tables, statuses, tokens, routes, entity names, conflicts, gaps). Read this before implementation.
* The 14 source PDFs themselves are added to project knowledge by Darsha/Marina; the Projects API rejects binary uploads from a session, so Claude cannot upload them. If they are present, prefer the PDFs over the digest for exact wording.

## Current status

* All 14 planning documents read in full. Handoff acknowledgement delivered to Marina/Darsha; "begin PR1" approval given on 5 August 2026.
* Repository connected: `E:\ExternalStorage\Projects\Studdy` cloned from empty `github.com/darshabloom/Studdy` on Marina's computer. Local commit identity: `darshabloom <darshawaterhouse360@gmail.com>` (repo-local config).
* Legacy repo `github.com/TreeToppr/darsha-tutoring` cloned read-only into session scratchpad for later audit.
* PR1 (`feat/bootstrap-and-product-shell`) in progress on Marina's machine.
* Toolchain on Marina's machine: Node v24.12.0, npm 11.12.1, pnpm 10.34.5 (installed via npm -g). Docker and Supabase CLI NOT installed — local Supabase cannot start until installed (ACTION REQUIRED). GitHub CLI not installed.

## Environment facts

* Repository: `github.com/darshabloom/Studdy` — private/empty at start, zero branches as of 5 Aug 2026. Legacy repo for read-only audit: `github.com/TreeToppr/darsha-tutoring`.
* Supabase Development project: `https://klocfukykunxiggwpohg.supabase.co` (ref `klocfukykunxiggwpohg`). The anon key is publishable. The service_role key was supplied in chat on 5 Aug 2026 — it is server-only, must never be committed or exposed to browser code, and should be re-supplied by Marina in any new session (session-local secret files do not carry over). Recommend rotating the service_role key before anything beyond development use, since it was pasted into chat.
* Target local path on Marina's machine: `E:\ExternalStorage\Projects\Studdy`.
* Marina's timezone: Pacific/Auckland. Platform default country: New Zealand (currency default NZD appears only as an example in the docs — confirm before hard-coding).

## First pull request: `feat/bootstrap-and-product-shell`

Scope per brief §5, built following Blueprint (doc 05) §28's ten-step bootstrap sequence, with these reconciliations already agreed in the acknowledgement:

* Monorepo per Blueprint §4/§31 INCLUDING `infrastructure/scripts/` and `.github/CODEOWNERS` (the brief's tree omits them).
* 20 database schema directories per Database Schema spec (doc 07) §2.2, overriding Blueprint §10.1's list of 12: identity, families, students, tutors, organisations, services, availability, bookings, payments, lessons, learning, resources, communications, support, permissions, platform, audit, integration, migration, shared.
* Package scope `@studdy/...` (Blueprint writes `@Studdy` — invalid npm casing).
* ADRs 0001–0005 required by Blueprint §19.3 (supabase-auth, drizzle, inngest, transactional-outbox, lightweight-monorepo), plus an ADR recording the packages-monorepo decision over Technical Architecture §3.2's in-app modules layout, and an ADR pinning tool versions (no document pins any version; pin current stable Node LTS, Next.js, TypeScript, Tailwind, Drizzle, Vitest, Playwright, Turborepo, pnpm).
* CI gates per doc 07 §18.1 including: migrations apply to empty DB and from previous release, schema drift detection, RLS-classification failure for unclassified exposed tables, ledger balance tests (once payments schema exists), package boundary checks, secret scanning.
* Identity: `auth.uid() → identity.auth_identity_links → identity.users`; business tables FK to Studdy User IDs only. No boolean role columns; roles via `permissions.role_definitions` + `identity.user_role_assignments`. No workspaces table — workspace derives from role assignments, resolved server-side per Blueprint §6.1.
* Design tokens: no document contains any hex value, font family, radius/shadow/breakpoint value — only role names (deep/primary/mid purple, pale lavender, deep/mid/pale green, warm off-white surfaces; spacing scale 4–96px; ten type roles). Claude authors actual values (WCAG 2.2 AA proven) inside PR1 for approval via the Vercel preview.
* Homepage: brief's minimal shell wins for PR1. Hero headline candidate from doc 14: "Find the right tutor. Understand every step of their progress." Example tutor cards must be clearly labelled as examples. Do not ship the "pronounced Tutor-in" copy artefact found in docs 13/14. "How it works" copy must describe the multi-tutor request flow, not the single-tutor flow printed in doc 14.
* PR1 exclusions: everything in brief §5's excluded list.

## PR sequence after PR1

Each ends with PULL REQUEST READY FOR APPROVAL; no merge without explicit approval.

1. feat/identity-and-authentication
2. feat/family-and-student-onboarding
3. feat/public-tutor-discovery (seeded tutors per brief §13)
4. — approval gate: multi-tutor state machines (see decisions below) —
5. feat/intended-lesson-request
6. feat/tutor-request-response
7. — approval gate: Stripe test-mode setup —
8. feat/stripe-booking-confirmation
9. feat/multi-tutor-selection
10. FIRST PACKAGE COMPLETION EVIDENCE per brief §20

Email provider comparison (EMAIL PROVIDER DECISION REQUIRED per brief §10) is produced as a decision document before any provider-specific email code; Supabase Auth built-in emails + local preview inbox cover PR1.

## Source conflicts identified (acknowledged 5 Aug 2026)

1. Request model — docs 09/10/11/12/13/14 all document a single-tutor sequential model; Core User Journeys §11 ("One Active Request Per Intended Lesson") prohibits competing requests; the Data Model's Booking has a singular tutor; no document contains Intended Lesson Request or Tutor Request entities or state machines. Brief §3 + MVP Plan §18–22 override: multi-tutor fan-out, initial cap 3 (admin-configurable), "first tutor to accept does not automatically win", transactional idempotent close-out, losing tutors never told who won. Tutor-cannot-see-competitors is stated only in the brief and stands as rule. The missing state machines must be drafted and approved before feat/intended-lesson-request.
2. Repository layout — Blueprint packages monorepo wins over Technical Architecture §3.2 in-app modules; 20 schema dirs per doc 07. Record as ADR.
3. Payment default — Stripe test mode for marketplace relationships (brief §9 + MVP Plan §46–47) wins over Vision §13's direct-pay-plus-commission model ("Darsha's ASB account through Akahu" must not be hard-coded). Direct payment remains a later capability for tutor-brought relationships.
4. Roles — seed the nine role definitions from the Permissions doc (Parent/guardian, Dependent student, Independent student, Tutor, Supporter, Organisation member, Organisation manager, Platform Manager, Platform Owner); doc 03's single "Admin" maps to Manager + Owner; Supporter is a role definition with no workspace in package one.
5. Minor: public nav/homepage lists differ (brief wins for PR1); doc 01 approved vocabulary says "Booking request" vs later Intended Lesson Request / Tutor Request (later model wins); public tutor profile shows First name only per doc 14 (privacy-conservative, pending approval); Booking status vocabularies differ across docs 09/10/12 — subsumed into the state-machine redraft.

## Product decisions still required (none block PR1)

* Brand token values, font choices, temporary wordmark → Claude drafts in PR1, Darsha approves via preview.
* Multi-tutor state machines: Intended Lesson Request, Tutor Request, Booking, hold semantics, deadline/expiry defaults (docs give admin-configurable bands only; MVP Plan payment windows: >72h→24h, 24–72h→8h, 6–24h→2h, <6h→immediate, all "suggested").
* Whether a tutor can tell a request is multi-tutor.
* Payment authorisation shape: recommend pay-after-selection per brief (Core User Journeys documents authorise-before-send; brief overrides).
* Independent-student age/eligibility/consent rules (no document defines them).
* Matching preference fields for tutor age/gender/cultural background: hold out of schema pending a legal check (NZ Human Rights Act 1993).
* Email provider (comparison doc first).
* Default currency NZD confirmation.

## Actions required from Darsha (state as of 5 Aug 2026)

* DONE: GitHub connected at account level; Supabase Development project created, URL + keys supplied; repository access restored via on-computer session; "begin PR1" approval given.
* REQUIRED NOW: install Docker Desktop and the Supabase CLI on this machine so `pnpm supabase:start` works locally (exact steps in PR1's ACTION REQUIRED block); re-supply the Supabase service_role key when cloud work begins.
* REQUIRED BEFORE PR1 COMPLETION: Vercel account, import `darshabloom/Studdy`, enable preview deployments (Claude supplies the env vars when due).
* Grant read access to `TreeToppr/darsha-tutoring` for the migration audit if possible. (Read access confirmed working 5 Aug 2026 — public/granted.)

## Standing rules for any session picking this up

Follow the brief's authority order, conflict/decision/action block formats, approval checkpoints (brief §19/§21), build ledger (§17), PR content requirements (§15), and the definition of COMPLETE (§17/§20). Never merge, never enable live services, never commit secrets, never present example tutors as real, and never place business rules client-side.
