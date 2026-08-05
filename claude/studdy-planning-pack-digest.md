# Studdy — Planning Pack Digest

Extracted 5 August 2026 from the 14 planning PDFs by full reading. This is a working reference, not a replacement for the source documents. Where a builder needs exact wording, read the PDF. Authority order is set by the Fable Handoff Brief (`claude/studdy-fable-handoff-brief.md`), not by this file.

Document status matters: docs 01, 05, 06 and 07 are Approved v1.0 (01, 05, 06 dated 31 July 2026; 07 dated 2 August 2026). Docs 02, 03, 04, 08, 09, 10, 11, 12, 13, 14 are Draft 0.1. Doc 04 and doc 08 are marked "Ready for review". Doc 10 states it is conceptual and that table names and storage choices may be refined in technical design.

## Doc 01 — Product Design System and UX Standards (Approved v1.0, 13pp)

Colour is specified by role only. No hex, HSL or OKLCH value appears anywhere in the pack. Purple roles: deep purple (high-contrast brand moments, dark feature surfaces), primary purple (main actions, selected navigation), mid purple (interactive emphasis), pale lavender (selected states, highlighted cards, branded surfaces). Green roles: deep green (supporting brand moments), mid green (secondary emphasis, progress interactions), pale green (learning growth, achievements, supportive surfaces). §4.3 requires that brand green is not the only success treatment, that separate semantic tokens exist for information, success, warning, risk, critical danger, neutral status and restricted access, and that every semantic state also uses text, icons or patterns rather than colour alone.

Surfaces (§7.1): page background warm off-white; primary card white; secondary card very light neutral tint; brand feature pale lavender; progress feature pale green; warning or restricted soft amber or muted neutral warning tint; critical very pale red.

Spacing scale (§7.2): 4, 8, 12, 16, 24, 32, 48, 64, 96 px. 64 px for public page sections, 96 px for major marketing separation. Semantic spacing tokens are required rather than raw values.

Typography (§5): a restrained two-font system — a modern sans for app and body text plus a distinctive display face for public headings. No families are named. Ten type roles: Display 1, Display 2, Heading 1, Heading 2, Heading 3, Body large, Body, Body small, Label, Caption. Tabular numerals for finance, time and statistics.

Shape and depth (§6): moderate rounding; gentle radius for buttons and inputs; medium for cards and dialogues; pills only for compact statuses, filters and segmented controls; tables not rounded per cell. Cards and tables generally carry no shadow; medium shadow is reserved for menus, popovers, date pickers, drawers and dialogues. Focus must read as visually stronger than hover. One outline icon family.

Token taxonomy for `packages/design-system` (§17). Tokens: colour, typography, spacing, radius, shadow, border, breakpoints, motion, z-index. Primitives: button, input, label, checkbox, radio, switch, select, dialog, popover, tooltip, tabs, accordion. Components: status badge, alerts, cards, tables, filters, forms, stepper, calendar, workspace switcher, impact preview. Layouts: public, workspace, dashboard grid, split view, detail panel, reading layout. Patterns: loading, errors, restricted access, confirmation, autosave, navigation, upload, progress visualisation. Naming examples given: `colour.action.primary`, `colour.status.warning`.

Button hierarchy (§9.1): primary (purple fill, normally one per decision region), secondary, tertiary, quiet or text, destructive, icon-only.

Status system (§10.2), ten families: Active, Pending, Awaiting action, Complete, Paused or held, Restricted, Overdue, Failed, Cancelled, Archived.

Calendar language (§13.3), nine states: Available, Temporary hold, Requested, Awaiting payment, Confirmed, Unavailable, Travel buffer, Personal blocked time, Recurring slot.

Approved vocabulary (§16.3): Tutor, Parent or guardian, Dependent student, Independent student, Booking request, Confirmed booking, Lesson, Service, Recurring series, Homework assignment, Progress update, Concern, Support case, Restriction, Suspension. Note the conflict: later documents introduce Intended Lesson Request and Tutor Request, which this approved list does not contain.

Microcopy rules (§16), prefer over avoid: "Pay and confirm booking" over "Proceed"; "Tutor response required by 5:00 pm" over "Pending"; "We could not confirm the payment yet" over "Transaction error"; "You do not have access to family payment information" over "Forbidden"; "End recurring lessons" over "Delete"; "Choose at least one subject" over "Invalid input". Dates render as "Friday, 31 July 2026 at 4:00 pm". Placeholder-only forms are prohibited; every control carries a visible label above it.

Workspace density (§3.1): public website spacious and expressive; parent clear and moderately spacious; tutor efficient and moderately compact; dependent student simple, visual, low density; independent student clear and capable; manager and owner denser, with tables, queues and split views.

Accessibility (§15): WCAG 2.2 AA minimum across the public site and every workspace. Automated checks alone are explicitly insufficient. Visual regression at desktop, medium and mobile widths (§17.3). Storybook or equivalent must document every shared component with realistic synthetic data covering default, variants, focus, disabled, loading, error, empty, long text, compact, wide and keyboard interaction.

Public product previews must use realistic synthetic data with no real student information; example profiles must be clearly labelled and never presented as real tutors (§8.1–8.2, §18.3).

Verification labels are fixed strings (§14.3): identity verified, qualification verified, references completed, Studdy interviewed.

Progress scale is a possible default only, explicitly configurable: Not yet assessed, Beginning, Developing, Secure, Extending.

## Doc 02 — Information Architecture and Screen Map (Draft 0.1, 38pp, 110 sections)

One account, multiple workspaces (§2). Workspaces: Parent, Tutor, Dependent student, Independent student, Organisation, Platform Manager, Platform Owner. After login return to the last-used workspace; the switcher is always accessible; one workspace context at a time.

Two navigation layers: universal plus workspace. Desktop uses a persistent left sidebar with a compact universal top bar; mobile uses workspace-aware bottom navigation and is designed separately rather than as a shrunk desktop. Universal top-bar controls (§3): workspace switcher, search, create, notifications, messages, help, account menu, sign out. Active sidebar destination renders as pale lavender background, purple icon, stronger label weight. Navigation must be permission-aware.

Sidebar sections, the closest thing to a route map in the pack — no URL path is specified anywhere in any document:

- Parent (§17): Home, Students, Bookings, Progress, Tutors, Payments, Resources, Support.
- Tutor (§26): Home, Bookings, Students, Services, Lessons, Resources, Earnings, Profile. Calendar is a view inside Bookings (§28), not a sidebar item.
- Independent student (§42): Home, Bookings, Progress, Tutors, Payments, Resources, Support.
- Dependent student, mobile (§36): Home, Homework, Lessons, Progress, More.
- Organisation (§43): Home, Tutors, Students, Programmes, Bookings, Resources, Finance, Reports, Settings.
- Platform Manager (§53): Home, Cases, Tasks, Users, Tutors, Organisations, Marketplace, Payments, Reports, Rules, Integrations, Audit, Settings.
- Platform Owner (§68): manager navigation plus Managers, Platform Health, Countries and Regions, Global Configuration, Financial Rules, Legal and Safeguarding, Data Retention, Emergency Controls, Platform Security, Ownership.

Public navigation (§15): Find a Tutor, How It Works, Resources, For Tutors, For Organisations, Trust and Safety, Help, Log In, Join Studdy. Primary CTA Find a Tutor; secondary CTA Join as a Tutor. Homepage sections (§16): hero, tutor discovery entry, tutoring value proposition, progress and continuity explanation, how Studdy works, tutor trust indicators, pricing explanation, tutor examples, resource marketplace introduction, parent and tutor calls to action. Public tutor profiles show limited information until sign-in.

Personalisation (§14): shortcuts, configurable Home widgets, multiple layouts, device-specific preferences. This implies stored preferences from day one, including last-used workspace.

Also covers shared record patterns (sticky headers, timeline, status, filters, detail page), quick-create menus per workspace, mobile priorities, permission and visibility behaviour, a manager permissions matrix requirement (§69) covering roles, scopes, temporary permissions and impersonation rights, and 14 IA principles.

## Doc 03 — User Roles and Permissions (Draft 0.1, 20pp, 37 sections)

Core roles (§2): Tutor, Parent or guardian, Dependent student, Independent student, Supporter, Admin. One person may hold several roles under one account; the role switcher moves between workspaces without signing out; data and permissions stay separated by role even for the same person. Note the conflict: this doc uses a single "Admin" where docs 02, 08 and 12 split Platform Manager from Platform Owner and add organisation roles.

Family account model: one primary parent, second guardian later. Student profiles may exist before any login exists (§6), with five possible future login methods. Covers dependent-student booking, financial and learning permissions; parent-private notes; tutor internal notes; tutor handover and collaboration; the overall student progress record; concerns; the independent-student role and its two entry paths plus the dependent-to-independent transition; the supporter role; student profile lifecycle (archive, merge, transfer); tutor removal; tutor profile visibility states; tutor codes and private invitations; tutor-brought versus marketplace relationships; referral credits.

Admin sections (§29–35): data access, impersonation, amendments, reversals, tutor management, recommendation controls, audit history. Ends with ten permission design principles.

## Doc 04 — MVP Scope and Delivery Plan (Draft 0.1, "Ready for review", 30pp, 75 sections)

Full rebuild of DarshaTutor as Studdy with no permanent parallel system. Distinguishes architecturally supported, available at launch, and enabled after launch.

Nine delivery phases (§60–68), verbatim names:

1. Technical foundation — repository structure, environments, authentication, user identity, roles, workspaces, permission engine, audit, core design system, shared entities, notification foundation, file storage, error monitoring.
2. Family and student foundation — Family Account, parent workspace, Student Profile, Student Subject Sections, dependent-student permissions, independent-student structure, Tutor–Student Relationship, timeline foundation.
3. Tutor onboarding — application, verification, interviews, approval workflow, conditional approval, guided setup, tutor profile, services, availability, service review.
4. Public discovery — public website, matching questionnaire, matching summary, tutor shortlist, public profiles, search and filters, account conversion, tutor invitation links.
5. Booking — Intended Lesson Request, Tutor Requests, multi-tutor requests, acceptance, parent selection, temporary holds, response deadlines, instant booking eligibility, recurring series, calendar protection, backup interest.
6. Payments — Stripe onboarding, parent payments, tutor payouts, Studdy fee, direct-payment ledger, cash and bank-transfer status, commission collection, refunds, credits, overdue restrictions, disputes.
7. Lessons and progress.
8. Administration and launch readiness.
9. Migration and public launch.

Note: the first package as defined by the brief spans phases 2 through 6 of this plan. Either the package definition or the phase plan needs restating; the brief governs.

Primary launch journey, 17 steps (§6): Find a Tutor, questionnaire, several suitable tutors, review, account created when ready to request or book, student profile created or selected, parent sends one or more controlled tutor requests, tutor accepts or declines, parent chooses an accepted tutor, parent pays or confirms approved direct payment, booking confirmed, lesson, outcomes recorded, tutor approves summary, homework and progress updated, both decide whether to continue, tutor paid and Studdy receives fee.

Request model (§18–22). The Tutor Request is distinguished from the underlying Intended Lesson Request, whose fields are student, subject, service need, preferred date and time, format, duration, trial status, budget and parent preferences. Several Tutor Requests may link to one Intended Lesson Request. "A recommended initial maximum is three, configurable by admin." Different subjects, services or lesson times are separate intended lesson needs. A valid payment method should normally be required before a new family sends one intended lesson request to several tutors, with no charge at that point, and with this copy: "Your card will not be charged when these requests are sent. Payment occurs only when you choose a tutor and confirm the booking." Exceptions: free trials with no possible charge, organisation-funded lessons, approved direct-payment relationships, admin-approved cases. Tutors may accept, decline, propose another time, or ask an allowed booking-related question. Every request carries an automatic response deadline varying by time until lesson, tutor minimum notice, single versus multi-tutor, trial versus standard, online versus in-person, and new versus existing student. Expired requests release calendar holds automatically. "The first tutor to accept does not automatically win." On acceptance the parent may choose immediately, wait, withdraw others, or continue to the deadline. On selection: proceed to payment and confirmation, remaining linked requests close, other tutor holds release, other tutors are notified.

First-booking payment (§23–27). No payment before tutor acceptance. After acceptance the status becomes "Awaiting parent payment", the slot receives a temporary hold, and the parent gets a "Pay and confirm booking" action. Payment windows, suggested defaults, admin configurable: more than 72 hours away gives a 24-hour window; 24 to 72 hours gives 8 hours; 6 to 24 hours gives 2 hours; under 6 hours is immediate. The interface must show amount, deadline, time remaining and the consequence of non-payment. During the hold the slot is protected, no other family may confirm the same time, backup interest may be collected, expiry is visible, the tutor may withdraw acceptance before payment with a reason (repeated withdrawals may affect reliability), and the parent may withdraw freely before payment.

Relationship stages (§29): Prospective ("Request exists. Tutor sees limited decision-making information."), Pending confirmation, Active, Paused, Ended, Historical.

