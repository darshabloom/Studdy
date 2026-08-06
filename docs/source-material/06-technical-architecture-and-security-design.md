# Technical Architecture and Security Design

> **Source document 06 of the Studdy planning pack.**
> Extracted verbatim from `06Technical Architecture & Security Design.pdf` on 7 August 2026.
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
Technical Architecture
and

Security

Design

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
A modular, secure and future-ready foundation for the Studdy platform.

<!-- page 2 -->

1. Purpose
   This document defines the approved technical architecture and security design for Studdy. It translates the product vision, data model, permissions, status rules, user journeys, public website direction and MVP delivery plan into a practical implementation foundation. It should guide repository design, database implementation, deployment, security controls, infrastructure setup, integrations, migration, testing and operational readiness. ● Application architecture ● Identity and authentication ● Database and migration strategy ● Server-side business operations ● Permissions and Row Level Security ● Background jobs and domain events ● Sensitive-data isolation ● Content management and branding ● Search, files and observability ● Secrets, deployment and production access ● Backups, encryption and rate limiting ● Retention, testing, provider integrations and incident response
2. Architecture Principles
   APPROVED
   Build the real foundation once Studdy should be built on its intended long-term multi-tutor architecture rather than as a disposable prototype. Features may be disabled at launch, but the core identity, relationship, permission, booking and financial models should remain durable.
   APPROVED
   Modular monolith first Studdy should launch as one deployable application with strict module boundaries. Separate services may be extracted later only where scale, risk or operational need justifies it.
   APPROVED
   Server-authoritative operations The browser may request actions, but the trusted server must validate permissions, rules, status transitions, prices, holds and financial consequences.
   APPROVED
   Minimum necessary access Access must depend on role, active workspace, relationship, scope, sensitivity, restrictions and authentication strength.
   APPROVED
   Historical preservation Bookings, service versions, rules, prices, permissions, financial movements and material edits must preserve history rather than silently rewriting the past.
   APPROVED
   Configuration over hard-coding Branding, feature availability and operational rules that are likely to change should be typed, versioned and owner-configurable.

<!-- page 3 -->

APPROVED
Security in depth Application checks, database policies, storage controls, strong authentication, audit history, observability and operational procedures should reinforce each other.
APPROVED
Provider independence External providers should sit behind Studdy-owned adapter interfaces so they can be replaced without rewriting domain logic. 3. Application Architecture
3.1 One Next.js application Studdy will launch as one Next.js application containing the public website and every authenticated workspace. Separation into additional applications may occur later if justified. ● Public website and tutor discovery ● Authentication ● Parent workspace ● Tutor workspace ● Dependent and independent student workspaces ● Organisation workspace when enabled ● Platform Manager workspace ● Platform Owner workspace ● Shared design system and platform services
3.2 Modular monolith structure
src/ app/ (public)/ (auth)/ parent/ tutor/ student/ manager/ owner/ modules/ identity/ families/ students/ tutors/ services/ discovery/ bookings/ availability/ payments/ lessons/ learning/ notifications/ support/ audit/ platform/ auth/ database/ permissions/ rules/ events/ jobs/

<!-- page 4 -->

