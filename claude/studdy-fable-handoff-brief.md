# Studdy Fable Handoff and Build Brief

Saved verbatim from Darsha/Marina's handoff message of 5 August 2026. This document is authority rank 1 for the Studdy build. See `claude/studdy-implementation-plan.md` for current status.

You are helping me build the real Studdy platform. This is not a disposable prototype, a design-only exercise, a tutor directory, a personal tutoring website or a direct re-skin of the existing DarshaTutor application.

Studdy is a public multi-tutor platform that combines:

- A trusted tutor marketplace
- A tutor operating system
- Booking, availability and payment management
- A continuous student learning record
- Homework, progress, goals and lesson summaries
- Parent and student visibility
- Tutor onboarding, verification and administration

You are expected to produce working front-end and back-end code inside the real Studdy repository, following the supplied product, design, architecture, permission and database documents.

## 1. Documents supplied

Read the complete document pack before beginning implementation. The pack includes:

1. Product Design System and UX Standards
2. Information Architecture and Screen Map
3. User Roles and Permissions
4. MVP Scope and Delivery Plan
5. Implementation Blueprint and Repository Plan
6. Technical Architecture and Security Design
7. Database Schema and Migration Specification
8. Permissions, Roles and Access Control
9. Statuses, State Transitions and Business Rules
10. Data Model and Entity Relationships
11. Core User Journeys
12. Functional Capabilities and System Modules
13. Vision and Product Principles
14. Tutor Discovery and Public Website Direction

Read all documents before making structural decisions. Do not treat every document as equally authoritative where they conflict.

## 2. Authority order

Use this order when interpreting the supplied material:

1. This Fable Handoff and Build Brief
2. Product Design System and UX Standards
3. Information Architecture and Screen Map
4. User Roles and Permissions
5. MVP Scope and Delivery Plan
6. Implementation Blueprint and Repository Plan
7. Technical Architecture and Security Design
8. Database Schema and Migration Specification
9. Permissions, Roles and Access Control
10. Statuses, State Transitions and Business Rules
11. Data Model and Entity Relationships
12. Core User Journeys
13. Functional Capabilities and System Modules
14. Vision and Product Principles
15. Tutor Discovery and Public Website Direction

Later approved specifications override earlier drafts where a material conflict exists. User Roles and Permissions governs intended user experience by role. Permissions, Roles and Access Control governs security, access sources, record visibility, scope, restrictions and capability enforcement.

Do not silently reconcile conflicts. Where a material conflict exists, create:

```
SOURCE CONFLICT IDENTIFIED
Documents involved:
Conflicting instructions:
Higher-authority instruction:
Affected screens or modules:
Recommended interpretation:
Can unrelated work continue:
```

A known example is the request model. Earlier material described one active tutor request for an intended lesson. The later approved MVP and database model allow one Intended Lesson Request to create several separate Tutor Requests, with the parent or independent student selecting one accepted tutor. Follow the later multi-tutor model.

## 3. Product model

Studdy must be multi-tutor from its foundation. The core marketplace model is:

```
Intended Lesson Request
  ├── Tutor Request A
  ├── Tutor Request B
  └── Tutor Request C
```

Do not implement the core model as:

```
Booking Request
  └── tutor_id
```

One underlying tutoring need may be sent to several tutors.

Each tutor must: receive only their own Tutor Request; respond independently; have an independent response status; have an independent temporary calendar hold; remain unable to view competing tutors or responses.

The parent or independent student may: review accepted responses; select one accepted tutor; continue waiting for other responses until the deadline; close remaining requests by selecting a tutor; complete payment for the selected tutor.

When one tutor is selected: only one Booking becomes confirmed; competing Tutor Requests close; unused holds release; other tutors are notified that the request closed; other tutors must not be told who was selected; selection and close-out must be transactional and idempotent.

## 4. Current delivery objective

The first major package is: Multi-tutor marketplace booking foundation.

The required end-to-end journey: Parent or independent student registers → verifies email → creates or uses a Student Profile → selects subject and service need → views several eligible tutors → selects more than one tutor → creates one Intended Lesson Request → linked Tutor Requests are created → tutors respond independently → user selects one accepted tutor → Stripe test payment succeeds → competing requests close → unused holds release → one Booking confirms → appropriate emails and notifications are sent.

The first package must support both parent or guardian registration and independent student registration.

Parent path: Create account → verify email → create or join Family Account → create dependent Student Profile → create Student Subject Section → discover tutors → create Intended Lesson Request → send Tutor Requests → select accepted tutor → pay and confirm.

