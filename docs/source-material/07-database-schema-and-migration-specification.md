# Database Schema and Migration Specification

> **Source document 07 of the Studdy planning pack.**
> Extracted verbatim from `07Database Schema and Migration Specifica....pdf` on 7 August 2026.
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
Database Schema and
Migration

Speciﬁcation

Version 1.0
Status: Approved Product: Studdy Tagline: The platform for better tutoring. Date: 2 August 2026
An implementation-ready PostgreSQL, Drizzle, Row Level Security and migration foundation
for

rebuilding

DarshaTutor

as

Studdy.

<!-- page 2 -->

Document control
Field Value Document Studdy Database Schema and Migration Specification Version 1.0 Status Approved Approved date 2 August 2026 Product Studdy Primary implementation PostgreSQL on Supabase, Drizzle ORM, reviewed SQL Related repository github.com/darshabloom/Studdy Migration source Existing DarshaTutor application and database
This document converts the approved conceptual data model and technical architecture into an implementation-ready database and migration specification. It governs schema ownership, table responsibilities, identifiers, versioning, financial integrity, Row Level Security, indexes, migration staging, reconciliation, cutover and retirement of the legacy system.
Related approved documents
● Studdy Vision and Product Principles ● Studdy Tutor Discovery and Public Website Direction ● Studdy User Roles and Permissions ● Studdy Core User Journeys ● Studdy Functional Capabilities and System Modules ● Studdy Statuses, State Transitions and Business Rules ● Studdy Data Model and Entity Relationships ● Studdy Permissions, Roles and Access Control ● Studdy Information Architecture and Screen Map ● Studdy MVP Scope and Delivery Plan ● Studdy Technical Architecture and Security Design Version 1.0 ● Studdy Implementation Blueprint and Repository Plan Version 1.0 ● Studdy Product Design System and UX Standards Version 1.0
Contents

1. Purpose and database principles 2. PostgreSQL schema organisation 3. Shared conventions and identifiers 4. Identity, authentication and contacts 5. Families, students and subject sections 6. Tutors, applications and verification 7. Tutor-student relationships 8. Services, availability and capacity 9. Discovery, requests, bookings and recurring series 10. Lessons and learning records 11. Payments, ledger, commission, packages and credits 12. Shared files, comments, tasks and evidence 13. Permissions and Row Level Security 14. Audit, status transitions, events and outbox 15. Search, indexes and derived views 16. Migration staging, validation and exceptions 17. Cutover, reconciliation, rollback and retirement 18. Implementation definition of done

<!-- page 3 -->

1. Purpose and database principles
   Studdy will use a clean, newly created Supabase project and PostgreSQL database. The existing DarshaTutor database remains a migration source and reference, not the structural foundation of the rebuilt product.
   Principle Approved direction Build the real foundation once The schema must support the intended multi-tutor platform from the beginning, even when some interfaces are enabled later. Permanent identity People, students, families, relationships and major business records use permanent identifiers and are not recreated when roles or circumstances change. Historical preservation Bookings, service terms, rules, prices, permissions, financial movements and material changes preserve history. Soft deletion by default Records are normally archived, deactivated, anonymised or retained rather than physically deleted. Immutable financial history Corrections use reversal, adjustment, refund or replacement entries rather than editing posted movements. Explicit relationships Family Membership, Tutor-Student Relationship, Organisation Membership and Permission Grant are dedicated entities. Server authority Consequential operations are completed by trusted server commands using transactions and locks. Minimum necessary access Access depends on role, workspace, relationship, scope, sensitivity, restrictions and authentication assurance. Configuration over hard-coding Statuses, reasons and business rules that may change use typed, versioned records. Provider independence External provider identifiers remain separate from Studdy domain and ledger records.
   1.1 Source of truth
   ● The repository is the source of truth for schema definitions and migrations. ● Drizzle defines typed schemas and ordinary queries. ● Reviewed SQL is used for Row Level Security, constraints, functions, triggers, range exclusions, complex views and performance-sensitive operations. ● Production schema changes should not normally be made manually through the Supabase dashboard.
   1.2 Environment separation
   Environment Database purpose Local Supabase CLI, Docker, local PostgreSQL, Auth and Storage using synthetic data. Development Shared integration environment with development providers and no uncontrolled live personal data. Staging Production-like migration rehearsal and user acceptance testing using separate credentials. Production Live data, payments and restricted approved access only.
2. PostgreSQL schema organisation
   Studdy will use named PostgreSQL schemas rather than placing all application tables in public. Each schema establishes business ownership, dependency boundaries, privileges and migration responsibility.
   Schema Responsibility identity Permanent people, authentication links, role assignments, contact points and account lifecycle. families Family Accounts, memberships, family preferences, invitations and family-owned locations. students Student Profiles, subject sections, independence transitions, supporter relationships and tutor-student relationships.

<!-- page 4 -->

Schema Responsibility tutors Tutor Applications, Tutor Profiles, verifications, interviews, references and restrictions. organisations Organisations, memberships, programmes, cohorts and organisation-owned operating records. services Services, Service Versions, publication reviews and service eligibility. availability Recurring availability, exceptions, blocked time, capacity, holds, reservations and waiting lists. bookings Intended Lesson Requests, Tutor Requests, Bookings, changes, snapshots and Recurring Series. payments Provider records, double-entry ledger, commission, packages, credits, payouts and reconciliation. lessons Lessons, attendance, plans, outcomes, summaries, recordings and transcripts. learning Subjects, curriculum, skills, progress, goals, evidence, homework, assessments and concerns. resources Resources, versions, assignments, marketplace purchases and contributor records. communications Conversations, messages, notifications and delivery records. support Support cases, complaints, disputes, appeals, safeguarding and case evidence. permissions Capabilities, role definitions, grants, access requests, manager scopes and temporary access. platform Configuration, feature flags, country rules, content pages, retention and shared operational records. audit Audit events, status transitions, approvals, domain events, outbox and consistency findings. integration Provider connections, webhook receipts, external identifiers and event consumption. migration Staging, mapping, validation, exceptions, import results and cutover checkpoints.
2.1 Public schema rule
● The public schema remains deliberately minimal. ● It may contain approved public views, extensions and tightly reviewed compatibility functions. ● Ordinary application tables are not added to public by default. ● Public tutor discovery should use dedicated views exposing approved fields only.
2.2 Database package organisation
packages/database/src/schema/ identity/ families/ students/ tutors/ organisations/ services/ availability/ bookings/ payments/ lessons/ learning/ resources/ communications/ support/ permissions/ platform/ audit/ integration/ migration/ shared/ index.ts

