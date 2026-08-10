# Implementation Blueprint and Repository Plan

> **Source document 05 of the Studdy planning pack.**
> Extracted verbatim from `05Implementation Blueprint and Repository....pdf` on 7 August 2026.
>
> This is PRESERVED SOURCE MATERIAL. Do not edit it to match later
> decisions — later decisions are recorded in `docs/decisions/` and
> override this document where noted in `docs/source-material/README.md`.
>
> Extraction is automated text extraction from a PDF: wording and section
> numbering are faithful, but original page layout, tables and bullet
> indentation may be flattened. Consult the PDF where exact layout matters.

---

<!-- page 1 -->

Studdy
Implementation Blueprint
and

Repository

Plan
Version 1.0

Status: Approved
Product:

Studdy

Tagline:

The

platform

for

better

tutoring.

Date:

31

July

2026

A practical repository, development and implementation plan for building Studdy on its
approved

architecture.

<!-- page 2 -->

1. Purpose
   This document translates Studdy’s approved product and technical architecture into an operational implementation blueprint. It defines how the new repository should be created, how the codebase should be organised, which tools should be used, how development should be sequenced, and which responsibilities belong to Fable, GitHub, external providers and the product owner.
   ● Repository ownership and structure ● Development toolchain ● Next.js application organisation ● Design-system foundation ● Local and cloud environments ● Domain and database boundaries ● Validation, errors and permissions ● Migrations, seed data and testing ● Integration adapters and configuration ● Pull requests, bootstrap and Fable handoff
2. Approved implementation principles
   Principle Approved direction New repository, clean foundation Studdy will be built in a new repository under the darshabloom GitHub account. The existing DarshaTutor repository remains unchanged as a reference, migration source and source of selectively reusable code.
   Lightweight monorepo Studdy will begin as one deployable Next.js application inside a lightweight monorepo. Package boundaries should support long-term growth without introducing unnecessary service complexity.
   Vertical slices Product development should proceed through complete end-to-end slices containing schema, permissions, domain logic, interface, tests, audit and observability.
   Server authority The browser may request actions, but all consequential operations must be validated and completed through trusted server-side commands.
   Explicit boundaries Domain modules, database repositories, integration adapters, permissions and design components must expose small deliberate public APIs.
   Generated code is reviewed code Fable and AI tools may assist, but generated output must be reviewed, tested and refactored into approved boundaries before it is trusted.
3. Repository ownership and source strategy
   3.1 New GitHub repository
   github.com/darshabloom/Studdy
   The repository should initially be private. It should have issues and pull requests enabled, branch protection, secret scanning where available, automated dependency updates and no production secrets committed to files.
   3.2 Existing DarshaTutor repository
   github.com/TreeToppr/darsha-tutoring

<!-- page 3 -->

The old repository should remain intact. Existing features and code should be assessed individually as Reuse, Adapt, Rebuild or Retire. Code should be copied deliberately only after review; the new repository must not inherit old secrets, weak architecture or accidental dependencies. 4. Monorepo structure
Studdy/ apps/ web/ packages/ configuration/ database/ design-system/ domain/ integrations/ observability/ permissions/ testing/ infrastructure/ inngest/ scripts/ supabase/ vercel/ migration/ exceptions/ mappings/ reports/ source-analysis/ transforms/ validation/ documentation/ architecture/ decisions/ implementation/ operations/ product/ .github/ workflows/ CODEOWNERS
This structure keeps the application simple while separating shared business rules, database code, permissions, integrations, configuration, testing and visual components. Additional deployed applications should be introduced only when there is a genuine operational need. 5. Toolchain and root commands
● pnpm for package management ● Turborepo for workspace task coordination ● TypeScript in strict mode ● ESLint for code quality and import boundaries ● Prettier for formatting ● Vitest for unit, domain and integration tests ● Playwright for end-to-end tests ● Node version locking
pnpm dev pnpm build pnpm typecheck pnpm lint pnpm test pnpm test:integration pnpm test:e2e pnpm db:generate

<!-- page 4 -->