Independent student path: Create account → verify email → select Independent Student role → create Student Profile → confirm financial responsibility → create Student Subject Section → discover tutors → create Intended Lesson Request → send Tutor Requests → select accepted tutor → pay and confirm.

Do not create two separate duplicated applications for these paths. Shared behaviour should remain shared, while role-specific behaviour comes from: User Role Assignment, active workspace, Family Membership, student independence status, payment authority, permission rules.

## 5. First pull request

The first pull request is `feat/bootstrap-and-product-shell`. It should contain repository bootstrap plus a minimal visible Studdy product shell. It must not attempt the full marketplace journey in the same pull request.

### Repository bootstrap

Create the approved lightweight monorepo:

```
Studdy/
  apps/
    web/
  packages/
    configuration/
    database/
    design-system/
    domain/
    integrations/
    observability/
    permissions/
    testing/
  infrastructure/
    inngest/
    supabase/
    vercel/
  migration/
    exceptions/
    mappings/
    reports/
    source-analysis/
    transforms/
    validation/
  documentation/
    architecture/
    decisions/
    implementation/
    operations/
    product/
  scripts/
  .github/
    workflows/
  CODEOWNERS
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.json
  eslint.config.js
  prettier.config.js
  README.md
```

Configure: Next.js App Router; TypeScript strict mode; pnpm; Turborepo; Tailwind CSS; Radix primitives; Studdy-owned design system; Drizzle ORM; Supabase local development; Vitest; Playwright; ESLint; Prettier; Node version locking; environment-variable validation; GitHub Actions; automated dependency updates; secret scanning where available.

Required root commands: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`, `pnpm supabase:start`, `pnpm supabase:stop`. A later combined command may be added: `pnpm setup`.

### Initial application routes

```
apps/web/src/app/
  (public)/
    page.tsx
    tutors/
    how-it-works/
    for-tutors/
    trust-and-safety/
    pricing/
    help/
  (auth)/
    sign-in/
    sign-up/
    verify/
    reset-password/
    mfa/
  parent/
  tutor/
  student/
  organisation/
  manager/
  owner/
  api/
    webhooks/
    callbacks/
    downloads/
    integrations/