<!-- page 5 -->

3. Shared conventions and identiﬁers
   3.1 UUID primary keys
   Every core entity uses a PostgreSQL-generated UUID primary key. UUIDs are used for joins, repository interfaces, domain events, storage paths and internal API identity. id uuid primary key default gen_random_uuid()
   ● UUIDs are never reused. ● Business records reference Studdy UUIDs rather than provider identities. ● Application-created UUIDs are permitted only for deliberate idempotent or pre-insert workflows.
   3.2 Human-readable references
   Major records also receive permanent human-readable references for support, notifications and user-facing communication.
   Prefix Example use USER USER-00010481 FAM FAM-00010482 STUDENT STUDENT-00010483 TUTOR TUTOR-00010484 SERVICE SERVICE-00010485 BOOK BOOK-00010486 SERIES SERIES-00010487 LESSON LESSON-00010488 PAY PAY-00010489 PAYOUT PAYOUT-00010490 CASE CASE-00010491 RESOURCE RESOURCE-00010492 ● References use one concurrency-safe global sequence with an entity prefix. ● References never contain names, dates of birth or other personal data. ● References remain stable after archival, replacement and migration. ● Low-level join tables do not require visible references unless operationally useful.
   3.3 Standard mutable-record columns
   id reference -- where applicable status_code created_at created_by_user_id updated_at updated_by_user_id record_version archived_at archived_by_user_id
   Selected tables may also include effective_from, effective_until, retention_until, legal_hold_status, deletion_status, country_code, organisation_id and correlation_id.
   3.4 Concurrency
   Mutable records use optimistic concurrency through record_version. Commands must supply the expected version and return RESOURCE_CONFLICT rather than silently overwriting newer work.
   3.5 Archival, deletion and retention
   ● Archival removes records from ordinary active use while preserving history and links. ● Physical deletion is a controlled workflow, not an ordinary row update. ● Deletion is blocked by legal hold, financial retention, safeguarding retention, active disputes or required historical links. ● Retention dates are derived from versioned retention rules. ● Records representing rules and permissions use effective_from and effective_until.

<!-- page 6 -->

3.6 Enums and reference tables
Use PostgreSQL enum Use reference table Small structural values such as actor type, ledger direction and environment.
Statuses, cancellation reasons, progress scales, verification labels and configurable business categories. Changed only by reviewed migration. May be renamed, translated, ordered, scoped, activated or retired. Technically fundamental. Owner-configurable or jurisdiction-dependent.
3.7 Foreign-key deletion behaviour
● RESTRICT or NO ACTION is the default for meaningful business relationships. ● CASCADE is limited to truly dependent technical rows with no independent history. ● SET NULL is used only where the child remains understandable and adequate snapshots exist. ● Every table documents archival, deletion, anonymisation, transfer and retention behaviour. 4. Identity, authentication and contacts
4.1 Permanent Studdy User
identity.users represents one permanent person. Supabase Auth manages credentials and sessions, while business records reference the Studdy User ID. identity.users id reference legal_name preferred_name display_name date_of_birth country_code region_code time_zone locale account_status_code created_at updated_at record_version archived_at retention_until legal_hold_status
4.2 Authentication identity links
identity.auth_identity_links id user_id provider_type provider_subject_id provider_tenant authentication_email status_code is_primary linked_at last_authenticated_at unlinked_at unlink_reason_code
● One active provider subject links to only one Studdy User. ● One Studdy User may have several authentication identities. ● Removing login does not delete the permanent business identity. ● Students may have a User and Student Profile before login is enabled. ● The model supports future passkeys, institutional SSO and provider replacement.

<!-- page 7 -->

4.3 Role deﬁnitions and dated assignments
permissions.role_definitions identity.user_role_assignments user_id role_definition_id status_code effective_from effective_until assigned_by_user_id assignment_reason_code workspace_enabled scope_type scope_id country_code organisation_id
Role assignment answers whether the person currently holds a role. Role-specific profiles hold the operational data for that role. Boolean fields such as is_tutor or is_admin are prohibited. ● One person may simultaneously be Tutor, Parent, Independent Student, Organisation Member and Platform Manager. ● Removing one role does not remove unrelated roles. ● One active Platform Owner assignment is permitted initially. ● Ownership transfer requires step-up authentication, impact preview, approval and complete audit history.
4.4 Structured contact points
identity.contact_points user_id contact_type contact_value_encrypted contact_value_normalised_hash label purpose_code is_primary verification_status_code verified_at consent_status_code available_for_login available_for_notifications available_for_emergency_use effective_from effective_until
Authentication email is not automatically the user's only contact email. Contact purposes may include general contact, booking notifications, billing, support, emergency and organisation contact.
4.5 Locations
Physical addresses remain in dedicated location records. Dedicated ownership link tables are preferred over unconstrained polymorphic ownership where practical. ● Public summary, approximate area, exact address, booking-only visibility and admin-only fields are distinct. ● Sensitive address and access instruction fields are encrypted or restricted. ● Confirmed Bookings preserve location snapshots so later address changes do not rewrite history.

<!-- page 8 -->

5. Families, students and subject sections
   5.1 Family Account
   families.family_accounts id reference display_name primary_country_code region_code default_currency_code status_code primary_guardian_membership_id financial_account_id created_at updated_at record_version archived_at
   The Family Account is permanent and separate from any one guardian. Changing the primary guardian does not change family identity, booking history, payments, tutor relationships or saved locations.
   5.2 Family Membership
   families.family_memberships family_account_id user_id membership_role_code status_code effective_from effective_until is_primary_guardian invitation_source_code invited_by_user_id accepted_at ended_at end_reason_code historical_access_until
   ● The initial product supports one active primary guardian per Family Account. ● Additional guardians are architecturally supported and receive explicit scoped permissions. ● Ending membership preserves historical participation and recalculates access.
   5.3 Student Proﬁle
   students.student_profiles id reference user_id status_code independence_status_code login_access_state_code school_year_code school_or_provider_name primary_curriculum_framework_id learning_preferences general_goals support_summary default_family_account_id created_at updated_at record_version archived_at
   ● One permanent Student Profile links to one permanent User. ● Family relationship is derived from memberships rather than permanent ownership by one parent. ● Family transfer and dependent-to-independent transition preserve the Student Profile ID and learning history. ● Duplicate-profile merges use a controlled dependency and conflict review.