pnpm db:migrate pnpm db:seed pnpm db:reset 6. Next.js application structure
apps/web/src/app/ (public)/ page.tsx find-a-tutor/ tutors/ how-it-works/ for-tutors/ trust-and-safety/ pricing/ help/ (auth)/ sign-in/ sign-up/ verify/ reset-password/ mfa/ parent/ tutor/ student/ organisation/ manager/ owner/ api/ webhooks/ callbacks/ downloads/ integrations/
The application should use the App Router, Server Components by default, route-group layouts and server-side workspace protection. Entering a protected URL must never be sufficient to gain access.
6.1 Workspace resolution 1. Load the signed-in Supabase identity 2. Resolve the linked Studdy User 3. Confirm the account and role assignment are active 4. Resolve the requested or last valid workspace 5. Recalculate restrictions and authentication assurance 6. Render only the pages and actions authorised for that workspace 7. Design-system foundation
Studdy should use Tailwind CSS with Radix primitives and a dedicated Studdy-owned design-system package. Radix provides accessible low-level behaviour; the visible product should use Studdy components and tokens rather than an unmodified component-library appearance.
packages/design-system/src/ tokens/ colours.ts typography.ts spacing.ts radii.ts shadows.ts breakpoints.ts primitives/ components/ layouts/ styles/
● Buttons and form fields

<!-- page 5 -->

● Status badges and alerts ● Tutor, student and booking cards ● Tables and dashboard widgets ● Empty, loading, error and restricted states ● Public and workspace layouts ● Responsive and accessibility patterns
Fable may generate layouts and components, but its output must be translated into these shared tokens, components and accessibility patterns. It must not create a disconnected second design system. 8. Environment model and local development
Environment Purpose Local Supabase CLI, Docker, local PostgreSQL, Auth and Storage for everyday development and automated tests. Development Shared cloud integration environment with development Stripe, Inngest and email services. Staging Production-like release testing, migration rehearsal and user acceptance testing using separate credentials. Production Live users, payments and restricted approved releases only.
8.1 Expected local setup
pnpm install pnpm supabase:start pnpm db:migrate pnpm db:seed pnpm dev
A later pnpm setup command may combine these steps. Local and test data must be synthetic or anonymised; copied live student and family data is prohibited. 9. Domain package organisation
packages/domain/src/ identity/ families/ students/ tutors/ services/ discovery/ availability/ bookings/ payments/ lessons/ learning/ notifications/ support/ platform/
Each module should contain its own commands, queries, rules, events, types, errors and internal implementation. It should expose only a small public API through index.ts or explicit package exports.
9.1 Command responsibilities ● Accept validated input ● Identify the actor and active workspace ● Evaluate permissions ● Load authoritative current state ● Apply business rules and status preconditions ● Use a transaction where required

<!-- page 6 -->

● Write audit and transition history ● Emit domain events and outbox records ● Return a stable typed result
9.2 Query responsibilities Queries read information without changing business state, but must still enforce record-level visibility, scope, sensitivity and relationship rules.
9.3 Public API rule
Allowed: import { confirmBooking, getBookingDetails } from '@Studdy/domain/bookings' Not allowed: import { calculateInternalHoldState } from '@Studdy/domain/bookings/internal/hold-engine' 10. Database access and schema ownership
Direct Drizzle access should be limited to deliberate database boundaries. The standard flow is:
Page or server action -> domain command or query -> repository interface -> Drizzle implementation -> PostgreSQL
The domain package defines repository contracts. The database package implements them. Complex commands use one transaction-scoped repository set so all related records commit or roll back together.
10.1 Schema organisation
packages/database/src/schema/ identity/ families/ students/ tutors/ services/ bookings/ payments/ lessons/ learning/ support/ platform/ shared/ index.ts
Every table should have a clear owning module. Cross-module foreign keys are expected but must be reviewed for ownership, deletion and archival behaviour, retention, permissions and transaction boundaries. Generic shared records should be used only for genuinely reusable capabilities such as File, Comment, Task, Record Version and Status History. 11. Runtime validation and typed boundaries
Zod should validate all external and important module boundaries, including:
● Form submissions and server-action input ● Route handlers and callbacks ● Webhook payloads after signature verification ● Environment variables ● Typed platform configuration ● Integration responses where practical ● Versioned domain-event payloads ● DarshaTutor migration input
Database row schemas should not be reused directly as public form schemas. Invalid migration records must enter an exception queue rather than being imported silently.

<!-- page 7 -->

12. Command results and business errors
    type CommandResult<T> = | { success: true; value: T; correlationId: string } | { success: false error: { code: BusinessErrorCode message: string retryable: boolean correlationId: string fieldErrors?: Record<string, string[]> details?: Record<string, unknown> } }
    ● VALIDATION_FAILED ● AUTHENTICATION_REQUIRED ● MFA_REQUIRED ● PERMISSION_DENIED ● RECORD_NOT_FOUND ● INVALID_TRANSITION ● BUSINESS_RULE_BLOCKED ● RESOURCE_CONFLICT ● RATE_LIMITED ● PROVIDER_UNAVAILABLE ● TEMPORARY_FAILURE ● DATA_INCONSISTENCY ● INTERNAL_ERROR
    Stable codes support tests, logs and interface behaviour. User wording may vary by context. Internal stack traces, SQL errors, provider responses and sensitive rules must not be exposed to users.