Other launch-scope facts: the matching questionnaire is completable before account creation and answers carry into account creation (§9); direct request from recommendation cards without opening the full profile (§10), with mandatory pre-submission disclosure of tutor, service, subject, year level, price, duration, format, cancellation terms, payment method, trial terms and whether tutor acceptance is required. The first lesson is a standard paid lesson acting as a mutual fit check — no discount, no guaranteed ongoing place (§28). Recurring is confirmed after the first approved summary (§30–32). Instant booking is in launch scope but gated; new tutors do not receive it automatically; a possible threshold is five completed lessons, accurate availability, acceptable cancellation record, completed onboarding, valid payment setup, no unresolved concerns, no active restrictions (§33–34).

Architecturally supported but not necessarily enabled at launch (§8): organisations, group lessons, fixed cohorts, drop-in sessions, resource marketplace, assessment marketplace, contributor royalties, international regions, advanced reporting, mobile applications, embedded lesson room, in-platform video, advanced AI recommendations, multiple guardians, advanced supporter workflows.

Launch acceptance criteria (§69–73) cover the parent journey, tutor journey, payment journey, security and access (role separation, relationship scope, server-side permissions, strong authentication for sensitive actions, audit) and operational readiness.

## Doc 05 — Implementation Blueprint and Repository Plan (Approved v1.0, 15pp)

New private repository `github.com/darshabloom/Studdy`. The old `github.com/TreeToppr/darsha-tutoring` stays intact as a migration source with per-feature Reuse, Adapt, Rebuild or Retire classification.

Repository tree (§4, §31):

```
Studdy/
  apps/web/
  packages/{configuration, database, design-system, domain, integrations, observability, permissions, testing}
  infrastructure/{inngest, scripts, supabase, vercel}
  migration/{exceptions, mappings, reports, source-analysis, transforms, validation}
  documentation/{architecture, decisions, implementation, operations, product}
  .github/workflows
  .github/CODEOWNERS
```

Note two omissions in the brief's copy of this tree: `infrastructure/scripts/` and `.github/CODEOWNERS`. CODEOWNERS is mandatory for migrations, permissions, payments and infrastructure (§27). Note also the name collision: top-level `migration/` is DarshaTutor data-migration tooling, distinct from `packages/database/migrations/` for schema migrations (§16).

Next.js structure (§6): `apps/web/src/app/` containing `(public)/{page.tsx, find-a-tutor, tutors, how-it-works, for-tutors, trust-and-safety, pricing, help}`, `(auth)/{sign-in, sign-up, verify, reset-password, mfa}`, then `parent/`, `tutor/`, `student/`, `organisation/`, `manager/`, `owner/`, and `api/{webhooks, callbacks, downloads, integrations}`. App Router, Server Components by default, route-group layouts, server-side workspace protection. `organisation/` sits behind the `organisation_workspace` feature flag; §28 step 5 omits it from the layout list while §6 includes it in the tree.

Workspace resolution (§6.1), six steps: load the signed-in Supabase identity; resolve the linked Studdy User; confirm the account and role assignment are active; resolve the requested or last valid workspace; recalculate restrictions and authentication assurance; render only the pages and actions authorised for that workspace. "Entering a protected URL must never be sufficient to gain access."

Design system (§7): `packages/design-system/src/{tokens/{colours.ts, typography.ts, spacing.ts, radii.ts, shadows.ts, breakpoints.ts}, primitives/, components/, layouts/, styles/}`. Tailwind plus Radix primitives; Radix must not be the visible appearance.

Domain (§9): `packages/domain/src/{identity, families, students, tutors, services, discovery, availability, bookings, payments, lessons, learning, notifications, support, platform}`, each exposing only `index.ts` or explicit package exports.

Testing (§24): `packages/testing/src/{builders, fixtures, scenarios, repositories, providers, permissions, assertions}`.

Integrations (§25): `packages/integrations/src/{stripe, email, calendar, ai, file-scanning, recording}`.

Toolchain (§5): pnpm, Turborepo, TypeScript strict, ESLint for code quality and import boundaries, Prettier, Vitest, Playwright, Node version locking. No version is pinned anywhere in the pack.