<!-- page 9 -->

5.4 Student independence transition
A dedicated transition record preserves previous permissions, parent and tutor input, payment responsibility, former-parent access, supporter arrangements and reversal status.
5.5 Student Subject Sections
students.student_subject_sections id student_profile_id subject_id curriculum_framework_id curriculum_version_id year_level_code status_code effective_from effective_until summary subject_preferences current_progress_summary created_at updated_at record_version archived_at
Subject sections are stable anchors for skills, progress, goals, homework, assessments, important dates, resources and tutor access. Accidental duplicate active sections for the same student and subject context are prevented.
5.6 Subjects and curriculum
● learning.subjects supports canonical names, aliases, hierarchy and country applicability. ● learning.curriculum_frameworks and learning.curriculum_standards are versioned. ● A narrow area such as Calculus is a subject section only where it requires its own tutor relationship, service, progress view or curriculum structure. 6. Tutors, applications and veriﬁcation
6.1 Tutor Application
Tutor Application is a workflow record and remains separate from the operational Tutor Profile. tutors.tutor_applications id reference applicant_user_id status_code current_revision_id submitted_at assigned_reviewer_user_id country_code application_route_code withdrawn_at approved_at rejected_at created_at updated_at record_version
Lifecycle Examples Draft Application draft Pending Submitted, identity review, reference checks, interview required, trial lesson review, changes requested Active Conditionally approved, approved Paused Under review, restricted, suspended Completed Rejected, permanently ineligible Cancelled Withdrawn Archived Archived application

<!-- page 10 -->

6.2 Application revisions
Each resubmission creates an immutable Tutor Application Revision. Approvals identify the exact revision approved. Relational sections such as references, qualifications and declarations use dedicated child records where appropriate.
6.3 Tutor Proﬁle
tutors.tutor_profiles id reference user_id status_code public_display_name biography teaching_approach profile_photo_file_id introductory_video_file_id visibility_status_code recommendation_status_code accepting_new_students_status_code direct_payment_eligibility_status stripe_eligibility_status approved_at activated_at restricted_at suspended_at created_at updated_at record_version archived_at
Approval uses one controlled transaction to lock the approved application revision, create or activate the Tutor Profile, create the role assignment, create verification labels, create guided setup tasks, write transition and audit history, and emit tutor.approved.
6.4 Structured veriﬁcation
Verification type Specialised record and public meaning Identity Identity Verification; public label may state Identity verified. Qualification Qualification Verification; only approved verified claims are public. Reference Reference Requests, Responses and Reviews; public label may state References completed. Interview Interview Record; public label may state Studdy interviewed. Trial lesson Trial Lesson Review with structured quality and safeguarding outcomes. Subject or year level Subject Review or Year-level Review for scoped verification labels. ● One generic verified boolean is prohibited. ● Verification may be requested, under review, verified, limited, expired, failed, revoked or archived. ● Identity and reference evidence remains restricted and separate from public profile data. ● Expiry may remove a label or create the narrowest sufficient restriction.

<!-- page 11 -->

7. Tutor-student relationships
   7.1 Permanent relationship
   students.tutor_student_relationships id reference tutor_profile_id student_profile_id family_account_id organisation_id relationship_source_code status_code started_at activated_at paused_at ended_at historical_from default_payment_method_code direct_payment_eligible communication_rule_id record_sharing_rule_id parent_visibility_rule_id student_visibility_rule_id handover_status_code created_at updated_at record_version
   A tutor and student pair normally uses one continuing relationship identity across bookings, subjects, payment-method changes, pauses and historical access.
   Stage Meaning Prospective A request exists and the tutor sees minimum decision-making information. Pending confirmation Tutor accepted but parent or independent student has not completed confirmation. Active First booking confirmed and tutoring relationship operating. Paused Relationship preserved while ordinary activity is temporarily stopped. Ended No future tutoring currently planned. Historical Limited approved past access remains. Restricted Selected capabilities are blocked while the relationship remains recorded.
   7.2 Relationship source
   ● Marketplace ● Permanent tutor code ● Single-use invitation ● Referral code ● Organisation assignment ● Manager assignment ● Existing relationship migration Source is specific to the tutor-family relationship. A family may be marketplace-sourced for one tutor and tutor-brought for another.

<!-- page 12 -->

7.3 Subject links
students.tutor_student_subject_links tutor_student_relationship_id student_subject_section_id subject_id status_code effective_from effective_until approved_year_level_code progress_access_level_code homework_access_level_code assessment_access_level_code record_sharing_rule_id primary_service_id
A Mathematics tutor does not automatically receive access to English records. Access derives from the active relationship, subject link, visibility, sharing rules, restrictions and historical-access rules.
7.4 Relationship payment and communication rules
● Payment rules are effective-dated and may permit Stripe, bank transfer or cash. ● Commission rule version and relationship source are preserved in each confirmed Booking. ● Communication permissions distinguish parent-tutor, student-tutor, booking-only and post-relationship messaging. ● Cross-tutor sharing covers approved subject-relevant records and excludes private notes, unapproved drafts and unrelated subjects.
7.5 Ending and handover
Ending a relationship reviews future bookings, recurring series, access, handover, communication, payment reconciliation and notifications. The relationship row remains preserved. 8. Services, availability and capacity
8.1 Service parent
services.services id reference owner_type_code owner_tutor_profile_id owner_organisation_id delivering_tutor_profile_id service_name service_type_code status_code visibility_status_code current_version_id source_service_id created_at updated_at record_version archived_at
One shared model supports tutor-owned and organisation-owned offerings. Valid ownership combinations are enforced.

<!-- page 13 -->