13. Shared request context
    RequestContext correlationId requestId authUserId StuddyUserId activeWorkspace roleAssignments authenticationAssurance locale timeZone environment
    The request context resolves identity and workspace once per protected request but does not replace fresh authoritative loading inside commands. Role removal, suspension, relationship closure and temporary-grant expiry must take effect immediately.
14. Package dependency direction
    apps/web -> domain -> permissions -> configuration -> design-system -> database -> integrations -> observability database implements domain repository interfaces integrations implement domain provider interfaces

<!-- page 8 -->

The domain package must not import Next.js, React, Tailwind, Radix, Supabase clients, Drizzle implementations, Stripe, Inngest, provider SDKs or Fable-generated components. Package export maps, TypeScript references, ESLint restrictions and dependency-graph checks should enforce these rules. 15. Shared identiﬁers, money and time
15.1 Branded identiﬁers
type BookingId = string & { readonly __brand: 'BookingId' } type StudentId = string & { readonly __brand: 'StudentId' }
Identifiers should be created only through validated constructors. Internal UUIDs and human-readable references such as BOOK-00010482 remain distinct.
15.2 Money
interface Money { amountMinor: bigint currency: CurrencyCode } NZD $40.50 -> 4050
Authoritative financial calculations must not use floating-point numbers. Shared operations must validate currencies and apply explicit rounding rules. Database fields should normally use amount_minor bigint and currency_code char(3).
15.3 Date and time Absolute events use UTC timestamps. Scheduled lessons preserve UTC occurrence, local date, local time and IANA time zone. Recurring lessons preserve local weekday and time so a lesson intended for 4:00 pm Auckland remains at 4:00 pm through daylight-saving changes. 16. Database migrations
Migrations must be sequential, version-controlled and immutable once applied to a shared environment. Corrections use new migrations rather than editing history.
● Schema changes ● Indexes and constraints ● Row Level Security ● Functions and triggers ● Views ● Reference data ● Controlled transformations
packages/database/migrations/ generated/ reviewed-sql/ rls/ functions/ triggers/ constraints/ transformations/
Migration metadata should record purpose, module, dependencies, expected impact, locking considerations, validation queries and recovery strategy. The pipeline should verify sequence, checksum, environment and compatibility before applying changes. 17. Deterministic seed data
Seed data should use named, repeatable scenarios rather than one large random script.

<!-- page 9 -->

● New family searching for a tutor ● Tutor applicant under review ● Approved tutor with services ● Multi-tutor request awaiting responses ● First booking awaiting payment ● Active recurring student ● Overdue direct payment ● Payment dispute ● Lesson awaiting summary approval ● Restricted tutor ● Manager reviewing a case
pnpm db:seed pnpm db:seed --scenario approved-tutor pnpm db:seed --scenario payment-dispute pnpm db:reset
Scenarios should include edge cases for visual review, such as long names, empty states, dense calendars, many students, restricted access and failed payments. 18. Vertical-slice delivery plan
Slice Scope Slice 0: Platform foundation Repository, environments, authentication connection, Studdy User identity, request context, logging, errors, configuration, feature flags, design-system foundation, permission and audit scaffolding. Slice 1: Family and student foundation Parent account, Family Account, student creation, student profile, Parent workspace shell, permissions and audit history. Slice 2: Tutor onboarding Tutor application, review workflow, approval, tutor profile, verification and manager review interface. Slice 3: Services and availability Services, versions, pricing, availability, capacity, publication review and public tutor profile. Slice 4: Tutor discovery Matching questionnaire, search, recommendations, public results, favourites and account-creation handover. Slice 5: Booking request Intended Lesson Request, multi-tutor requests, tutor response, holds, expiry and parent selection. Slice 6: Payment and confirmation Stripe test integration, payment confirmation, booking confirmation, ledger, commission and refund foundations. Slice 7: Lesson and learning record Lesson completion, summary drafting, tutor approval, homework, goals, progress and parent visibility. Slice 8: Recurring tutoring Recurring series, future generation, payment holds, slot protection, pause and end flows. Slice 9: Operations and support Cases, restrictions, impersonation, Platform Health, audit review and incident handling. 19. Generated code and documentation policy
19.1 Generated code Generated code should be limited to predictable, reviewable areas such as Drizzle migrations, Supabase types, API clients, test fixtures and selected scaffolding. Core business logic should remain maintained and reviewed as ordinary code.
● Authentication and permissions ● Row Level Security ● Payments and ledger logic ● Booking transactions ● Encryption and retention