Root commands: `pnpm dev`, `build`, `typecheck`, `lint`, `test`, `test:integration`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, `db:reset`. Local setup order: `pnpm install`, `pnpm supabase:start`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`. Seeds are scenario-based, e.g. `pnpm db:seed --scenario approved-tutor`, `--scenario payment-dispute`.

Package dependency direction (§14): `apps/web` depends on domain, permissions, configuration, design-system, database, integrations, observability. `database` implements domain repository interfaces. `integrations` implement domain provider interfaces. Domain must not import Next.js, React, Tailwind, Radix, Supabase clients, Drizzle implementations, Stripe, Inngest, provider SDKs or Fable-generated components — enforced by export maps, TypeScript references, ESLint restrictions and dependency-graph checks.

RequestContext (§13): correlationId, requestId, authUserId, StuddyUserId, activeWorkspace, roleAssignments, authenticationAssurance, locale, timeZone, environment. It resolves identity and workspace once per protected request and does not replace fresh authoritative loading inside commands; role removal, suspension, relationship closure and temporary-grant expiry take effect immediately.

Audit foundation belongs in Slice 0 (§23), across four categories: security, business, financial, sensitive-access. Consequential audit records are written in the same transaction as the business change.

Bootstrap sequence (§28), the PR1 spine: create repository; initialise monorepo; configure standards; configure local Supabase; create application shell; create core contracts (IDs, Money, time, command results, errors, request context, repository and provider interfaces, permission decisions, audit, events, outbox); establish testing; add CI and branch safety; add documentation; review bootstrap.

Bootstrap completion criteria (§30): clean clone runs; dependencies install without manual repair; Next.js runs locally; local Supabase starts and resets; a migration and a named seed scenario succeed; unit and smoke tests execute; GitHub checks pass; package boundaries are enforced; preview deployments use safe development configuration; no production credentials in the repository.

Required ADRs (§19.3): ADR-0001-use-supabase-auth, ADR-0002-use-drizzle, ADR-0003-use-inngest, ADR-0004-use-transactional-outbox, ADR-0005-use-lightweight-monorepo.

Feature flags (§26): instant_booking, organisation_workspace, resource_marketplace. Doc 06 §10.1 gives a superset of eight — use that.

Fable must not automatically (§29.5): create or retain production secrets; place service-role keys in browser code; connect preview deployments to production data; approve its own security-sensitive changes; design RLS without review; create undocumented migrations; disable security controls; copy live student data into development; infer permissions from interface visibility.

Two defects in the source text: §9.3 writes imports as `@Studdy/domain/bookings`, which is invalid npm scope casing — use `@studdy/...`. Several numbered lists render with wrong starting numbers (§21 numbered 7–13 for a 1–7 list); these are rendering artefacts.

## Doc 06 — Technical Architecture and Security Design (Approved v1.0, 17pp)

Modular monolith, one Next.js application, server-authoritative. Eight approved architecture principles including "Build the real foundation once" and "Provider independence".

Identity: Supabase Auth owns credentials, email verification, password reset, sessions, factors and provider identities only. The permanent Studdy User record is the business identity. MFA is mandatory from launch for Platform Owner and privileged managers. Step-up authentication is required for viewing identity evidence, accessing safeguarding material outside an assigned case, changing payout details, impersonation, changing roles or permissions, exporting sensitive data, major financial adjustments and Platform Owner transfer (§4.3). `MFA_REQUIRED` is a first-class business error code.

Database: new Supabase project, Drizzle plus reviewed SQL, repository is the source of truth, RLS on every table exposed via the Supabase data API. §6.2 gives a seven-step transactional booking confirmation sequence. Automated tests must fail when a newly exposed table lacks an intentional policy (§7).

Inngest for durable background work; domain events plus a transactional outbox; typed platform configuration; feature flags; PostgreSQL full-text search initially; six data zones; nine storage buckets (§11.2): public-tutor-media, student-files, homework-submissions, lesson-resources, restricted-learning-support, identity-verification, case-evidence, lesson-recordings, lesson-transcripts. Storage policies follow equivalent scope and sensitivity rules; private uploads require server-authorised initiation and short-lived signed instructions; storage paths use internal identifiers, never names or email addresses.

Feature flags (§10.1), eight: instant_booking, group_lessons, resource_marketplace, embedded_lesson_room, student_direct_booking, organisation_workspace, advanced_matching, multiple_guardians.

CI: GitHub-controlled pipeline with ten required checks (§14.2). No direct pushes to protected branches; passing checks before merge; at least one review for ordinary changes; explicit owner review for sensitive areas; a documented accelerated emergency process. Feature branches get preview deployments never connected to production data. Migrations are immutable once applied to a shared environment; corrections are new migrations; expand-and-contract for breaking changes; forward corrective migrations preferred over reversal (§14.3–14.4).

Also covers encryption, rate limits, retention and legal hold (§18 requires an explicit versioned retention rule for each of eleven data categories, with no periods specified), testing strategy, provider adapter interfaces, DarshaTutor migration, incident response and privileged production access. Observability provider is left unselected (§25).

Conflict to note: §3.2 describes `src/modules/` and `src/platform/` inside a single app with no packages layer, contradicting doc 05's monorepo. Doc 05 governs; record the decision as an ADR. §4.2 also draws a `parent_profiles` child table that does not exist in doc 07 — parent status is expressed through `families.family_memberships.membership_role_code` and `is_primary_guardian`.

## Doc 07 — Database Schema and Migration Specification (Approved v1.0, 2 Aug 2026, 30pp)

Twenty named schemas (§2): identity, families, students, tutors, organisations, services, availability, bookings, payments, lessons, learning, resources, communications, support, permissions, platform, audit, integration, migration, plus a deliberately minimal public.

The `public` rule (§2.1): it may contain approved public views, extensions and tightly reviewed compatibility functions only. Ordinary application tables are never added to public by default. Public tutor discovery uses dedicated views exposing approved fields only, including `public.public_tutor_search` (§15.3). Note that the brief's "nothing in public by default" phrasing would block this required object.

Drizzle schema package (§2.2), authoritative directory list: `packages/database/src/schema/{identity, families, students, tutors, organisations, services, availability, bookings, payments, lessons, learning, resources, communications, support, permissions, platform, audit, integration, migration, shared}/` plus `index.ts`. This supersedes doc 05 §10.1's list of twelve.

Key tables for the first package:

- Identity: `identity.users` (id, reference, legal_name, preferred_name, display_name, date_of_birth, country_code, region_code, time_zone, locale, account_status_code, created_at, updated_at, record_version, archived_at, retention_until, legal_hold_status); `identity.auth_identity_links` (user_id, provider_type, provider_subject_id, provider_tenant, authentication_email, status_code, is_primary, linked_at, last_authenticated_at, unlinked_at, unlink_reason_code); `identity.contact_points`.
- Roles: `permissions.role_definitions`; `identity.user_role_assignments` (user_id, role_definition_id, status_code, effective_from, effective_until, assigned_by_user_id, assignment_reason_code, workspace_enabled, scope_type, scope_id, country_code, organisation_id).
- Workspaces: no table exists. Workspace derives from `user_role_assignments.workspace_enabled` plus scope_type and scope_id, resolved server-side (§13.3). An enumerated workspace code list is implied by RequestContext and `audit.audit_events.active_workspace_code` but is never defined.
- Families: `families.family_accounts` (reference, display_name, primary_country_code, region_code, default_currency_code, status_code, primary_guardian_membership_id, financial_account_id, record_version, archived_at); `families.family_memberships` (family_account_id, user_id, membership_role_code, status_code, effective_from and until, is_primary_guardian, invitation_source_code, invited_by_user_id, accepted_at, ended_at, end_reason_code, historical_access_until).
- Students: `students.student_profiles` (reference, user_id, status_code, independence_status_code, login_access_state_code, school_year_code, school_or_provider_name, primary_curriculum_framework_id, learning_preferences, general_goals, support_summary, default_family_account_id, record_version); `students.student_subject_sections`; `students.tutor_student_relationships`; `students.tutor_student_subject_links`.
- Tutors: `tutors.tutor_applications`; `tutors.tutor_profiles`.
- Services and availability: `services.services`; `services.service_versions`; `availability.availability_rules`; `availability.capacity_rules`; `availability.tutor_time_reservations`.
- Requests and bookings: `bookings.intended_lesson_requests`; `bookings.tutor_requests`; `bookings.bookings`; `bookings.recurring_series`.
- Ledger: `payments.ledger_accounts`; `payments.ledger_transactions`; `payments.ledger_entries` (ledger_transaction_id, ledger_account_id, direction_code, amount_minor, currency_code, entry_sequence); `payments.commission_entries`.
- Files: `platform.files`. Audit: `audit.audit_events`, `audit.status_transitions`, `audit.domain_events`, `audit.outbox_entries`. Migration: eleven tables under `migration.`.

Conventions (§3): `id uuid primary key default gen_random_uuid()`. Human-readable reference prefixes from one concurrency-safe global sequence: USER-, FAM-, STUDENT-, TUTOR-, SERVICE-, BOOK-, SERIES-, LESSON-, PAY-, PAYOUT-, CASE-, RESOURCE-. Standard mutable columns: id, reference, status_code, created_at, created_by_user_id, updated_at, updated_by_user_id, record_version, archived_at, archived_by_user_id; selected tables add effective_from, effective_until, retention_until, legal_hold_status, deletion_status, country_code, organisation_id, correlation_id. Money is `amount_minor bigint` plus `currency_code char(3)`; floats are prohibited. Optimistic concurrency via record_version returning `RESOURCE_CONFLICT`. Foreign keys default to RESTRICT or NO ACTION; CASCADE only for truly dependent technical rows; SET NULL only with adequate snapshots. Boolean columns such as `is_tutor` or `is_admin` are prohibited (§4.3).

Conflict prevention (§9.6):

```sql
exclude using gist (
  tutor_profile_id with =,
  tstzrange(start_at, end_at, '[)') with &&
)
where (status_code = 'active')
```

Tutor request cap (§9.2): "The configurable initial maximum is three active Tutor Requests per intended need", and "The first tutor to accept does not automatically win".

RLS (§13). Resolution chain: `auth.uid() -> identity.auth_identity_links -> identity.users`. All business records reference the Studdy User ID, never `auth.users`. Helper functions resolving the current Studdy User must use safe search paths, narrow outputs, tests, and no unintended privilege escalation. Reusable policy patterns (§13.5): public read; own record; family relationship; tutor relationship and subject scope; organisation scope; manager role and scope; owner authority with strong authentication. Policy naming convention (§13.7): `public_read_approved_tutor_profiles`, `user_read_own_contact_points`, `parent_read_linked_student_homework`, `tutor_read_active_subject_progress`, `manager_read_assigned_support_cases`. Mandatory negative tests (§13.6): anonymous cannot access private records; parents cannot access unrelated families; tutors cannot access unrelated students or subjects; dependent students cannot access family finances; organisation and manager users cannot exceed assigned scope; expired Temporary Access Grants and suspended roles stop working immediately; cross-tutor sharing and historical-access rules are enforced. Sensitive tables default-deny or server-only (§13.4): ledger entries, audit events, identity verification, safeguarding, raw transcripts, raw recordings, payout details, temporary access grants. Service-role credentials remain server-only and must never reach browser code.

Migration approach: Drizzle for typed schema and generated migrations; reviewed handwritten SQL for RLS, constraints, functions, triggers, range exclusions, complex views and performance-sensitive operations. Layout per doc 05 §16: `packages/database/migrations/{generated/, reviewed-sql/{rls, functions, triggers, constraints, transformations}}`. Doc 06 §5.3 gives a different layout; doc 05 and 07 govern.

Required automated checks (§18.1): migrations apply cleanly to an empty database and from the previous release; schema drift detection; generated schema consistency; ledger posting tests proving balanced transactions; range and uniqueness constraint tests; migration-script idempotency and reproducible reconciliation reports. Hard gate: "New exposed tables fail CI if RLS is missing or unclassified."

Initial implementation sequence (§18.2): shared extensions, identifiers, references and audit foundations; identity, authentication links and role assignments; families, students and subject sections; tutors, applications and verification; tutor-student relationships and permissions; services, availability, capacity and reservations; discovery, requests, bookings and recurring series; lessons and learning records; payments, ledger, commission, packages and credits; notifications, support, files and shared models; search projections, Platform Health and migration tooling.

Appendices: A status families, B error codes, C architectural constraints.

## Doc 08 — Permissions, Roles and Access Control (Draft 0.1, "Ready for review", 37pp, 24 parts)

One permanent identity with several roles: Parent or guardian, Dependent student, Independent student, Tutor, Supporter, Organisation member, Organisation manager, Platform Manager, Platform Owner. One active role-specific workspace at a time.

Capability model (§3): `resource.action` plus scope, limits and conditions. Examples: `booking.view`, `lesson_summary.approve`, `student_progress.export`, `user.impersonate`, `impersonation.view|interact|sensitive_interact`. Twenty-two standard actions. Eleven record scopes: Own, Created, Assigned, Relationship-linked, Subject-linked, Programme-linked, Organisation, Regional, Country, All. Twenty limit types. Roles are composed of capabilities and never hardcoded.

Twenty access sources; combined access calculated over seventeen inputs; most-restrictive-wins conflict handling; access is not inferred transitively — access to one record never implies access to linked records. Access ends automatically when its granting source ends, but must be recalculated first, since another valid source keeps access alive.

Access explanations ("Why can or can't I access this?"), Access Request records, automatic access removal, historical read-only access, session effects. Detailed role permission matrices, cross-tutor sharing defaults, organisation aggregated and pseudonymised reporting, sensitive-data categories, temporary access grants, impersonation rules.

Sensitive-data categories (§61): safeguarding records, identity documents, background checks, medical and learning-support information, payment methods, bank and payout details, restricted case notes, legal records, privacy evidence, raw recordings, raw transcripts, authentication data, security records, owner-only controls. Each requires a separate capability; highest-risk access requires purpose declaration (§63). Step-up authentication list (§75): sensitive exports, bank and payout changes, authentication changes, manager privilege changes, permanent deletion, owner actions, high-risk impersonation.

Audit fields (§87): actor, actor role, active workspace, capability, scope, action, entity, date and time, access source, purpose, original value, new value, impersonation status, approval, correlation ID, risk level, session reference. Audit is append-only; corrections use linked correction records, reversal entries or explanatory amendments (§88).

Part 23 covers technical enforcement: server, API, database, search, notification and export-time revalidation. The permission engine (doc 05 §22) returns both a decision and an explanation — allowed or denied, capability evaluated, sources granting access, restrictions and limits, required authentication, user-safe explanation, audit requirement — and evaluation must occur at route, query, command, record, database RLS, file, export and high-risk confirmation layers, where one successful layer must not bypass the others.

No complete capability catalogue exists; roughly eleven examples are given, so the Slice 0 permission scaffolding has no seed data contract yet.

## Doc 09 — Statuses, State Transitions and Business Rules (Draft 0.1, 38pp)

Shared lifecycle categories: Draft, Pending, Active, Paused, Completed, Cancelled, Archived, with module-specific statuses beneath them. Parts One to Eight are cross-cutting machinery: Transition Record, revisions, structured preconditions, reverse and scheduled transitions, grace periods, approvals, acknowledgements, overrides, restriction, suspension, removal, reinstatement. Parts Nine to Twenty-Four are per-module state machines. Part Twenty-Five gives common rules: no silent status changes, idempotency, actor attribution.

Booking statuses (§48): Draft, Requested, Pending payment authorisation, Awaiting tutor acceptance, Awaiting parent approval, Confirmed, Held, Held for reassignment, Reassignment proposed, Cancellation scheduled, Cancelled, Declined, Withdrawn, Expired, In progress, Completed, Disputed, Replaced, Archived. Doc 10 §55 gives a different list (Draft, Requested, Awaiting payment authorisation, Awaiting tutor acceptance, Accepted, Confirmed, Declined, Withdrawn, Expired, Rescheduled, Cancelled, Completed, Disputed). The §50 transition table also targets "Confirmed with replacement", which appears in neither status list.

Booking-confirmation preconditions (§49): tutor acceptance, parent approval, student permission, payment authorisation, required consent, tutor availability, service eligibility, location validity, organisation approval, required Rule Versions, capacity availability.

Payment statuses (§59): Created, Pending authorisation, Authorised, Capture scheduled, Paid, Payment retry scheduled, Failed, Partially refunded, Fully refunded, Disputed, Chargeback received, Reversed, Written off, Archived. Payment rules (§60): a Payment should not become Paid without successful processor confirmation or verified permitted payment evidence, matching Payment Allocation, matching Ledger Entries, currency agreement and amount reconciliation.

Commission statuses (§64): Estimated, Reserved, Chargeable, Adjusted, Owed, Payment plan active, Paid, Waived, Disputed, Reversed. Payout statuses (§62): Draft, Pending reconciliation, Ready, Scheduled, Processing, Paid, Failed, Held, Disputed, Reversed, Cancelled.

Idempotency (§86): automated transitions should be safe to retry without producing duplicate payments, ledger entries, notifications, tasks, refunds, commission entries or bookings.

Reassignment (§91): a parent should not be forced to accept a replacement tutor unless a specific organisation programme rule was agreed in advance.

First production implementation priority (§93): tutor application, tutor account, service publishing, booking, lesson, payment, payout and commission, support case. The brief's package one differs; the brief governs.

Critically: this document contains no state machine for an Intended Lesson Request or a Tutor Request. Those must be drafted and approved before the booking slice.

## Doc 10 — Data Model and Entity Relationships (Draft 0.1, 71pp, 44 parts, 216 sections)

Principles: one permanent User per person with role profiles attached; historical preservation; soft deletion; immutable financial history; explicit relationship entities over generic links.

Entities relevant to package one, with verbatim names:

- User (§15) — one person. Fields: internal ID, human-readable reference, legal name, display name, preferred name, email, phone, profile photo, date of birth where required, country, region, time zone, locale, account status, authentication status, multi-factor status, last login, created date, archived date, deleted date, retention-until date, legal-hold status.
- User Role Assignment (§16) — links a User to a platform role. Roles: Parent, Tutor, Dependent Student, Independent Student, Supporter, Organisation User, Platform Manager, Platform Owner. Fields include workspace availability, scope, status, dates, assigned by, reason, status history.
- Role Profile (§17) — Parent Profile, Tutor Profile, Student Profile, Supporter Profile, Manager Profile, each linking back to one User.
- Family Account (§23) — its own permanent entity, not fields on the primary parent. Fields: family reference, display name, primary country, region, default currency, account status, primary guardian membership, created date, archived date, family preferences, financial account, support status.
- Family Membership (§24) — links a User to a Family Account. Membership roles: Primary guardian, Additional guardian, Dependent student, Independent student with family link, Supporter, Authorised family user.
- Student Profile (§27) — the student's permanent learning identity. Login access states (§26): no login enabled, parent-managed access, dependent-student login active, independent access active, access suspended.
- Student Subject Section (§28) — subject-specific sections within a Student Profile; one profile may contain many.
- Student Independence Transition (§29) — dedicated record for the dependent-to-independent transition, including a new payment responsibility field.
- Booking (§53) — what was scheduled and agreed. Fields: booking reference, student, tutor (singular), Tutor–Student Relationship, service, Service Version, recurring series, cohort or group session, subject, scheduled start and end, time zone, status, format, location snapshot, price snapshot, policy snapshot, payment status, tutor acceptance status, parent approval status, created by, created date.
- Booking Snapshot (§54) — service name, service version, duration, price, currency, travel fee, discounts, payment method, cancellation terms, rescheduling terms, recording settings, location, organisation involvement, commission rules, applicable platform rules, admin exceptions.
- Booking Request (§56) — "A booking request may use the Booking record in a requested state." Request-specific fields: request expiry, tutor response deadline, payment authorisation, temporary calendar reservation, decline reason, withdrawal date.
- Financial: Financial Account (§104), Ledger Entry (§106, every financial movement creates an immutable entry), Payment (§109), Payment Allocation (§110), Processor Transaction (§111), Payout (§112), Commission Entry (§113), Commission Statement (§114), Payment Plan (§115), Credit (§116), Pricing Breakdown / Component / Adjustment (§101–103).
- Audit and events: Status History (§162), Audit Log (§163) with audit fields (§164), Domain Event (§174) with fields (§175) and consumers (§176), Analytics Event (§177), Notification Event (§135), Notification (§136), Delivery Attempt (§137), Activity Record (§178), Record Version (§165), Webhook Event (§172), Sync Job (§171), Integration Error (§173). Audit remains separate from Status History. No outbox entity appears in this document; doc 07 supplies `audit.outbox_entries`.
- Supporting: Tutor Profile (§34), Tutor Verification (§35), Organisation (§36), Organisation Membership (§37), Tutor–Student Relationship (§39), Tutor–Student Subject Link (§41), Relationship Payment Rules (§42), Service (§44), Service Version (§46, includes response deadline and minimum notice), Saved Location (§31), Consent Record (§143), Permission Grant (§145), Task (§132), Rule and Rule Version (§155–156), Effective Rule Snapshot (§161).

Principal cardinalities (§181–189) relevant to package one: one User may have many Role Assignments and may belong to many Family Accounts over time; one Family Account has many Memberships, may contain many Student Profiles, may own many Saved Locations, may have many Tutor–Student Relationships, Payments, Credits and Support Cases; one Student User has one primary Student Profile; one Student Profile has many Subject Sections; one Booking links to one exact Service Version, may create one Lesson, may have one or more Pricing Breakdowns and Adjustments, and may receive one or more Payment Allocations; one Payment may have many Allocations; one Booking may create one or more Commission Entries.

Gaps: no Intended Lesson Request entity, no Tutor Request entity, no calendar-hold entity (only a "temporary calendar reservation" field), and no workspace entity — workspace appears only as a field in at least eight places and is never defined.

## Doc 11 — Core User Journeys (Draft 0.1, 26pp, 16 parts)

Public entry (§2): primary CTA Find a Tutor, secondary Join as a Tutor. Visitors can begin tutor matching without creating an account. The principal public journey serves parents and independent students.

Matching questionnaire (§3): year level, subjects, learning needs, goals, format, availability, budget, tutor experience preferences, teaching-style preferences, language and cultural preferences, exclusions, ranked matching priorities. Multiple subjects allowed. Student name and full account details come after the initial matching questions.

Matching results (§4): a matching summary then a ranked shortlist of several tutors. "Studdy should not claim that one tutor is objectively the single best option."

Account-creation point (§5): an account is required before viewing full tutor profiles, exact availability, saving favourites, requesting a lesson, booking a trial or viewing tutor locations. Questionnaire responses carry into account creation.

Paid lesson requests (§8), the canonical documented flow — note this is the single-tutor model the brief supersedes: parent selects student, service and time; confirms price and policies; provides or confirms a payment method; Stripe authorises the amount; the selected time becomes temporarily reserved; the tutor receives the request; the tutor accepts or declines; if accepted the booking becomes confirmed and payment proceeds; if declined, withdrawn or expired the authorisation is released; Studdy suggests alternative tutors after the original request ends. Required copy: "You will only be charged if the tutor accepts your request."

§11 "One Active Request Per Intended Lesson" states that parents should not send competing requests to multiple tutors for the same intended lesson time, and that Studdy may offer alternative tutors only after the current request is declined, withdrawn or expired, to avoid unnecessary calendar blocking and conflicting acceptances. The brief and doc 04 override this.

Minimum booking notice (§12): tutor-set, may differ by subject, service, trial versus standard, online versus in-person, new versus existing student, subject to platform limits.

Tutor response windows (§13): "A potential model is: more than 48 hours before the lesson, up to 24 hours to respond; between 24 and 48 hours, a shorter response period; short-notice request, accelerated response period; request inside the tutor's minimum-notice setting, unavailable unless explicitly supported. The exact response rules should remain admin-configurable."

Pending calendar reservation (§14): a pending request temporarily blocks the selected time in the tutor's calendar and remains reserved until accepted, declined, withdrawn or automatically expired. Tutors should not silently release the time while leaving the parent's request active.

Tutor decline (§15): may decline without a parent-visible reason. Quick reasons: time no longer available, not the right subject match, capacity reached, travel or location issue, service unavailable, other. Private admin-only reason supported.

Tutor responsiveness (§16): repeated ignoring or expiry may reduce recommendation visibility through reliability tracking, warning, opportunity to correct availability, consideration of exceptions, reduced visibility, admin review. "One missed request should not create a severe penalty."

Withdrawal (§10): releases reserved tutor time, releases payment authorisation, notifies the tutor, updates booking history; no cancellation fee while pending.

Direct-payment statuses (§36): Payment due, Parent says paid, Confirmed by tutor, Partially paid, Overdue, Disputed, Waived, Refunded, Admin corrected. Commission calculation timing (§37): estimated at request created; reserved at tutor accepts; chargeable at lesson completed under policy; adjusted on cancellation, refund, dispute or amendment; owed when included in a tutor commission statement; paid when collected from the tutor. A declined or withdrawn request should not result in commission owed.

Numeric defaults given: direct-payment deadline 48 hours; dispute window 48 hours; follow-up deadline 24 hours; recurring pause protection two weeks (§22).

No independent-student registration journey is documented anywhere in this document.

## Doc 12 — Functional Capabilities and System Modules (Draft 0.1, 40pp, 33 modules, 148 clauses)

Architectural principles: a central student record; modular architecture; configurable operations; an inheritance chain of global, country or region, platform programme, organisation, tutor, service, booking exception; locked platform rules; traceability; international readiness with New Zealand first; analytics events from day one; minimum necessary access.

Modules: One Public Website and Discovery; Two Identity, Accounts and Roles; Three Family and Student Management; Four Curriculum, Skills and Progress; Five Tutor Onboarding and Verification; Six Tutor Profiles and Services; Seven Matching and Recommendations; Eight Tutor Codes, Invitations and Referrals; Nine Availability and Capacity; Ten Booking Management; Eleven Group Lessons and Cohorts; Twelve Payments, Payouts and Commission; Thirteen Packages and Pricing; Fourteen Lesson Delivery; Fifteen AI Lesson Summaries; Sixteen Homework and Student Actions; Seventeen Goals and Concerns; Eighteen Assessments; Nineteen Resource Marketplace; Twenty Ratings and Reviews; Twenty-One Messaging and Notifications; Twenty-Two Support and Case Management; Twenty-Three Organisations and Schools; Twenty-Four Platform Owner and Manager Administration; Twenty-Five Manager Tasks and Workflow; Twenty-Six Rules and Configuration; Twenty-Seven Audit, Security and Data Protection; Twenty-Eight Reporting and Analytics; Twenty-Nine Data Export; Thirty Integrations; Thirty-One Shared Platform Services; Thirty-Two Future Capabilities; Thirty-Three Capability Design Principles.

Modules touched by the first package: One, Two, Three, Six, Seven, Nine, Ten, Twelve, Twenty-One, Twenty-Six, Twenty-Seven, Twenty-Eight, Thirty, Thirty-One, with Five partial (Join as a Tutor entry only) and Twenty-Four partial (role scaffolding).

Public pages (§3): homepage; how Studdy works; tutor discovery; public tutor profiles; tutor application entry; organisation information; trust and safety information; pricing explanation; resource marketplace discovery; help centre; legal and privacy pages.

Public tutor profile fields (§5): tutor name, profile photo, subjects, year levels, general pricing, general availability, rating, verification indicators, short biography, teaching-style summary, trial availability, organisation affiliation. Exact availability and full details require sign-in. Doc 14 §13 gives a narrower, privacy-conservative list — prefer that one.

Tutor status enum (§19): Applicant, Under review, More information required, Approved, Active, Unlisted, Restricted, Suspended, Departed. Visibility states (§23): Public and recommended, Public with reduced visibility, Recommendations paused, Unlisted, Existing students only, Fully suspended.

Booking status enum (§36–37): Draft, Requested, Awaiting payment, Awaiting tutor acceptance, Accepted, Confirmed, Declined, Withdrawn, Expired, Rescheduled, Cancelled, Completed, Disputed — singular tutor acceptance, parent withdrawal and request expiry. No fan-out semantics.

Payments (§46–47): marketplace-sourced relationships should use Stripe by default; tutor-brought relationships may use direct payment. Stripe parent payment, tutor payout, Studdy fee deduction.

Group lessons (§40): support group lessons from the beginning even if public launch occurs later.

Online lessons (§58): should be recorded and transcribed by default, subject to approved exceptions.

Roles (§6), nine: Tutor, Parent or guardian, Dependent student, Independent student, Supporter, Organisation member, Organisation manager, Platform Manager, Platform Owner.

## Doc 13 — Vision and Product Principles (Draft 0.1, 10pp)

Studdy is a multi-tutor platform primarily for independent tutors. Tagline: "The platform for better tutoring". Core principle: better tutor visibility leads to better student support, which leads to greater parent trust. Three user groups: tutors as the primary operational users, parents and guardians, students.

Positioning: a tutor operating system, a curated tutor network (apply, interviewed, verified, approved), and a trusted tutor marketplace.

Booking flow as described (§12) is single-tutor and sequential: parent or independent student requests a lesson; tutor reviews the student's needs; tutor accepts or declines; booking becomes confirmed; if declined, Studdy suggests alternative tutors. Superseded by the brief.

Payment model as described (§13) is direct-pay plus commission invoice: parent pays the tutor directly; Studdy records the charge and payment status; Studdy calculates commission from completed or chargeable bookings; Studdy charges the tutor separately for commission owed. Superseded by the brief and doc 12 §46. This section also names a specific personal bank account and open-banking provider — nothing bank-specific may be hard-coded.

Qualification verification labels (§10): self-declared, experience verified, qualification verified, Studdy reviewed. False or misleading qualifications are unacceptable.

Recordings (§7): standard for online lessons subject to appropriate consent and privacy controls; raw recordings retained roughly three days.

Permanent IDs (§13) for every parent, student, family, tutor, booking and payment. Admin-configurable areas (§16) include homepage content. Ten product design principles (p10) including trust through transparency, human review of AI, fair tutor opportunity.

Two cautions: this document contains single-operator framing ("the current personal tutoring operation") inside a document declaring Studdy multi-tutor, and both doc 13 and doc 14 state the name is "pronounced Tutor-in", which reads as a copy artefact from a previous product name and must never reach a public page.

## Doc 14 — Tutor Discovery and Public Website Direction (Draft 0.1, 12pp)

"The redesign should be treated as a product repositioning rather than a visual refresh."

Audiences: primary parents, guardians and independent students; secondary independent tutors. Primary CTA Find a Tutor; secondary Join as a Tutor, which should remain clearly visible throughout the homepage.

Brand direction (§3): purple should remain part of the Studdy identity. No hex values, no type scale, no logo asset. A list of feelings to avoid is given.

Hero (§4): recommended headline "Find the right tutor. Understand every step of their progress." Supporting message: "Studdy helps families find trusted tutors and gives tutors, parents and students a clearer view of lessons, homework and learning progress." Equal weight to finding a tutor and understanding progress.

Homepage structure (§5), nine sections: hero; how finding a tutor works (seven steps); why families can trust Studdy; tutor discovery preview; student progress; tutor operating tools, which should appear relatively high, with the message "Join for free. Studdy earns when tutors earn."; resources and assessments; pricing transparency, with "Tutoring from $30 per hour / Tutors set their own rates"; final call to action with primary "Find the right tutor" and secondary "Join the tutor network".

Trust section bullets (§5, section 3): tutors are interviewed and approved; identity and claimed qualifications are verified where applicable; profiles show ratings, experience and lesson history; pricing is visible; progress, homework and lesson summaries remain organised; booking requests require tutor acceptance by default; parents can report concerns and receive support.

Homepage tutor cards (§5, section 4): profile photo, first name, subjects, year levels, online or in-person format, starting price, general availability status, overall rating, verification indicators, lesson count, response time. "Where there are not enough real tutor profiles, Studdy may show clearly labelled example profiles. Example profiles must never be presented as real tutors."

Questionnaire (§6): fourteen inputs, short enough to complete without progress saving in v1, supports multiple subjects, asks the student's name after the first few matching questions.

Tutor-type preferences (§9) allow parent preferences on tutor age range, gender, and cultural or language background, handled as optional matching preferences rather than quality-ranking factors. No document addresses New Zealand Human Rights Act 1993 exposure; hold these fields out of schema pending a legal decision.

Recommendation results (§11): a ranked shortlist with a light, lay-readable reason per result ("Matches your preferred times", "New tutor with strong availability"). Detailed ranking logic must not be exposed.

New-tutor fairness (§12): visibility boost, rotating exposure, suitability-first ranking, a separate "New to Studdy" label. Must never override suitability or parent preferences.

Public tutor profile, signed out (§13): profile photo, first name, subjects, year levels, teaching approach, starting price, general availability status, overall rating, verification indicators, completed lesson count, introductory video, "What a lesson with me is like". Exact availability and full details require sign-in. Availability labels: "Available this week", "Accepting new students", "Limited availability", "Existing students only", "Waiting list available".

Favourites (§15): profiles may show an aggregate such as "12 families have saved this tutor". Whether this appears signed-out is unstated and it leaks in an empty marketplace.

Public navigation (§18): Find a Tutor, How It Works, For Tutors, Resources, Assessments, About Studdy, Sign In. "The navigation should remain simple and avoid exposing every future feature before it is available."

Admin-editable content (§19): homepage headings, supporting copy, CTAs, pricing statement, featured tutors, tutor-profile order, trust indicators, homepage announcements, example content, FAQs, footer links, notification banners. Major layout and structural changes may still require code.

Redesign principles (§20) include showing value before requiring sign-in, preserving parent choice, and keeping future features honest: "Features that are planned but not yet available should be clearly identified or omitted from live claims."

## Cross-pack gaps a builder will hit

No document anywhere specifies: a URL path or route slug; any colour value, font family, radius, shadow, breakpoint, motion duration or z-index value; a pinned version for Node, pnpm, Turborepo, Next.js, TypeScript, Tailwind, Radix, Drizzle, Vitest, Playwright, Supabase CLI or Zod; a branch naming or commit convention; the npm package scope (doc 05's `@Studdy` is invalid casing); a Tailwind-to-token integration mechanism; an RLS test harness design (how tests assume a role and set `auth.uid()`); how `record_version` optimistic concurrency is implemented with Drizzle; the mechanism for the global human-readable reference sequence; a complete capability catalogue or role_definitions seed set; an enumerated workspace code list or where "last valid workspace" is persisted; default currency, country or locale as a configured value rather than an example; retention periods for the eleven categories that require them; hold duration, request expiry defaults, or the fan-out cap as stored configuration rather than a constant; an observability provider; an email provider; internal structure for the `configuration`, `observability` and `permissions` packages; or the boundary between `packages/permissions`, the `permissions` schema and the domain permission engine.