8.2 Service Version
services.service_versions id service_id version_number lifecycle_status_code display_name description subject_id year_level_from_code year_level_to_code lesson_format_code duration_minutes price_minor currency_code capacity minimum_notice_minutes response_deadline_rule_id trial_policy_id cancellation_rule_version_id rescheduling_rule_version_id payment_rule_version_id travel_rule_version_id recording_rule_version_id student_eligibility_rule_id package_eligibility_rule_id effective_from effective_until published_at superseded_by_version_id
● Draft versions may be edited. ● Published, approved, booked or purchased versions are immutable. ● Further changes create a new version. ● Publishing validates tutor eligibility, price, currency, availability, capacity, payment and policy rules. ● Service duplication creates a new Service and unpublished draft version without inherited bookings.
8.3 Money representation
Authoritative money uses amount_minor bigint and currency_code char(3). Floating-point numbers are prohibited for financial calculations.
8.4 Availability rules
availability.availability_rules tutor_profile_id service_id subject_id lesson_format_code location_id day_of_week local_start_time local_end_time iana_time_zone effective_from effective_until recurrence_rule minimum_notice_minutes maximum_advance_booking_days status_code
Recurring availability preserves local weekday, local time and IANA time zone. Absolute occurrences store UTC timestamps.

<!-- page 14 -->

8.5 Availability layers
Base recurring availability + one-off additions - blocked time - confirmed bookings - active holds - travel buffers - holidays and breaks - capacity restrictions - minimum notice - service eligibility = bookable availability
8.6 Exceptions, blocked time and occurrences
● Availability Exceptions represent additional availability, modified hours, holidays, breaks and temporary restrictions. ● Blocked Time records private reasons separately from public Unavailable labels. ● A hybrid occurrence model stores rules as authoritative and generates a rolling operational projection. ● Generated occurrence rows are regenerable projections, not historical agreements.
8.7 Calendar holds and reservations
Calendar Holds are durable because they affect competing requests. Holds record source request, tutor, student, time, type, status, expiry and release reason.
8.8 Travel buffers
Travel buffers are distinct records linked to in-person Bookings. They may be recalculated before confirmation and become historically stable once the Booking is confirmed.
8.9 Capacity
availability.capacity_rules tutor_profile_id service_id subject_id year_level_from_code year_level_to_code lesson_format_code location_scope_id student_category_code capacity_type_code capacity_limit availability_status_code effective_from effective_until priority
● Capacity is separate from open calendar time. ● Rules may control active students, new students, weekly lessons, group size, requests, existing-students-only and waiting-list-only states. ● Current usage may be cached but is derived from authoritative relationships, series, bookings and cohort memberships. ● The most specific valid restrictive rule normally applies.

<!-- page 15 -->

9. Discovery, requests, bookings and recurring series
   9.1 Intended Lesson Request
   bookings.intended_lesson_requests id reference student_profile_id family_account_id student_subject_section_id requested_by_user_id status_code subject_id year_level_code learning_need_code goal_summary preferred_start_at preferred_end_at local_date local_start_time iana_time_zone duration_minutes lesson_format_code preferred_location_id budget_min_minor budget_max_minor currency_code trial_preference_code recurring_preference_code matching_preferences_snapshot matching_exclusions_snapshot matching_priority_snapshot request_deadline_at
   The Intended Lesson Request represents the underlying tutoring need. Several Tutor Requests may sit beneath it.
   9.2 Tutor Request
   bookings.tutor_requests id reference intended_lesson_request_id tutor_profile_id service_id service_version_id tutor_student_relationship_id status_code sent_at response_deadline_at calendar_hold_id accepted_at declined_at expired_at withdrawn_at proposed_alternative_at decline_reason_code private_decline_note
   ● The configurable initial maximum is three active Tutor Requests per intended need. ● The first tutor to accept does not automatically win. ● The parent may choose among accepted tutors before the deadline. ● Selecting one tutor closes competing requests and releases their holds. ● Tutors cannot see other contacted tutors, prices or messages.
   9.3 Booking
   Booking is the permanent record of what was scheduled and agreed. Lesson is the separate record of what actually happened.

<!-- page 16 -->

bookings.bookings id reference intended_lesson_request_id selected_tutor_request_id student_profile_id tutor_profile_id tutor_student_relationship_id student_subject_section_id service_id service_version_id recurring_series_id organisation_id cohort_id status_code scheduled_start_at scheduled_end_at local_date local_start_time iana_time_zone lesson_format_code location_snapshot_id booking_snapshot_id price_snapshot_id policy_snapshot_id payment_status_code tutor_acceptance_status_code parent_approval_status_code confirmed_at cancelled_at completed_at disputed_at
9.4 Booking changes and replacements
● Ordinary date, time, format, approved location and equivalent-service changes preserve the Booking ID through Booking Change records. ● A different tutor, student, materially different service, organisation transfer or reassignment creates a replacement Booking. ● The replacement links to the original and receives a new reference. ● Material price changes invalidate earlier approvals and require explicit acceptance.
9.5 Recurring Series
bookings.recurring_series id reference tutor_student_relationship_id student_profile_id tutor_profile_id student_subject_section_id service_id current_service_version_id status_code frequency_code interval_count regular_weekday regular_local_start_time duration_minutes iana_time_zone start_date end_date ongoing generation_window_days slot_protection_days lesson_format_code location_id payment_arrangement_code package_id current_terms_version_id
● The Series generates individual Bookings for a rolling horizon rather than indefinitely. ● Each generated Booking has a deterministic occurrence identity to prevent duplicates. ● Series Terms Versions are immutable after generating or confirming Bookings.

<!-- page 17 -->