<!-- page 10 -->

● Safeguarding and file access ● Webhooks and production deployment
AI-assisted changes in these areas require particularly close review.
19.2 Module READMEs ● Purpose and owned records ● Public commands, queries and events ● Allowed and prohibited dependencies ● Permission considerations ● Transaction boundaries ● Testing expectations ● Known future capabilities
19.3 Architecture Decision Records
documentation/decisions/ ADR-0001-use-supabase-auth.md ADR-0002-use-drizzle.md ADR-0003-use-inngest.md ADR-0004-use-transactional-outbox.md ADR-0005-use-lightweight-monorepo.md 20. Application state, forms and caching
20.1 State strategy ● Server Components for authoritative page data ● Server actions for commands ● URL state for filters, tabs, search and pagination ● Local React state for temporary interface behaviour ● Dedicated client stores only for complex multi-step experiences ● Database-backed drafts for long or consequential workflows
20.2 Form architecture Simple forms may use native server actions. React Hook Form should be used for conditional, repeating, multi-step, file-upload or highly interactive forms. Shared Zod schemas, accessible components and consistent errors should underpin both.
20.3 Query and caching Next.js server-side loading is the default. TanStack Query should be used only where live refetching, optimistic updates or complex synchronisation provides clear value, such as calendars, messages, file processing, Platform Health and manager queues. Consequential state should not use optimistic confirmation. 21. Authentication implementation sequence 7. Supabase Auth connection 8. Studdy User creation and identity linking 9. Role assignments 10. Active workspace resolution 11. Session and device history 12. Multi-factor enforcement 13. Recovery and privileged step-up authentication
Identity linking must be idempotent. Roles must follow the approved journey, not merely the page visited. Multi-factor authentication is mandatory for the Platform Owner and privileged managers, and recent step-up authentication is required for high-risk actions.

<!-- page 11 -->

22. Permission engine
    Permissions should be evaluated by a dedicated service that returns both a decision and an explanation. It should consider role, workspace, ownership, family and tutor relationships, subject and organisation scope, temporary grants, restrictions, sensitivity, authentication assurance, jurisdiction, retention and legal hold.
    ● Allowed or denied ● Capability evaluated ● Sources granting access ● Restrictions and limits ● Required authentication ● User-safe explanation ● Audit requirement
    Permission evaluation must occur at route, query or command, record, database RLS, file, export and high-risk confirmation layers. One successful layer must not bypass the others.
23. Audit foundation
    The audit system must be built in Slice 0 before real business workflows. Consequential audit records should be written in the same transaction as the business change wherever possible.
    ● Security audit ● Business audit ● Financial audit ● Sensitive-access audit
    The immutable audit log remains separate from user-facing activity timelines. Audit events should include actor, role, workspace, action, entity, timestamps, request and correlation IDs, outcome, reason, original and resulting values, permission decision, authentication assurance, impersonation and environment, with sensitive values minimised or redacted.
24. Testing architecture
    packages/testing/src/ builders/ fixtures/ scenarios/ repositories/ providers/ permissions/ assertions/
    Unit tests: Fast isolated calculations and rules.
    Domain tests: Commands and workflows using in-memory repositories and fake providers.
    Database integration tests: Drizzle repositories, transactions, locks, constraints, RLS and migrations.
    Adapter tests: Provider mapping, webhook handling and error translation.
    End-to-end tests: Complete user journeys through Playwright.
    Tests must be isolated and order-independent. Shared builders should create valid defaults while allowing each test to override only the relevant facts.
25. Integration adapters
    packages/integrations/src/ stripe/

<!-- page 12 -->

email/ calendar/ ai/ file-scanning/ recording/
● SDK configuration and authentication ● Request and response translation ● Runtime validation ● Timeout and retry classification ● Error redaction and mapping ● External identifiers and idempotency ● Webhook verification and deduplication ● Health checks and test doubles
The rest of Studdy should receive stable internal contracts rather than raw provider responses. Provider replacement should require a new adapter, contract tests and controlled rollout, not domain rewrites. 26. Environment, platform conﬁguration and feature ﬂags
System Purpose Examples Environment variables Deployment infrastructure and secrets
DATABASE_URL, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY Typed platform configuration Owner-managed business and product rules
Commission rate, booking limits, retention days, branding Feature flags Rollout and emergency enablement
instant_booking, organisation_workspace, resource_marketplace 27. Pull requests and code review
● No direct pushes to protected branches ● Passing automated checks before merge ● At least one review for ordinary changes ● Explicit owner review for sensitive areas ● CODEOWNERS for migrations, permissions, payments and infrastructure ● Documented accelerated process for genuine emergency fixes
27.1 Required checks ● Install and lockfile validation ● Type checking ● Linting and formatting ● Unit and domain tests ● Database migration validation ● Permission and RLS tests ● Application build ● Dependency and secret scanning ● Package-boundary checks 28. Controlled repository bootstrap
No major product feature should be merged before the bootstrap foundation is complete.