integrations/ observability/
Routes, interface components, business logic and database access must remain separated. Each module should expose deliberate commands, queries and events rather than allowing unrelated modules to reach directly into its implementation. 4. Identity and Authentication
4.1 Supabase Auth Supabase Auth will manage login credentials, email verification, password reset, sessions, authentication factors and provider identities.
4.2 Independent Studdy User identity Studdy will maintain its own permanent User record. Business records should reference the Studdy User ID rather than depending directly on Supabase Auth IDs throughout the platform.
Supabase auth.users | | identity-provider link v Studdy users |-- role_assignments |-- parent_profiles |-- tutor_profiles |-- student_profiles |-- family_memberships `-- organisation_memberships
This supports one person holding several roles, students without login, account merging, alternative authentication methods and future provider replacement.
4.3 Multi-factor authentication Multi-factor authentication is mandatory from launch for the Platform Owner and privileged managers. Ordinary users may use optional or risk-triggered multi-factor authentication. ● Viewing identity evidence ● Accessing safeguarding material outside an assigned case ● Changing payout details ● Performing impersonation ● Changing roles or permissions ● Exporting sensitive data ● Issuing major financial adjustments ● Transferring Platform Owner authority The server must track authentication assurance and require recent step-up authentication before high-risk actions. 5. Database Architecture
5.1 New Supabase project and database Studdy should use a clean, newly created Supabase project and database. The existing DarshaTutor database will remain a migration source rather than becoming the foundation of the rebuilt schema.
5.2 Environment separation ● Development Supabase project with synthetic or anonymised data ● Staging project closely matching production structure ● Production project reserved for live data and controlled operations

<!-- page 5 -->

5.3 Drizzle ORM and reviewed SQL Drizzle ORM will be used for typed schema definitions, migrations and ordinary typed queries. Drizzle is free and open source. Handwritten PostgreSQL and reviewed SQL migrations will remain available for complex transactions, Row Level Security, functions, triggers, constraints and performance-sensitive operations.
database/ schema/ identity.ts families.ts students.ts tutors.ts services.ts bookings.ts payments.ts lessons.ts learning.ts support.ts audit.ts sql/ rls/ functions/ triggers/ constraints/ views/ migrations/ seeds/
The repository is the source of truth for database structure. Production changes should not normally be made manually through the Supabase dashboard. 6. Server-Controlled Business Operations
Consequential business actions must run through trusted server-side commands. These include tutor approval, service publication, booking confirmation, recurring arrangements, refunds, credits, financial adjustments, permission changes, restrictions, disputes and sensitive exports.
Authenticate user v Resolve active workspace v Check capability and scope v Load current record state v Apply business rules v Validate transition preconditions v Write records atomically v Write transition and audit history v Publish domain event v Queue follow-up work
6.1 Next.js server actions and route handlers Typed server actions should serve interface-specific commands. Route handlers should serve webhooks, integrations, callbacks, signed downloads and externally callable endpoints. Both should call the same shared domain service layer.

<!-- page 6 -->

6.2 Database transactions and locking Complex workflows must use PostgreSQL transactions and targeted locks. Booking confirmation, temporary holds, package usage, credits, refunds and payout allocation must be atomic and concurrency-safe. 1. Reload and lock the relevant records. 2. Validate the hold, acceptance, permissions, price and payment state. 3. Confirm that no conflicting booking exists. 4. Write the booking and related financial records. 5. Close competing requests and release other holds. 6. Write audit, transition and event records. 7. Commit all changes together or roll back completely. 7. Permissions and Row Level Security
Every application table exposed through the Supabase data API must have an intentional Row Level Security policy. Row Level Security is a defensive boundary, while full business rules remain server-controlled. ● Public tables expose only deliberately public fields ● Authenticated access requires valid identity and scope ● Relationship-protected records require active family, tutor or organisation relationships ● Sensitive tables deny ordinary direct browser access ● Service-role credentials remain server-only ● Storage policies follow equivalent scope and sensitivity rules Automated tests should fail when a newly exposed table lacks an intentional policy. 8. Background Work, Events and Reliability
8.1 Inngest Inngest will run durable, retryable and idempotent background workflows, including request expiry, hold release, recurring booking generation, payment reminders, webhook follow-up, recording deletion, transcript processing and migration batches.
8.2 Domain events Every important completed business transaction should emit a structured domain event, such as booking.confirmed, payment.overdue, lesson.completed, service.published or tutor.approved.
domain_event event_id event_type entity_type entity_id actor_user_id actor_role occurred_at correlation_id payload_version payload environment
8.3 Transactional outbox The business change, domain event and outbox delivery record should be written in the same database transaction. A dispatcher should then forward pending events to Inngest or other destinations. ● Pending ● Processing ● Delivered

<!-- page 7 -->

● Retry scheduled ● Failed ● Abandoned ● Manually resolved External consumers must remain idempotent because a delivered event may still be processed more than once. 9. Platform Conﬁguration, Branding and Content
9.1 Typed conﬁguration groups Owner-editable settings should use typed configuration groups rather than an unrestricted key-value table. ● Branding configuration ● Booking rules ● Payment rules ● Tutor onboarding rules ● Notification rules ● Retention rules ● Feature flags ● Country and regional configuration
9.2 Owner-controlled platform name The Platform Owner must be able to change the public product name and related branding without rebuilding the database or rewriting the application. ● Product name and short name ● Tagline and pronunciation ● Logo and favicon ● Brand colours and typography ● Default page title ● Email sender name ● Support name ● Public domain display ● Social-sharing image Historical agreements, policy acceptances and audit records must preserve the name and version that applied at the time.
9.3 Public brand and content pages Configuration may feed structured public pages, but private settings and public content must remain separate records. The Owner workspace should support a public brand centre, press assets, platform principles, trust and safety, pricing explanation, tutor standards, FAQs and policy summaries.
9.4 Internal CMS Studdy should include a focused internal CMS with controlled content blocks rather than a general website builder. Pages should support draft, preview, scheduled, published, unpublished and archived states, with version history and rollback. 10. Feature Flags and Search
10.1 First-party feature ﬂags Feature flags should exist from the beginning and support global, environment, owner-preview, selected-user, role, organisation, country and pilot rollout rules, plus emergency disablement.

<!-- page 8 -->

● instant_booking ● group_lessons ● resource_marketplace ● embedded_lesson_room ● student_direct_booking ● organisation_workspace ● advanced_matching ● multiple_guardians Consequential flag evaluation must happen server-side. Disabling a feature must not delete or corrupt existing records.
10.2 PostgreSQL search initially PostgreSQL full-text search and structured filtering should be used initially for tutors, students, bookings, resources, payments and cases. The search layer should use a shared internal interface so selected indexes can later move to a dedicated provider. Recommendation ranking remains separate from text search. Search finds eligible records; matching ranks suitable tutors. 11. Sensitive Data and File Security
11.1 Data zones
Standard application data ● Public tutor profiles ● Bookings ● Services ● Approved summaries ● Homework ● Ordinary progress records
Restricted educational data ● Learning-support information ● Sensitive concerns ● Detailed accommodations ● Restricted assessment evidence
Safeguarding and case data ● Safeguarding reports ● Incident evidence ● Restricted case notes ● Investigation decisions
Identity and veriﬁcation data ● Identity documents ● Qualification evidence ● References ● Background-check records
Financial secrets ● Processor identifiers ● Payout details ● Restricted payment evidence

<!-- page 9 -->

Recording and transcript data ● Raw recordings ● Raw transcripts ● Processing artefacts ● Approved extracts
11.2 Storage separation
public-tutor-media student-files homework-submissions lesson-resources restricted-learning-support identity-verification case-evidence lesson-recordings lesson-transcripts
11.3 Controlled uploads Private uploads require server-authorised initiation, short-lived signed upload instructions, type and size validation, related-record validation, scan status and controlled storage paths using internal identifiers rather than names or email addresses. ● Upload initiated ● Uploading ● Uploaded ● Verification pending ● Scan pending ● Available ● Quarantined ● Rejected ● Deletion scheduled ● Deleted ● Retention hold Sensitive downloads should be server-controlled and may require signed URLs, access logging, stronger authentication, watermarking or no-download restrictions. 12. Audit, Versioning and Observability
12.1 Layered history model
Immutable audit log Security, permissions, finances, approvals, exports, impersonation, restrictions and consequential status transitions.
Version history Profiles, services, summaries, goals, policies, branding, configuration and recurring-series settings.
Activity timeline Understandable user-facing events such as tutor acceptance, homework assignment or payment becoming overdue.
Analytics events Privacy-aware product behaviour such as matching completion, tutor card views and booking-flow abandonment.

<!-- page 10 -->

12.2 Central observability Studdy should include centralised error tracking, structured logs, correlation IDs, failed-job monitoring, webhook monitoring, slow-query visibility, security alerts and a Platform Health dashboard from the first development phase.
timestamp severity environment service module action request_id correlation_id user_id workspace entity_type entity_id result duration_ms error_code
Logs must not contain raw student notes, transcripts, identity documents, card data, authentication tokens, signed URLs, full case evidence or password-reset links. 13. Secrets and Environment Security
Production secrets must exist only in approved environment-secret stores and trusted server environments. They must never be committed to GitHub, exposed to the browser, stored in ordinary application tables or copied into documentation and screenshots.
13.1 Secret categories
Browser-safe public conﬁguration ● Supabase public URL ● Supabase anonymous key protected by RLS ● Public application URL ● Approved public feature configuration
Server-only secrets ● Supabase service-role key ● Database connection string ● Stripe secret key ● Inngest signing key ● Email and AI provider credentials
Webhook signing secrets ● Stripe ● Inngest ● Email providers ● File processing ● Calendar integrations
High-risk recovery and encryption secrets ● Field-encryption keys ● Backup encryption keys ● Break-glass credentials ● Signing keys Development, staging and production must use separate credentials, processor environments, storage, webhooks and encryption keys.

<!-- page 11 -->

14. Deployment and Release Management
    14.1 GitHub-controlled pipeline
    Feature branches Preview deployments and automated checks. Never connected to production data.
    Development Integrated ongoing work using development services.
    Staging Release candidates, migration rehearsals and production-like configuration with separate credentials.
    Production Explicitly approved releases only, after tests, migration review and recorded deployment version.
    14.2 Required pipeline checks ● TypeScript checking ● Linting ● Unit tests ● Integration tests ● Permission and RLS tests ● Migration validation ● Application build ● Dependency vulnerability checks ● Secret scanning ● Generated schema consistency checks
    14.3 Expand-and-contract changes Breaking database and application changes should be separated into compatible stages: add new structure, deploy compatible code, migrate data, verify, switch fully, then remove obsolete structure later.
    14.4 Rollback Application rollback and database recovery must be planned separately. Forward corrective migrations will often be safer than reversing a database migration that may contain newer live data.
15. Backup and Disaster Recovery
    Studdy must maintain a documented recovery design beyond relying on default provider behaviour. ● Recovery Point Objective by data category ● Recovery Time Objective by service criticality ● Automated database backups ● Point-in-time recovery where available ● Critical financial exports ● File recovery strategy ● Restoration into a separate recovery environment ● Periodic restoration testing ● Named ownership and escalation

<!-- page 12 -->

Financial restoration must reconcile the Studdy ledger with Stripe events, tutor payouts, commission, refunds, credits and direct-payment records. 16. Encryption
16.1 Platform encryption Most ordinary data may rely on encrypted network connections, database and storage encryption at rest, encrypted backups and approved secret stores.
16.2 Application-level encryption Selected highly sensitive fields should be encrypted before database storage where the benefit justifies reduced searchability and added key-management complexity. ● Restricted safeguarding details ● Sensitive learning-support information ● Identity-document references ● Private integration credentials ● Selected legal or privacy evidence ● Highly sensitive case content Keys must remain separate from encrypted data, differ by environment, support rotation and be included in disaster recovery planning. 17. Rate Limiting and Abuse Protection
Studdy should enforce server-side, action-specific and risk-aware limits rather than one universal threshold.
17.1 Public actions ● Sign-up and login attempts ● Password reset ● Tutor matching ● Public tutor search ● Contact forms ● Tutor applications ● Invitation-code attempts ● File-upload initiation
17.2 Authenticated actions ● Tutor and multi-tutor requests ● Messages and comments ● Rescheduling and cancellations ● Support cases ● File uploads and downloads ● Exports ● Referral codes ● Payment retries ● Sensitive access requests Responses may include slowing requests, stronger authentication, CAPTCHA, temporary action blocks, account restrictions, alerts, incident creation or session termination. 18. Retention, Deletion and Legal Hold
Every major data category must have an explicit, versioned retention rule. Account deletion must not be treated as a single immediate erase operation.

<!-- page 13 -->

● Accounts and role history ● Student learning records ● Bookings and lessons ● Financial and tax records ● Homework and assessments ● Recordings and transcripts ● Identity evidence ● Support cases ● Safeguarding records ● Audit logs ● Analytics data Each rule should define category, jurisdiction, trigger, period, deletion or anonymisation method, backup treatment, legal-hold behaviour, owner, effective date and review date.
18.1 Legal hold A legal, safeguarding or regulatory hold pauses ordinary deletion for the affected records and must record scope, reason, authority, review date, owner and release decision.
18.2 User deletion requests A deletion request should produce a structured review showing what can be deleted, what can be anonymised, what must be retained, why, and when remaining data will be removed. 19. Testing Strategy
Permission, booking, payment, migration and security tests are mandatory release checks.
Unit tests ● Pricing and commission ● Deadline calculations ● Feature flags ● Eligibility ● Retention dates
Domain-service tests ● Tutor approval ● Booking requests ● Payment confirmation ● Recurring arrangements ● Disputes and restrictions
Database integration tests ● Transactions ● Constraints ● Outbox creation ● Ledger entries ● Locking ● Status consistency
RLS and permission tests ● Intended access ● Denied unrelated access ● Ended relationships ● Sensitive-field protection

<!-- page 14 -->

Payment tests ● Success and failure ● Duplicate and out-of-order webhooks ● Refunds ● Chargebacks ● Direct payment ● Commission collection
Concurrency tests ● Competing slot confirmation ● Double package usage ● Duplicate refund ● Overlapping backup invitations
Migration tests ● Counts ● Relationships ● Financial totals ● Historical dates ● Duplicates and exceptions
End-to-end tests ● Tutor application ● Parent booking ● Recurring series ● Overdue payments ● Summary publication ● Owner branding change
Security tests ● Authentication ● MFA ● Permission bypass ● Upload validation ● Signed URL expiry ● Rate limiting ● Secret scanning 20. External Provider Boundaries
Business logic should call Studdy-owned adapter interfaces rather than importing vendor-specific SDKs throughout the application.
PaymentProvider Authorisation, capture, refunds, tutor accounts and transfers. Initial implementation: Stripe.
EmailProvider Transactional email delivery and provider-neutral results.
CalendarProvider Create, update and cancel external calendar events.
AIProvider Draft summaries, homework suggestions, transcript analysis and matching explanations. AI may not directly write permanent student records.

<!-- page 15 -->

FileScanner Malware and file-safety checks.
LessonRoomProvider Future external video or embedded lesson-room integration. Adapters should handle provider authentication, timeouts, external identifiers, retries, idempotency, error mapping, redacted logging and health checks. 21. Migration from DarshaTutor
21.1 Migration model Migration must use repeatable, version-controlled scripts with staging rehearsals and a controlled final cutover. Manual entry is reserved for genuine exceptions.
21.2 Migration stages 8. Preserve source schema, data and files 9. Catalogue and map every relevant field 10. Classify as direct, transformed, split, combined, historical, exception or retired 11. Write versioned transformation and validation scripts 12. Run repeated staging rehearsals 13. Reconcile users, relationships, bookings and finances 14. Perform final snapshot and write freeze 15. Run final or delta migration 16. Validate before making Studdy authoritative 17. Retain rollback threshold and plan
21.3 Exception queue Unclear records must enter a structured exception queue rather than being guessed, discarded or silently altered. 22. Incident Response
Studdy should launch with a formal technical, privacy, security and operational incident process.
22.1 Severity
Severity 1: Critical Sensitive-data exposure, widespread unauthorised access, material incorrect financial transactions, production database outage or privileged credential compromise.
Severity 2: High Broad booking or payment disruption, significant access outage, delayed recording deletion or restricted information exposed to an unintended user group.
Severity 3: Moderate Partial feature outage, notification delays, search failure or isolated integration problems.
Severity 4: Low Cosmetic defects, minor performance degradation or isolated recoverable issues.
22.2 Lifecycle 18. Detected 19. Acknowledged

<!-- page 16 -->

20. Assessed 21. Contained 22. Investigating 23. Recovering 24. Monitoring 25. Resolved 26. Post-incident review complete Privacy and security incidents require an additional assessment of affected information, people, likely consequences, notification obligations, containment and evidence preservation.
21. Privileged Production Access
    Normal support and administration should happen through the Studdy Manager and Owner interfaces. Direct production access is exceptional. ● Individually assigned ● Role-specific ● Minimum necessary ● Multi-factor protected ● Time-limited where practical ● Logged ● Periodically reviewed ● Immediately revoked when no longer required
    23.1 Temporary access Exceptional access should record person, system, level, purpose, start, expiry, approver, related incident or task, actions performed and revocation status.
    23.2 Direct database changes Ordinary support corrections must use approved commands or interfaces. Emergency direct changes require an incident or maintenance record, exact operation history, post-change consistency checks and any missing audit corrections.
    23.3 Break-glass access Break-glass access must require strong authentication, explicit emergency declaration, short expiry, immediate alerts, complete logging, mandatory review and credential rotation where appropriate.
22. Implementation Standards
    ● The repository is the source of truth for application and database changes. ● Every consequential command validates permissions, status, rules and authentication strength server-side. ● Every exposed database table has an intentional Row Level Security policy. ● Every financial movement is represented through immutable ledger entries and corrections. ● Every important transition is auditable and correlated across systems. ● Every background job and external event consumer is idempotent. ● Every external provider sits behind an internal adapter. ● Every production release passes mandatory automated checks and explicit approval. ● Every sensitive data category has defined access, retention and deletion rules. ● Every migration and incident process is repeatable, reviewable and documented.
23. Approved Technology Direction
    Area Approved direction Notes Application Next.js and TypeScript One modular application initially

<!-- page 17 -->

Area Approved direction Notes Database Supabase Postgres New project and clean schema Authentication Supabase Auth Linked to independent Studdy User identity Schema and queries Drizzle ORM plus reviewed SQL Free and open source Deployment Vercel through GitHub-controlled pipelines
Explicit production approval
Background workflows Inngest Durable, retryable and idempotent Payments Stripe Connect behind PaymentProvider
Marketplace default; direct payments also supported Storage Supabase Storage with isolated buckets
Server-controlled private file access Search PostgreSQL full-text and filters initially
Dedicated search service may be added later Observability Central error tracking and structured logs
Provider selected during implementation Content Internal structured CMS Owner-managed branding and public pages Security RLS, MFA, rate limits, encryption and audit
Layered controls 26. Source Foundation
This design was developed from and should remain consistent with the approved Studdy foundation documents: ● Studdy Vision and Product Principles ● Studdy Tutor Discovery and Public Website Direction ● Studdy Functional Capabilities and System Modules ● Studdy Core User Journeys ● Studdy User Roles and Permissions ● Studdy Permissions, Roles and Access Control ● Studdy Statuses, State Transitions and Business Rules ● Studdy Data Model and Entity Relationships ● Studdy Information Architecture and Screen Map ● Studdy MVP Scope and Delivery Plan Approved technical architecture and security design complete.