● Changes distinguish this Booking only, this and future Bookings, or the entire Series. ● Pausing defines whether slots remain protected and for how long. ● Price changes create proposed terms and require parent or independent-student approval.
9.6 Database-level conﬂict prevention
A unified availability.tutor_time_reservations table protects confirmed Bookings, holds, recurring slots, travel buffers, personal blocks and organisation commitments. exclude using gist ( tutor_profile_id with =, tstzrange(start_at, end_at, '[)') with && ) where (status_code = 'active')
● Transactions lock and validate records before inserting or activating reservations. ● Conflict rejection rolls back the entire command and returns RESOURCE_CONFLICT. ● Conflict classes define which reservation types may or may not overlap. ● High-risk overrides require reason, impact preview, audit and linked corrections.
9.7 Structured Booking Snapshots
Snapshot Core values Booking Snapshot Service name, subject, year level, format, duration, service version and organisation. Price Snapshot Base price, travel fee, discount, credit, tax, total, currency, fees and estimated tutor take-home. Policy Snapshot Cancellation, rescheduling, payment deadline, trial, recording, refund and package rule versions. Location Snapshot Location type, address, public area, access instructions, travel assumptions, pet and safety information. Approval Snapshot Approved tutor, student, time, price, service version, formula and material-terms hash. Core values remain structured and queryable. JSON is limited to secondary frozen detail and provider metadata. Confirmed snapshots are immutable. 10. Lessons and learning records
10.1 Lesson
lessons.lessons id reference booking_id tutor_profile_id student_profile_id shared_group_lesson_id status_code actual_start_at actual_end_at attendance_status_code completion_status_code recording_status_code transcript_status_code summary_status_code dispute_status_code created_at completed_at updated_at record_version
A cancelled Booking may create no Lesson. A group Booking may create one shared Lesson and separate Student Lesson Outcomes.

<!-- page 18 -->

10.2 Separate outcome dimensions
Dimension Examples Lesson lifecycle Scheduled, ready, in progress, completed, cancelled, corrected, archived. Completion outcome Delivered, partially delivered, not delivered, auto-completed, manager-completed, disputed. Attendance Attended, partially attended, late, student no-show, tutor no-show, technical failure. Payment Payment due, parent says paid, paid, overdue, refunded, waived, disputed. Commission Estimated, reserved, chargeable, adjusted, owed, paid. Summary Not started, AI draft ready, tutor editing, approved, published, amended, overdue. Lesson completion, attendance, payment, commission and dispute are independent facts. One overloaded status is prohibited.
10.3 Attendance
Attendance uses participant-specific records with join and leave times, duration, recorder and correction history. Group lessons have one attendance record per student.
10.4 Lesson Summary and versions
lessons.lesson_summaries lessons.lesson_summary_versions lesson_summary_id version_number source_type_code author_user_id content_overview topics_covered challenges_summary progress_summary next_steps_summary parent_visible_content student_visible_content visibility_code approval_status_code approved_by_tutor_profile_id approved_at previous_version_id amendment_reason_code
● AI drafts remain separate from approved educational records. ● Only approved versions are parent- or student-visible. ● Amendments create new versions and preserve the earlier approved content.
10.5 Structured learning records
Entity Role Homework Assignment Instructions, due date, student, subject, tutor, lesson and visibility. Homework Submission Versioned student responses, files, comments and supersession. Homework Review Tutor feedback, status, reviewed skills and next action. Progress Update Immutable, attributable judgement linked to subject, skill, standard, evidence and confidence. Goal Hierarchical, attributable goal with due date, status, visibility and evidence. Concern Sensitive learning or support concern with parent and student visibility rules. Tutor Observation Structured educational evidence distinct from private planning notes. Assessment Attempt Exact assessment and question versions completed by the student.

<!-- page 19 -->

A tutor cannot silently overwrite another tutor's progress judgement, goal, observation, assessment result or concern. Corrections create linked superseding records.
10.6 Proposed AI learning updates
AI may propose progress updates, goals, homework, concerns, observations, resources and next actions. The tutor must review and deliberately accept a proposal before a real learning record is created.
10.7 Evidence
Evidence Items may represent homework, assessment answers, tutor observations, uploaded work, resource completion, recording excerpts, transcript segments, parent results or student reflection. Evidence Links allow one item to support several skills, goals, standards and progress updates. 11. Payments, ledger, commission, packages and credits
11.1 Double-entry ledger
All material financial movements use a balanced double-entry ledger. Posted transactions and entries are immutable. payments.ledger_accounts payments.ledger_transactions payments.ledger_entries ledger_transaction_id ledger_account_id direction_code amount_minor currency_code entry_sequence
● Every posted transaction contains at least two entries. ● Total debits equal total credits. ● All entries in a transaction use the same currency. ● Corrections use a reversing transaction and replacement transaction where required. ● One ledger account operates in one currency.
11.2 Ledger account types
● Parent receivable ● Payment processor clearing ● Tutor payable ● Tutor receivable ● Studdy fee income ● Commission receivable ● Stripe fee expense ● Refund payable ● Credit liability ● Cash or bank-transfer clearing ● Chargeback receivable ● Organisation payable
11.3 Provider-facing records
Payment Intent, Payment, Refund and Payout records describe external or operational provider activity. They remain separate from internal ledger transactions. ● Provider event IDs and idempotency keys prevent duplicate processing. ● Raw provider statuses do not replace stable Studdy business statuses. ● Provider webhook receipts are verified, restricted and reconciled. ● One provider event may create several domain and ledger records.

<!-- page 20 -->

11.4 Direct payments
Bank transfer and cash use ordinary Payment records plus a specialised Direct Payment Record for parent-reported payment, tutor confirmation, amount, reference, date, dispute and waiver.
11.5 Commission
payments.commission_entries booking_id lesson_id tutor_profile_id tutor_student_relationship_id commission_rule_version_id status_code booking_value_minor commission_rate_basis_points commission_amount_minor currency_code estimated_at reserved_at chargeable_at adjusted_at owed_at paid_at billing_cycle_id ledger_transaction_id
State Meaning Estimated Provisional forecast before financial obligation exists. Reserved Expected commission associated with an accepted or likely Booking. Chargeable Booking or Lesson reached the configured chargeable condition. Adjusted Refund, dispute, waiver, correction or other approved change altered the amount. Owed Commission entered a tutor billing cycle and financial obligation exists. Paid Commission was collected or offset by an approved credit. ● Rates use basis points and explicit versioned rounding rules. ● Direct-payment commission does not depend on tutor confirmation of parent payment. ● Weekly and fortnightly billing cycles are supported. ● Failed collection creates retries, required actions and proportionate restrictions rather than deleting the obligation.
11.6 Packages
Package Definitions and immutable Package Definition Versions describe the commercial product. Package Purchases record family ownership. Package Transactions record every balance movement.
Package transaction Effect Purchase Creates purchased value and optional lesson entitlement. Lesson reserved Temporarily reserves entitlement after Booking confirmation. Lesson consumed Consumes entitlement when the Booking becomes chargeable. Reservation released Restores reserved value after a non-chargeable cancellation. Transfer in or out Moves approved unused monetary value. Refund Returns approved value. Expiry Expires value under the accepted rule. Adjustment or reversal Corrects a prior transaction without overwriting it. Remaining lesson entitlement and monetary value are derived from transaction history. Cached balances are permitted only when reconciled.