1. Create repository — Create the private darshabloom/Studdy repository and preserve the old repository unchanged.

<!-- page 13 -->

2. Initialise monorepo — Create pnpm, Turborepo, Next.js, package skeletons, infrastructure, migration and documentation directories.
3. Configure standards — Strict TypeScript, ESLint, Prettier, export maps, import boundaries, root scripts, Node version and safe ignore rules.
4. Configure local Supabase — Local database, Auth, Storage, migration runner, seeds and reset commands.
5. Create application shell — Public, auth, parent, tutor, student, manager and owner layouts with accessible placeholder navigation.
6. Create core contracts — IDs, Money, time, command results, errors, request context, repository and provider interfaces, permission decisions, audit, events and outbox.
7. Establish testing — Vitest, Playwright, testing package, fake providers, in-memory repositories and smoke tests.
8. Add CI and branch safety — Typecheck, lint, format, tests, build, scans and package-boundary workflows, then configure branch protection manually.
9. Add documentation — Root README, local setup, repository map, contribution, migration, package README and ADR templates.
10. Review bootstrap — Verify clean clone, local application, Supabase reset, migration, seed, tests, preview deployment and absence of production secrets.
11. Fable implementation handoff
    29.1 Primary goal Create the initial Studdy repository and application foundation. Do not build the full marketplace during the bootstrap. The first handoff should produce a working, tested and documented repository ready for vertical-slice development.
    29.2 Fable may generate ● Monorepo and Next.js scaffolding ● Package skeletons and TypeScript configuration ● pnpm and Turborepo setup ● ESLint, Prettier, Tailwind and Radix foundation ● Design-system package skeleton ● Route layouts and placeholder pages ● Environment schemas ● Testing setup and workflow drafts ● Local Supabase configuration and seed framework ● Repository and provider-interface scaffolding ● Command-result, request-context, permission and audit scaffolding ● Repository documentation and ADR drafts
    29.3 Darsha controls in GitHub ● Repository creation and visibility ● Branch protection and collaborator access ● Production environment approvals ● CODEOWNERS ownership ● Production secrets and deployment permissions ● Final merge approval for sensitive code
    29.4 External account setup ● Supabase development, staging and production projects

<!-- page 14 -->

● Vercel project, environments and domain ● Stripe Connect, credentials, webhooks and payout settings ● Inngest environments and keys ● Email provider ● Monitoring provider such as Sentry ● Later AI, scanning, recording, transcription and calendar providers
29.5 Fable must not do automatically ● Create or retain production secrets ● Place service-role keys in browser code ● Connect preview deployments to production data ● Approve its own security-sensitive changes ● Design RLS without review ● Perform live financial corrections ● Edit production data manually ● Create undocumented migrations ● Change payout details or privileged access ● Disable security controls ● Decide legal, retention or safeguarding rules ● Copy live student data into development ● Infer permissions from interface visibility 30. Bootstrap completion criteria
● A new developer can clone and run the repository ● Dependencies install without manual repair ● The Next.js application runs locally ● Local Supabase starts and resets correctly ● A migration and named seed scenario succeed ● Unit and smoke tests execute ● GitHub checks pass ● Package boundaries are enforced ● Preview deployments use safe development configuration ● No production credentials exist in the repository 31. Final approved repository map
Studdy/ apps/web packages/configuration packages/database packages/design-system packages/domain packages/integrations packages/observability packages/permissions packages/testing infrastructure/inngest infrastructure/scripts infrastructure/supabase infrastructure/vercel migration/exceptions migration/mappings migration/reports migration/source-analysis migration/transforms migration/validation documentation/architecture documentation/decisions documentation/implementation documentation/operations documentation/product

<!-- page 15 -->

.github/workflows .github/CODEOWNERS 32. Next document
The next planning document should be Studdy Product Design System and UX Standards. It will define the visual and interaction rules that the design-system package and Fable-generated screens must follow before detailed product interfaces are built.