```

Future workspaces may be disabled behind feature flags, but the application must not require structural reorganisation when they are enabled.

### Minimal visible product shell

Create: `/`, `/sign-in`, `/sign-up`, `/verify`, `/parent`, `/tutor`, `/student`.

Homepage foundation: Studdy header; Studdy wordmark or temporary approved logo treatment; hero; Find a Tutor action; Join as a Tutor action; brief trust statement; minimal example tutor preview; minimal student progress preview; footer. The homepage must be production-compatible rather than disposable, but limited enough that effort stays focused on working registration and booking journeys.

Authenticated shells: workspace-aware layout; workspace switcher placeholder; role-specific navigation foundation; account menu; notifications placeholder; loading state; empty state; error state; restricted state; clear Development environment indication.

### Design-system foundation

Create and use real shared tokens and components for: purple and green brand identity; warm neutral surfaces; typography; spacing; radius; shadows; breakpoints; focus styles; semantic information, success, warning, risk and critical states; buttons; form controls; cards; status badges; alerts; loading states; empty states; error states; restricted states; public layouts; workspace layouts. Do not create page-specific styling that bypasses the design-system package. Meet WCAG 2.2 AA as the minimum standard.

### Initial Supabase foundation

Include: local Supabase configuration; development cloud configuration support; permanent Studdy User foundation; authentication identity link foundation; role assignment foundation; workspace resolution; sign-up and sign-in; email-verification handling; protected-route checks; initial Row Level Security policies; synthetic seed users.

Supabase `auth.users` must remain separate from the permanent Studdy User model. Business tables must reference Studdy User IDs rather than depending directly on Supabase Auth IDs.

### Testing foundation

Prove: clean clone installs; application runs locally; local Supabase starts; migrations apply to an empty database; synthetic seeds load; type checking passes; linting passes; unit tests run; integration tests run; one public-page Playwright test; one authentication-route test; one protected-workspace test; GitHub Actions reproduce the checks.

### Excluded from the first pull request

Do not yet implement: full tutor matching questionnaire; full tutor marketplace search; Intended Lesson Requests; Tutor Requests; booking confirmation; Stripe payment; tutor response workflow; calendar reservations; full tutor onboarding; complete dashboards; production deployment; production data. The foundation must support these without significant restructuring.

## 6. Repository and implementation rules

The approved application architecture is a modular monolith: one deployable Next.js application with strict module boundaries.

Standard flow: Page or Server Action → Domain command or query → Repository interface → Database implementation → PostgreSQL.

The domain layer must not import: React, Next.js, Supabase clients, Drizzle implementations, Stripe SDK types, Inngest SDK types, email-provider SDK types, other external provider SDKs. Each domain module exposes a small deliberate public API. Do not allow unrelated modules to reach into internal implementation files.

Consequential operations must remain server-authoritative. The trusted server must: authenticate the user; resolve the permanent Studdy User; resolve the active workspace; evaluate capability and scope; load authoritative current state; apply rules and transition preconditions; lock required records; write changes atomically; write audit and transition history; write a Domain Event; write an outbox entry; commit or roll back completely.

Do not place authoritative business rules in React components. Do not allow client-controlled amounts, status changes, permission decisions or Booking confirmation.

## 7. Database implementation rules

Use the named PostgreSQL schemas defined in the Database Schema and Migration Specification. Do not place ordinary application tables in `public` by default.

Use: PostgreSQL UUID primary keys; permanent human-readable references where specified; restrictive foreign keys; optimistic concurrency; archival rather than casual deletion; versioned rule and service records; immutable approved snapshots; append-only financial history; explicit relationship entities; database-level uniqueness and range constraints.

Use Drizzle for typed schemas, ordinary migrations, standard typed queries. Use reviewed SQL for Row Level Security, functions, triggers, exclusion constraints, complex transactional operations, views, performance-sensitive behaviour.

The repository is the source of truth for database structure. No undocumented manual production schema changes through the Supabase dashboard.

## 8. Permissions and Row Level Security

Use both server-side capability and scope checks and PostgreSQL Row Level Security. Neither replaces the other.

Every table exposed through Supabase must have RLS enabled, an intentional policy, and automated tests. Sensitive tables must be unavailable directly from the browser unless a specific approved policy exists (financial ledger entries, identity-verification evidence, safeguarding records, raw lesson recordings, raw transcripts, payout details, audit events, temporary access grants, webhook receipts).

Test at minimum: parent cannot access another family; tutor cannot access an unrelated student; tutor cannot access an unrelated subject; tutor cannot see competing Tutor Requests; dependent student cannot access family finances; suspended role loses access; expired Temporary Access Grant stops working; manager scope and financial limits are enforced; public tutor views expose approved fields only.

CI should fail if a new exposed table lacks an intentional Row Level Security classification.

## 9. Stripe requirements

Use real Stripe test mode in the first marketplace package. No permanent mocked payment flow as the foundation. Stripe stays behind Studdy-owned adapter interfaces (PaymentProvider, ConnectedAccountProvider, RefundProvider, PayoutProvider). Provider-specific code belongs under `packages/integrations/src/payments/stripe/`. Do not expose Stripe SDK types to the domain layer.

First package supports: Stripe Customer creation; test payment-method collection; Stripe Connect tutor onboarding or seeded test state; Payment Intent or approved equivalent; server-calculated final payment values; payment success; payment failure; full test refund; partial test refund foundation; verified webhooks; idempotent webhook handling; Connect-account state; Provider Payment records; balanced ledger posting; tutor payable; Studdy fee or commission; reconciliation records.

Only the selected tutor receives the confirmed Booking and related payable. Completing test mode does not authorise live payments. Stop for approval before enabling live Stripe mode.

## 10. Email provider

Do not select an email provider permanently without a current comparison of at least three realistic transactional providers (development cost, free allowance, early production pricing, API quality, Next.js support, webhooks, delivery tracking, bounce handling, suppression, domain requirements, local dev support, sandbox mode, New Zealand suitability, lock-in, migration difficulty).

Return an `EMAIL PROVIDER DECISION REQUIRED` block (providers compared; recommended provider; why; development cost; likely early production cost; domain requirements; required account setup; security considerations; limitations; alternative provider; migration difficulty later) and wait for approval before hard-coding the adapter.

The domain depends on a Studdy-owned EmailProvider. Local development supports a safe preview inbox without sending real messages. Development cloud email sends only to an allowlist of test addresses controlled by Darsha. Development messages: clearly marked as Development; never send broadly; record delivery attempts; preserve provider message IDs; support resend and failure testing.

## 11. Supabase environments

Use: Local, Studdy Development, Studdy Staging, Studdy Production. During the first package: use Local immediately; connect a real Studdy Development cloud project.

Local: daily development, migrations, RLS tests, automated tests, synthetic seed scenarios, fast reset. Development cloud: shared test accounts, real email verification, Stripe webhook testing, Vercel previews, cross-device authentication testing. Staging and Production configured later.

Never share credentials, Auth users, Storage buckets or databases between environments. Dangerous commands must fail safely where the target environment is unclear. A reset command must never casually run against Production.

## 12. Test accounts and synthetic data

Synthetic local-only accounts (deterministic, no real inbox): owner@local.Studdy.test, manager@local.Studdy.test, parent.one@local.Studdy.test, parent.two@local.Studdy.test, student.independent@local.Studdy.test, student.dependent@local.Studdy.test, tutor.a@local.Studdy.test, tutor.b@local.Studdy.test, tutor.c@local.Studdy.test, restricted.tutor@local.Studdy.test.

Resettable scenarios: clean_registration, multi_tutor_request_pending, one_tutor_accepted, several_tutors_accepted, payment_required, booking_confirmed, request_expired, calendar_conflict, payment_failed, restricted_tutor, independent_student_booking.

Development cloud accounts use test email addresses controlled by Darsha for: Parent, Independent student, Tutor A, Tutor B, Tutor C, Platform Manager, Platform Owner. Create `documentation/implementation/development-test-accounts.md`. Do not commit passwords, tokens or account-recovery secrets.

Development data must remain synthetic. No real student details, family information, lesson records, payment details, identity documents or tutor-verification evidence.

## 13. Seeded tutors

Use seeded approved tutors for the earliest marketplace implementation, on the real approved domain model rather than front-end-only cards. Each seeded tutor has: permanent User; Tutor role assignment; Tutor Profile; seed or approved-application provenance; verification records; subjects; year levels; published Services; Service Versions; availability rules; capacity rules; Stripe Connect test state; public profile; recommendation eligibility; tutor login.

Example variation: Tutor A (Mathematics, Year 7–10, online, accepting new students, lower price, available soon, new to Studdy); Tutor B (Mathematics and Calculus, Year 10–13, online and in person, higher price, limited availability, more experience); Tutor C (English, Year 7–12, excluded from a Mathematics request).

Seeded tutors preserve `source_type = development_seed`. Where they appear publicly in Development, label them clearly as example tutors. The real tutor application/verification/approval workflow is the next major slice after the booking foundation.

## 14. Existing DarshaTutor repository

Inspect `github.com/TreeToppr/darsha-tutoring` read-only for existing workflows, screens, data, integrations, copy, edge cases, migration needs, reusable code.

Do not: change the old repository; use it as the new foundation; copy it wholesale; copy secrets or environment files; assume old behaviour overrides approved documents; preserve weak architecture because it exists.

Classify each reviewed area REUSE / ADAPT / REBUILD / RETIRE. Maintain: `migration/source-analysis/darshatutor-code-audit.md`, `darshatutor-data-audit.md`, `darshatutor-feature-map.md`, `darshatutor-secret-scan.md`.

Any copied code must be disclosed in the pull request under `LEGACY CODE REUSED` (original file; new destination; classification; changes made; tests added; dependencies retained or removed; security review).

## 15. Git workflow

Small branches and pull requests; no broad direct changes to main. Suggested sequence: feat/bootstrap-and-product-shell → feat/identity-and-authentication → feat/family-and-student-onboarding → feat/public-tutor-discovery → feat/intended-lesson-request → feat/tutor-request-response → feat/stripe-booking-confirmation → feat/multi-tutor-selection.

When GitHub access permits: commit, push, and open the pull request yourself; update it as work progresses. Do not merely return disconnected code snippets when repository access is available. If access is missing, provide exact connection steps.

Each pull request includes: purpose and scope; related documents; routes and modules changed; database migrations; RLS changes; tests; screenshots or recording; mocked or incomplete behaviour; actions required from Darsha; security considerations; migration implications; known limitations; rollback instructions; build-ledger update.

Do not merge a pull request without explicit approval.

## 16. Vercel previews

Create a Vercel preview deployment for every meaningful pull request where practical. Previews: use Development or isolated preview resources; never Production services; clearly display the environment; avoid uncontrolled emails; avoid live payments; use synthetic data; preserve permission testing. Provide the preview link in the pull request completion report.

## 17. Build ledger

Maintain `documentation/implementation/build-ledger.md` using only these status labels: NOT STARTED, DESIGNED, FRONT END COMPLETE, BACK END PARTIAL, MOCKED, INTEGRATED, TESTED, BLOCKED, ACTION REQUIRED FROM DARSHA, DEFERRED, COMPLETE.

Required columns: Capability; Current status; Front end; Back end; Database; Provider integration; Tests; Synthetic data; Known gaps; Action required; Pull request; Evidence; Next step.

A capability is COMPLETE only when: interface works; server command works; data persists; permissions are enforced; error states exist; audit and events exist where applicable; tests pass; no undeclared mock remains; setup is documented; behaviour matches approved product rules.

## 18. Controlled freedom

May decide: component composition; responsive layout; form grouping; loading-skeleton design; empty-state presentation; helper wording; mobile adaptation; drawers versus dialogues; internal component names; test-fixture details; accessibility improvements; technical details within the approved architecture.

May not decide: new business rules; new payment timing; different booking-confirmation rules; different permission scopes; different sensitive-data visibility; a different fundamental data model; a different repository architecture; removal of launch capabilities; whether material price changes require approval; whether financial history may be edited; whether RLS may be omitted; whether future features become launch scope; whether example tutors may be presented as real.

Where a genuine decision is missing, create a `PRODUCT DECISION REQUIRED` block (question; why needed; affected screens or modules; options; recommendation; consequence of each option; can unrelated work continue) and continue unrelated approved work.

## 19. Actions required from Darsha

Use `ACTION REQUIRED FROM DARSHA`, classified REQUIRED NOW / REQUIRED BEFORE STAGING / REQUIRED BEFORE PRODUCTION / OPTIONAL IMPROVEMENT. Every action states: why required; where to go; exact steps; what value or setting to copy; where to place it; whether safe to commit; how to confirm it worked; what happens afterward.

Stop for approval before: creating or materially configuring provider accounts; enabling live payments; enabling production emails; adding production secrets; importing real data; running destructive cloud commands; changing privileged permissions; making material product decisions; starting a new major vertical slice; merging a pull request.

## 20. First complete package definition

Complete only when the multi-tutor marketplace booking journey works end to end in the Studdy Development environment. Required proof spans: identity (both registration paths, email verification, permanent Studdy Users linked, workspaces resolve, protected routes enforced); student records (dependent and independent profiles, Student Subject Section, family and independence rules); tutor marketplace (several eligible seeded tutors, multi-select, one Intended Lesson Request, separate linked Tutor Requests, per-tutor privacy, independent responses); availability and selection (independent holds, conflicting reservations rejected, selection closes competitors transactionally, unused holds release, closed requests cannot later be accepted, duplicate commands do not duplicate the Booking); payment (Stripe test mode, server-side amounts, valid test Connect state, success and safe recoverable failure, idempotent duplicate webhooks, refund foundation); booking and financial records (one confirmed Booking referencing Tutor/Student/Service Version/relationship, Booking Snapshots, Provider Payment record, balanced Ledger Transaction, tutor payable, Studdy fee, posted records not edited); audit, events and communication (Audit Event, Status Transition, booking.confirmed Domain Event, Outbox Entry, idempotent processing, development emails to approved test accounts, local previews, closure notifications without revealing the selected tutor); quality (unit, integration, RLS and e2e tests pass; accessibility on the main journey; desktop and mobile usable; build ledger current; no undeclared mock).

Provide `FIRST PACKAGE COMPLETION EVIDENCE` (development URL; test identities; journey demonstrated; pull requests included; automated tests; database records created; Stripe test evidence; email delivery evidence; RLS evidence; audit and event evidence; known limitations; deferred edge cases; recommended next package).

## 21. Approval checkpoints

May continue automatically through low-risk work inside the active approved pull request: tests; type and lint fixes; accessibility corrections; responsive improvements; approved loading and error states; internal refactoring preserving architecture; defect correction inside approved scope.

Stop before: merging; starting another major slice; creating provider accounts; materially changing architecture or business rules; changing permissions or sensitive-data visibility; adding production secrets; enabling production services; running destructive cloud operations.

Before merge, provide `PULL REQUEST READY FOR APPROVAL` (branch; pull request; purpose; working end-to-end behaviour; tests passing; database changes; permission changes; provider changes; preview deployment; known limitations; mocks remaining; actions required from Darsha; rollback approach; recommended decision).

## 22. Required first response

A structured `HANDOFF ACKNOWLEDGEMENT` before any implementation. (Delivered and recorded in `claude/studdy-implementation-plan.md`.)