<!-- page 21 -->

11.7 Credits
General Studdy, tutor-specific, organisation, referral, commission and service-recovery credits use Credit Accounts and immutable Credit Transactions. Credit issue creates a liability; redemption reduces it.
11.8 Reconciliation
● Provider reconciliation compares payments, refunds, payouts, fees, webhooks and ledger postings. ● Financial consistency views detect unbalanced or missing movements. ● Unresolved differences create consistency findings and operational tasks. 12. Shared ﬁles, comments, tasks and evidence
12.1 Shared-model rule
Shared models are used only where the capability has substantially the same meaning across modules. They do not replace specialised entities with meaningful business lifecycle.
12.2 Files
platform.files id reference storage_zone_code storage_bucket storage_object_key original_filename safe_display_filename content_type file_size_bytes checksum upload_status_code scan_status_code sensitivity_class_code retention_rule_version_id retention_until legal_hold_status created_by_user_id created_at available_at quarantined_at deletion_scheduled_at deleted_at
Storage zone Examples public_tutor_media Public profile photos and approved introduction videos. student_files Private student-owned files. homework_submissions Submitted homework files. lesson_resources Files assigned or used in lessons. restricted_learning_support Sensitive support and accommodation information. identity_verification Identity and qualification evidence. case_evidence Support, complaint and safeguarding evidence. lesson_recordings Raw lesson recordings. lesson_transcripts Raw and processed transcripts. File availability requires validated type, size, checksum, scan result, related record, permission, zone, retention and visibility. High-sensitivity links may use specialised link tables for stronger foreign keys.
12.3 Comments
Comments support application reviews, access requests, approvals, support cases, corrections, disputes and resource reviews. Visibility is explicit and edits preserve prior content.

<!-- page 22 -->

12.4 Tasks
Tasks represent required work such as approving a lesson summary, reviewing an application, completing payment, renewing verification or resolving a migration exception. Notifications may point to tasks but do not replace them.
12.5 Saved items
Saved Items may represent favourite tutors, resources, student shortcuts, programme shortcuts or manager queues. Family-private notes remain hidden from tutors unless deliberately shared.
12.6 Generic links
Generic Entity Links are permitted only for typed, centrally validated simple relationships. Tutor-Student Relationship, Payment, Booking and Homework Assignment remain specialised. 13. Permissions and Row Level Security
13.1 Defence in depth
Studdy uses both trusted server-side capability evaluation and PostgreSQL Row Level Security. Neither replaces the other.
Server permission engine Row Level Security Evaluates role, workspace, relationship, subject, organisation, sensitivity, restrictions, temporary access, authentication assurance and business rules.
Prevents direct or accidental database access outside approved rows and columns.
Controls consequential commands and approval limits. Acts as a defensive boundary for browser-exposed tables and views. Returns safe business errors and access explanations. Defaults to deny for sensitive tables.
13.2 User resolution
auth.uid() -> identity.auth_identity_links -> identity.users
Reviewed helper functions may resolve the current Studdy User. They must use safe search paths, narrow outputs, tests and no unintended privilege escalation.
13.3 Workspace context
The active workspace is verified server-side against current role assignments, restrictions and authentication assurance. Arbitrary client-provided role names are never trusted.
13.4 Direct browser access
● Public tutor search views expose approved public fields only. ● Ordinary users may directly read selected own or relationship-linked low-risk records under intentional policies. ● Ledger entries, audit events, identity verification, safeguarding, raw transcripts, raw recordings, payout details and temporary access grants are server-only or default-deny.
13.5 Reusable policy patterns
● Public read ● Own record ● Family relationship ● Tutor relationship and subject scope ● Organisation scope ● Manager role and scope ● Owner authority with strong authentication
13.6 Policy testing
● Every exposed table has RLS enabled and an intentional policy.

<!-- page 23 -->

● Anonymous users cannot access private records. ● Parents cannot access unrelated families. ● Tutors cannot access unrelated students or subjects. ● Dependent students cannot access family finances. ● Organisation and Manager users cannot exceed assigned scope or limits. ● Expired Temporary Access Grants and suspended roles stop working immediately. ● Cross-tutor sharing and historical-access rules are enforced.
13.7 Policy naming
public_read_approved_tutor_profiles user_read_own_contact_points parent_read_linked_student_homework tutor_read_active_subject_progress manager_read_assigned_support_cases 14. Audit, status transitions, events and outbox
14.1 Atomic consequential commands
A consequential command writes its business changes, audit records, status transitions, approvals, domain event and outbox entry in the same PostgreSQL transaction. The entire operation commits or rolls back.
14.2 Audit Events
audit.audit_events id reference event_category_code action_code entity_type_code entity_id actor_type_code actor_user_id actor_role_assignment_id active_workspace_code country_code organisation_id request_id correlation_id reason_code result_code before_summary after_summary sensitivity_class_code occurred_at
Audit records are append-only and avoid copying raw sensitive content unnecessarily.

<!-- page 24 -->

14.3 Status transitions
audit.status_transitions id reference entity_type_code entity_id previous_status_code target_status_code transition_type_code requester_user_id requester_role_assignment_id requested_at completed_at current_revision_number rule_version_id preconditions_result approval_formula grace_period_seconds scheduled_completion_at acknowledgement_mode_code override_status_code override_reason_code correlation_id
● Preconditions are structured and all known failures are returned together. ● Transition revisions preserve amended requests. ● Approvals reference the exact revision approved. ● Reverse and corrective transitions are explicit rather than direct backward edits.
14.4 Domain Events
audit.domain_events event_id event_type entity_type entity_id actor_user_id actor_role_code occurred_at correlation_id payload_version payload environment_code
Payloads are versioned, minimal and exclude unnecessary sensitive data.
14.5 Transactional outbox
audit.outbox_entries domain_event_id destination_code delivery_status_code available_at locked_at locked_by attempt_count last_attempt_at next_attempt_at delivered_at failed_at abandoned_at last_error_code
● The dispatcher locks bounded batches and delivers to Inngest or other approved destinations. ● Consumers use event IDs and idempotency records because delivery may occur more than once. ● Persistent failures appear in Platform Health and can be manually resolved with audit history.
14.6 Example booking conﬁrmation transaction

1. Lock the Tutor Request, Booking and active hold. 2. Validate permissions, status, price, payment window and conflict state. 3. Insert or activate the final tutor-time reservation. 4. Confirm the Booking and finalise snapshots.

<!-- page 25 -->

5. Reserve package or credit value and create the Commission Entry. 6. Activate or update the Tutor-Student Relationship. 7. Close competing Tutor Requests and release competing holds. 8. Write transition, audit, booking.confirmed event and outbox entry. 9. Commit. Notifications and provider follow-up occur asynchronously.
6. Search, indexes and derived views
   15.1 Indexing rules
   ● Indexes serve defined product queries and constraints. ● Composite indexes match actual filter and sort order. ● Partial indexes focus on active records. ● GiST supports range conflict detection. ● GIN supports approved full-text and selected JSON use. ● Important foreign keys are indexed deliberately. ● Duplicate or speculative indexes are avoided.
   15.2 Major query paths
   Area Primary indexed access Tutor discovery Public visibility, subject, year level, format, location, price, capacity, trial, rating and organisation. Bookings Family, student or tutor plus status and scheduled start. Calendar Tutor plus active timestamp range, hold expiry and source record. Student timeline Student, subject, event type, visibility and event date. Homework Student or tutor plus status and due date. Payments Tutor, family, Booking, status, due date, reference and billing cycle. Commission Tutor, billing cycle, status, Booking, Lesson and rule version. Support Assigned manager, status, priority, country, organisation and due date. Audit Entity, actor, correlation ID, category and occurred date.
   15.3 Public tutor search
   public.public_tutor_search is a permission-safe projection containing approved public fields only. Search identifies eligible tutors; matching ranks suitable tutors.
   15.4 Full-text search
   Initial PostgreSQL full-text search supports approved tutor biographies, teaching approaches, subjects, Services, public resources, help content and authorised internal records. Restricted content is never copied into broadly accessible search vectors.
   15.5 Derived timeline and health views
   ● Student Timeline projections combine Lessons, progress, homework, goals, assessments, concerns and tutor changes without replacing source records. ● Platform Health views detect Booking-reservation mismatches, payment-ledger gaps, expired holds, outbox failures, permission inconsistencies and migration discrepancies. ● Materialised views require a refresh strategy, maximum staleness, recovery process and permission model.
   15.6 Search abstraction
   Application code uses internal repository interfaces such as TutorSearchRepository and BookingSearchRepository so infrastructure can change without rewriting eligibility or access rules.

<!-- page 26 -->

16. Migration staging, validation and exceptions
    16.1 Migration principle
    DarshaTutor data enters isolated migration staging tables. It is extracted, classified, validated, normalised, mapped, transformed, imported and reconciled. The new schema is never weakened to accept malformed legacy data.
    16.2 Migration tables
    migration.source_records migration.source_files migration.source_relationships migration.mapping_records migration.transformed_records migration.migration_batches migration.migration_exceptions migration.validation_results migration.import_results migration.reconciliation_results migration.cutover_checkpoints
    16.3 Source preservation
    Each legacy record has an unchanged restricted source representation with source table, source key, payload, checksum, extraction time and source update time. Transformations occur in separate versioned records.
    16.4 Migration decisions
    Feature decision Data decision Reuse Migrate Adapt Transform Rebuild Replace or map to new model Retire Archive only or exclude with approval
    16.5 Mapping
    Mapping records preserve legacy source keys and new target IDs for Users, Students, Tutors, Bookings, Payments, Lessons and files. New Studdy UUIDs and references are generated under the new system; legacy identifiers remain external mappings.
    16.6 Validation layers
    Layer Examples Structural Required fields, data types, dates, currency, statuses, identifiers and files. Relationship Valid User, Family, Student, Tutor, Booking, Payment, Lesson, Service and subject links. Business rule Date order, currency match, explainable payment and commission, valid lifecycle and balances. Permission and privacy Student photo privacy, restricted notes, storage zone, visibility and authentication separation. Financial Payments, refunds, outstanding balances, packages, credits, commission, earnings and opening ledger balances.

<!-- page 27 -->

16.7 Migration exceptions
migration.migration_exceptions id reference migration_batch_id source_record_id exception_type_code severity_code status_code field_name description safe_context proposed_resolution_code assigned_user_id created_at resolved_at resolved_by_user_id resolution_comment target_entity_id
Severity Meaning Warning Record can migrate safely, but a non-material issue should be reviewed. Blocking Record cannot import until corrected or explicitly resolved. Critical Identity, financial, safeguarding or integrity issue blocks the relevant batch or cutover. ● Material fields never receive guessed silent defaults. ● Manual resolutions preserve decision maker, reason, mapping version and audit history. ● Duplicate detection produces candidates and requires review unless confidence is sufficiently strong. ● Scripts are idempotent through stable source keys, mappings and existing-target detection.
16.8 File migration 10. Inventory and classify legacy files. 11. Calculate checksums and validate readability. 12. Scan files and assign the correct storage zone. 13. Copy using internal identifiers. 14. Validate target checksum and size. 15. Link to target entities and retention rules. 16. Reconcile counts and exceptions.
16.9 Authentication migration
Business identity migration remains separate from credential migration. Existing supported authentication identities may be linked; otherwise users receive account activation or reset flows. Passwords are not copied without a secure supported mechanism.
16.10 Batch reporting
Every migration batch reports source, validated, imported, skipped, warning and exception counts; mappings; financial and file reconciliation; runtime; code and mapping versions; and failure summary. 17. Cutover, reconciliation, rollback and retirement
17.1 Migration sequence 17. Source audit 18. Mapping design 19. Extractor and transformation development 20. Development migration 21. Trial migration and exception remediation 22. Staging rehearsal 23. Financial and file reconciliation

<!-- page 28 -->

24. User acceptance testing 25. Final cutover rehearsal 26. Go or no-go approval 27. Source freeze or change capture 28. Final migration and validation 29. Access verification 30. Go-live and intensive monitoring 31. Post-cutover reconciliation 32. DarshaTutor read-only period 33. Formal retirement
    17.2 Trial and staging migrations
    ● Development uses synthetic or anonymised data. ● Staging mirrors production schema, provider separation, deployment and migration commands. ● Trial runs test relationships, files, current bookings, finances, access, runtime and exception handling.
    17.3 Reconciliation gates
    Gate Required checks Record counts Users, Students, Families, Tutors, Bookings, Lessons, Payments, Homework, files and relationships. Relationships Every active record has valid expected parent and related records. Financial Payments, refunds, balances, packages, credits, commission, earnings and provider totals reconcile. Files Counts, checksum, size, zone, scan result, links, retention and visibility reconcile. Access Parents, tutors, students, managers, historical access and restricted records behave correctly. Cutover gate Any unresolved material financial discrepancy, widespread access failure, missing active Bookings, duplicate payments, major file loss or Row Level Security failure blocks go-live.
    17.4 User acceptance testing
    ● Parent: sign in, view students, Bookings, payments, homework and progress, then request a Booking. ● Tutor: sign in, view students, availability, Bookings, direct payments, Lessons, Earnings and create a Service draft. ● Manager and Owner: review applications, migration exceptions, booking corrections, reconciliation, access, audit and Platform Health.
    17.5 Cutover approach
    A controlled source freeze is preferred where operationally acceptable. Change capture may be used where required, but must identify and apply all post-extract deltas.
    17.6 Go or no-go approval
    ● Critical migrations complete. ● Blocking exceptions resolved. ● Financial and file reconciliation passed. ● Access and core journeys passed. ● Backups and rollback available. ● Production providers, secrets, monitoring and support communications ready. ● Platform Owner gives final approval.
    17.7 Rollback
    Rollback criteria and steps are defined before cutover. Rollback may stop Studdy writes, preserve evidence, disable provider actions, restore DarshaTutor write access where safe, restore the pre-cutover backup, notify users and schedule another attempt.

<!-- page 29 -->

17.8 Post-cutover monitoring
● Authentication and permission failures ● Missing or duplicate records ● Booking conflicts ● Payment, webhook and ledger failures ● Commission and balance discrepancies ● Outbox and background-job failures ● File access errors ● Migration exceptions and support contacts
17.9 DarshaTutor retirement
DarshaTutor remains controlled read-only for a defined period, then retires after stable reconciliation, successful operation, final backup, revoked old secrets, disabled old webhooks and audited approval. The old repository remains preserved as a historical reference. 18. Implementation deﬁnition of done
A database module or migration slice is complete only when all applicable requirements below are satisfied. ● Table ownership and schema are explicit. ● Primary keys, public references and uniqueness rules are defined. ● Foreign keys and deletion behaviour are deliberate. ● Statuses, effective dates, archival, retention and concurrency are implemented. ● Versioning or snapshots preserve historical terms where required. ● Server command, transaction and locking behaviour are defined. ● Row Level Security classification and policies exist. ● Sensitive tables are default-deny or server-only. ● Indexes support real query paths and constraints. ● Audit, transition, event and outbox writes are included for consequential actions. ● Financial movements balance and are immutable. ● Validation uses Zod at external and module boundaries. ● Unit, integration and permission tests cover success, conflict and denial paths. ● Migration mapping and exception behaviour are documented. ● Observability includes stable error codes and correlation IDs. ● Documentation and schema diagrams are updated.
18.1 Required automated checks
● New exposed tables fail CI if RLS is missing or unclassified. ● Migrations apply cleanly to an empty database and from the previous release. ● Schema drift is detected. ● Ledger posting tests prove balanced transactions. ● Range and uniqueness constraints reject conflicting or duplicate records. ● Permission tests verify cross-family, cross-student, cross-subject and restricted-data denial. ● Migration scripts are idempotent and produce reproducible reconciliation reports.
18.2 Initial implementation sequence 34. Shared extensions, identifiers, references and audit foundations 35. Identity, authentication links and role assignments 36. Families, Students and subject sections 37. Tutors, applications and verification 38. Tutor-Student Relationships and permissions 39. Services, availability, capacity and reservations 40. Discovery, requests, Bookings and recurring series 41. Lessons and learning records 42. Payments, ledger, commission, packages and credits 43. Notifications, support, files and shared models 44. Search projections, Platform Health and migration tooling

<!-- page 30 -->

Appendix A. Core status families
Family Meaning Draft Work exists but has not entered an active workflow. Pending Waiting for processing, review or another person. Active Operating normally. Paused Temporarily stopped while context is preserved. Restricted Some capabilities remain while others are blocked. Completed Expected workflow finished. Cancelled Workflow intentionally ended before completion. Archived Preserved but removed from routine active use.
Appendix B. Stable business error codes
VALIDATION_FAILED AUTHENTICATION_REQUIRED MFA_REQUIRED PERMISSION_DENIED RECORD_NOT_FOUND INVALID_TRANSITION BUSINESS_RULE_BLOCKED RESOURCE_CONFLICT RATE_LIMITED PROVIDER_UNAVAILABLE TEMPORARY_FAILURE DATA_INCONSISTENCY INTERNAL_ERROR
Appendix C. Key architectural constraints
● Domain packages do not import Next.js, React, Supabase clients, Drizzle implementations, Stripe, Inngest or provider SDKs. ● Database implements repository interfaces defined by the domain layer. ● Integrations implement provider interfaces defined by the domain layer. ● The browser never owns authoritative status, price, permission or financial decisions. ● Generated code is reviewed, tested and refactored into approved boundaries before trust.
Approval
Approved specification This document is the approved database and migration foundation for implementing Studdy Version 1.0. Material changes require an Architecture Decision Record, impact review and approval by the Platform Owner.
