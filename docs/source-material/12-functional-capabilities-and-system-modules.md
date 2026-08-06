# Functional Capabilities and System Modules

> **Source document 12 of the Studdy planning pack.**
> Extracted verbatim from `12Functional Capabilities and System Modules.pdf` on 7 August 2026.
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

Studdy Functional Capabilities and
System

Modules

Version: Draft 0.1
Product:

Studdy

Tagline:

The

platform

for

better

tutoring

1. Purpose
   This document translates Studdy’s approved product vision, user permissions and core
   journeys

into

a

structured

capability

map.

It defines:
● Major product modules ● Core system responsibilities ● Shared platform services ● Administrative controls ● Data ownership boundaries ● Future-ready architecture ● Organisational and manager capabilities ● Marketplace and learning-system capabilities ● Reporting, notifications and integrations
This document should guide product design, technical architecture, database planning,
interface

design,

delivery

sequencing

and

future

Fable

context.

2. Architectural Principles
   Central student record
   Each student should have one permanent profile containing all learning history.
   Subject, tutor, assessment and service information should be organised within that profile
   rather

than

creating

disconnected

student

records.

Modular architecture
Each major product area should operate as a defined module with clear responsibilities and
interfaces.

Configurable operations
Operational rules should be configurable through admin interfaces wherever practical.
Rules that are likely to change should not be hard-coded.
Inheritance and overrides
Settings should inherit through structured levels:

<!-- page 2 -->

Global → country or region → platform programme → organisation → tutor → service → booking exception
The most specific valid setting should apply.
Locked platform rules
Admin should be able to lock safeguarding, legal, privacy, audit and other platform rules that lower-level users cannot override.
Traceability
Material changes should preserve:
● Original value ● New value ● User or manager responsible ● Date and time ● Reason ● Approval history ● Effective period
International readiness
New Zealand should be the first active operating configuration, but the underlying architecture should support other countries and regions.
Analytics readiness
All major modules should emit structured analytics events from the beginning.
Minimum necessary access
Access should depend on role, scope, relationship and purpose.

Module One: Public Website and Discovery 3. Public Website
The public website should support:
● Homepage ● How Studdy works ● Tutor discovery ● Public tutor profiles ● Tutor application entry ● Organisation information ● Trust and safety information ● Pricing explanation

<!-- page 3 -->

● Resource marketplace discovery ● Help centre ● Legal and privacy pages
The principal parent-facing call to action is:
Find a Tutor
The principal tutor-facing call to action is:
Join as a Tutor 4. Public Matching Journey
Visitors should be able to begin matching without registering.
The public matching module should support:
● Student year level ● Multiple subjects ● Learning needs ● Goals ● Budget ● General availability ● Lesson format ● Tutor-style preferences ● Exclusions ● Ranked priorities ● Language or cultural preferences
The visitor should receive a useful matching summary before account creation. 5. Public Tutor Profiles
Limited public profiles may show:
● Tutor name ● Profile photo ● Subjects ● Year levels ● General pricing ● General availability ● Rating ● Verification indicators ● Short biography ● Teaching-style summary ● Trial availability ● Organisation affiliation
Exact availability and full profile details should require sign-in.

<!-- page 4 -->

Module Two: Identity, Accounts and Roles 6. Unified User Identity
Each person should have one primary identity that may hold several roles.
Possible roles include:
● Tutor ● Parent or guardian ● Dependent student ● Independent student ● Supporter ● Organisation member ● Organisation manager ● Platform Manager ● Platform Owner
Users should switch between role-specific workspaces. 7. Authentication
Authentication should support:
● Email login ● Passwordless login where appropriate ● Passkeys later ● Parent-managed student access ● Student username and PIN later ● Multi-factor authentication ● Role-sensitive security controls ● Session management ● Device history ● Recovery processes 8. Role and Permission Engine
The permission engine should support:
● Role-based access ● Scope-based access ● Relationship-based access ● Country and region scope ● Organisation scope ● Subject scope ● Financial limits ● Temporary elevated access ● Approval authority ● Impersonation rights ● Export rights

<!-- page 5 -->

● Data visibility restrictions

Module Three: Family and Student Management 9. Family Accounts
Family accounts should support:
● Primary guardian ● Optional additional guardians later ● Multiple students ● Saved locations ● Payment methods ● Favourite tutors ● Family-wide notifications ● Parent-private notes ● Student permissions ● Tutor relationships 10. Central Student Profile
Each student should have one permanent overall profile.
The profile should contain:
● Personal and educational information ● Subject sections ● Goals ● Skills ● Progress ● Homework ● Assessments ● Important dates ● Tutor contributions ● Concerns ● Resources ● Lesson history ● Evidence ● Parent and student comments ● Support arrangements 11. Subject Sections
Each Student Profile should contain subject-specific sections.
A subject section may include:
● Formal curriculum standards

<!-- page 6 -->

● Tutor-created skills ● Subject-specific goals ● Assessments ● Homework ● Resources ● Tutor observations ● Progress evidence ● Important dates ● Contributing tutors 12. Student Profile Lifecycle
The module should support:
● Profile creation ● Dependent-to-independent transition ● Archiving ● Restoration ● Family transfer ● Duplicate-profile merging ● Tutor removal ● Historical access ● Retention controls

Module Four: Curriculum, Skills and Progress 13. Curriculum Frameworks
Studdy should support formal frameworks such as:
● New Zealand Curriculum ● NCEA standards ● Future international curricula ● Organisation-specific frameworks
Admin should be able to activate frameworks by country or region. 14. Custom Skills
Tutors should be able to create custom skills alongside formal standards.
Custom skills may include:
● Skill name ● Description ● Progress scale ● Suggested evidence ● Prerequisite skills

<!-- page 7 -->

● Curriculum links ● Recommended assessments ● Recommended resources 15. Reusable Skill Frameworks
Tutors should be able to build reusable skill frameworks.
They may:
● Reuse them across students ● Duplicate them ● Adapt them ● Share them privately ● Share them with an organisation ● Publish them to the marketplace ● Sell them ● Link them to formal curriculum standards
Historical student records should preserve the version used at the time. 16. Progress Records
Progress should be:
● Additive ● Attributable ● Subject-specific ● Skill-specific ● Evidence-backed ● Traceable by tutor ● Viewable in simple and detailed modes
One tutor should not silently overwrite another tutor’s judgement.

Module Five: Tutor Onboarding and Verification 17. Tutor Application
Tutor applicants should be able to:
● Create an account ● Complete an application ● Submit identity details ● List subjects and year levels ● List qualifications ● Provide references ● Upload a trial lesson

<!-- page 8 -->

● Select service areas ● Agree to platform rules ● Track application status 18. Tutor Review Workflow
Managers should be able to:
● Review applications ● Verify identity ● Review references ● Review qualifications ● Review trial lessons ● Request more information ● Interview applicants ● Approve ● Reject ● Approve with conditions ● Add verification labels 19. Tutor Status
Possible tutor statuses include:
● Applicant ● Under review ● More information required ● Approved ● Active ● Unlisted ● Restricted ● Suspended ● Departed

Module Six: Tutor Profiles and Services 20. Tutor Profile Management
Tutors should manage:
● Biography ● Profile photo ● Teaching style ● Subjects ● Year levels ● Qualifications ● Verification indicators ● Introductory video ● Lesson format

<!-- page 9 -->

● Locations ● Availability ● Ratings ● Organisation affiliations 21. Configurable Services
Each tutor service should be a distinct configurable offering.
Examples include:
● Year 10 mathematics online ● Year 13 calculus in person ● Thirty-minute trial ● Exam-preparation package ● Homework-support session ● Group revision class ● Assessment review
Each service may configure:
● Subject ● Year level ● Format ● Duration ● Price ● Capacity ● Trial terms ● Minimum notice ● Response deadline ● Cancellation settings ● Payment methods ● Package eligibility ● Location rules ● Student eligibility ● Approval or instant booking 22. Service Duplication
Tutors should be able to duplicate an existing service.
The duplicate should:
● Receive a new service ID ● Copy existing settings ● Remain unpublished ● Allow editing before publication 23. Profile Visibility
Tutor visibility states should include:
● Public and recommended ● Public with reduced visibility

<!-- page 10 -->

● Recommendations paused ● Unlisted ● Existing students only ● Fully suspended

Module Seven: Matching and Recommendations 24. Matching Engine
The matching engine should consider:
● Subject ● Year level ● Learning need ● Availability ● Location ● Price ● Experience ● Rating ● Teaching style ● Format ● Language ● Tutor capacity ● Tutor responsiveness ● Parent priorities ● Parent exclusions 25. Ranked Shortlists
Studdy should show several suitable tutors rather than one absolute winner.
Each result should include a light explanation of why it matched. 26. Recommendation Fairness
The engine should support:
● New-tutor exposure ● Availability weighting ● Reliability weighting ● Quality safeguards ● Admin visibility adjustments ● Organisation rules ● Regional rules ● Sponsored or promoted placement only if clearly labelled later

<!-- page 11 -->

27. Matching Administration
    Admin should be able to:
    ● Adjust recommendation visibility ● Pause recommendations ● Assign tutors manually ● Correct availability ● View matching explanations ● Review recommendation outcomes ● Preview rule changes

Module Eight: Tutor Codes, Invitations and Referrals 28. Tutor Identity Codes
Each tutor should have:
● Permanent tutor code ● Permanent private profile link 29. Custom Invitation Codes
Tutors should be able to create codes for:
● Individual families ● Schools ● Community groups ● Promotions ● Subjects ● Services ● Existing-family referrals ● Referral partners
Code types may include:
● Single-use ● Single-family ● Reusable ● Limited-use ● Expiring 30. Relationship Attribution
Source classification should belong to each tutor–family relationship.
A family may be tutor-brought for one tutor and marketplace-sourced for another.

<!-- page 12 -->

31. Referral Programme
    The referral module should support:
    ● Tutor referral codes ● Family referral codes later ● Tutor commission credits ● Family lesson credits ● Eligibility rules ● First-paid-lesson activation ● Expiry ● Maximum balance ● Pending rewards ● Revocation ● Misuse investigation ● Referral ledger

Module Nine: Availability and Capacity 32. Tutor Availability
Tutors should manage:
● Weekly availability ● One-off availability ● Holidays ● Breaks ● Minimum booking notice ● Travel buffers ● Online and in-person capacity ● Subject-specific capacity ● Year-level capacity 33. Segment Capacity
Tutors should be able to accept or pause new students by:
● Subject ● Year level ● Format ● Service ● Location ● Student type 34. Waiting Lists
Waiting lists should support:
● Preferred days

<!-- page 13 -->

● Preferred times ● Subject ● Format ● Tutor ● Priority order ● Invitation workflow ● Expiry ● Multiple waiting lists 35. Calendar Protection
Pending and confirmed bookings should block availability appropriately.
Recurring bookings should reserve future slots for a configurable rolling period.

Module Ten: Booking Management 36. Booking Requests
The booking module should support:
● Standard lessons ● Trial lessons ● Recurring lessons ● Group sessions ● Packages ● Assessments ● Tutor acceptance ● Parent withdrawal ● Request expiry ● Payment authorisation 37. Booking Statuses
Possible statuses include:
● Draft ● Requested ● Awaiting payment ● Awaiting tutor acceptance ● Accepted ● Confirmed ● Declined ● Withdrawn ● Expired ● Rescheduled ● Cancelled ● Completed ● Disputed

<!-- page 14 -->

38. Recurring Lessons
    Recurring bookings should support:
    ● Weekly and custom frequency ● Series start and end ● Ongoing series ● Pausing ● Resuming ● Ending ● One-session changes ● Future-session changes ● Price-change approval ● Slot protection
39. Admin Booking Controls
    Admin should be able to:
    ● Create bookings ● Correct bookings ● Assign tutors ● Override selected rules ● Transfer bookings ● Cancel bookings ● Recalculate prices ● Preserve audit history

Module Eleven: Group Lessons and Cohorts 40. Group Lesson Architecture
Studdy should support group lessons from the beginning, even if public launch occurs later. 41. Fixed Cohorts
Fixed cohorts should support:
● Same students across a programme ● Recurring schedule ● Minimum and maximum capacity ● Cohort price ● Per-student price ● Shared programme ● Individual learning records ● Cohort resources ● Attendance tracking

<!-- page 15 -->

42. Drop-In Sessions
    Drop-in groups should support:
    ● Session-specific participants ● Capacity by date ● Per-session booking ● Waiting list ● Revision workshops ● Homework support ● Individual progress updates
43. Capacity Visibility
    Parents should see:
    ● Spaces available ● One place remaining ● Full ● Waiting list available ● Minimum enrolment not yet reached
    Participant identities must remain private.
44. Cohort Changes
    Tutors should be able to add or remove students after a cohort starts.
    The module should handle:
    ● Pro-rated pricing ● Parent approval ● Remaining sessions ● Catch-up access ● Refunds or credits ● Capacity rules ● Privacy boundaries ● Individual history preservation
45. Optional Catch-Up
    Parents may purchase optional catch-up support, including:
    ● One-to-one lesson ● Group catch-up ● Recorded module ● Tutor-reviewed work ● Catch-up pack

<!-- page 16 -->

Module Twelve: Payments, Payouts and Commission 46. Payment Methods
Studdy should support:
● Stripe ● Bank transfer ● Cash ● Future approved regional methods
Marketplace-sourced relationships should use Stripe by default.
Tutor-brought relationships may use direct payment. 47. Stripe Payments
Stripe should handle:
● Parent payment ● Payment authorisation ● Tutor payout ● Studdy fee deduction ● Refunds ● Credits ● Chargebacks ● Failed payments ● Payout status 48. Direct Payments
For bank transfer and cash, Studdy should support:
● Payment instructions ● Parent says paid ● Tutor confirmation ● Partial payments ● Overdue status ● Waivers ● Disputes ● Bulk reconciliation ● Commission calculation 49. Commission Engine
Commission should move through:
● Estimated ● Reserved ● Chargeable

<!-- page 17 -->

● Adjusted ● Owed ● Paid
Commission should be calculated from the booking and not depend on tutor payment confirmation. 50. Tutor Commission Collection
Direct-payment tutors should choose:
● Weekly collection ● Fortnightly collection
They must keep a payment method on file.
The system should support:
● Automatic collection ● Retries ● Manual payment ● Failed-payment alerts ● Booking restrictions ● Payment plans ● Admin waivers ● Admin adjustments 51. Tutor Earnings
The tutor dashboard should show estimated take-home earnings after:
● Studdy fees ● Stripe fees ● Credits ● Refunds ● Adjustments
Tutors may hide the earnings card. 52. Refunds and Credits
The system should support:
● Full refund ● Partial refund ● Studdy credit ● Tutor-specific credit ● Package-value transfer ● Admin adjustment ● Dispute hold

<!-- page 18 -->

Module Thirteen: Packages and Pricing 53. Packages
Tutors should be able to offer:
● Optional packages ● Required packages ● Upfront packages ● Per-lesson payment ● Discounted lesson bundles ● Cohort packages 54. Package Terms
Packages should show:
● Number of lessons ● Total price ● Effective lesson price ● Expiry ● Transfer rules ● Refund rules ● Tutor specificity ● Eligible services 55. Package Transfer
Where transfer is allowed, the unused monetary value should transfer rather than the number of lessons.
General marketplace transfer should be limited to approved circumstances.

Module Fourteen: Lesson Delivery 56. Lesson Formats
Studdy should support:
● Online lessons ● In-person lessons ● Group lessons ● Future embedded lesson room ● External video-platform integration 57. Lesson Room

<!-- page 19 -->

The future lesson room may include:
● Video ● Shared notes ● Whiteboard ● Screen sharing ● File sharing ● Recording status ● Lesson timer ● Homework assignment ● Resource sharing ● Safety controls 58. Recording and Transcription
Online lessons should be recorded and transcribed by default, subject to approved exceptions.
The module should manage:
● Consent ● Recording status ● Raw recording ● Transcript ● Retention ● Access ● Deletion ● Approved exceptions 59. Lesson Completion
Lessons should complete automatically unless disputed.
The system should separately track:
● Lesson completion ● Attendance ● Duration ● Payment ● Commission ● Dispute status

Module Fifteen: AI Lesson Summaries 60. AI Drafting
Studdy may generate:
● Lesson overview ● Topics covered

<!-- page 20 -->

● Progress observations ● Challenges ● Homework suggestions ● Follow-up actions 61. Tutor Approval
AI summaries must be approved by the tutor before publication.
Tutors should be able to:
● Edit ● Remove content ● Add context ● Mark parent-only sections ● Add homework ● Add goals ● Approve publication 62. Summary Timing
Summaries should normally be available within 24 hours.
The module should support:
● Summary being prepared ● Overdue task ● Extended completion time ● Version history ● Parent and student comments ● Resolved and reopened questions

Module Sixteen: Homework and Student Actions 63. Homework
Homework should support:
● Instructions ● Due date ● File upload ● Written response ● Links ● Assigned resources ● Completion status ● Tutor review ● Parent visibility ● Student submission

<!-- page 21 -->

64. Student Actions
    Student actions may be created by:
    ● Tutor ● Parent ● System ● Student
    Actions may be:
    ● Date-based ● Before next lesson ● Ongoing ● Open-ended
    Students should be able to mark actions complete.
65. Student-Friendly Dashboard
    The student workspace should show:
    ● Do next ● Coming up ● Keep working on ● Next lesson ● Homework ● Important test ● Recent feedback

Module Seventeen: Goals and Concerns 66. Goals
Goals may be created by:
● Tutor ● Parent ● Student ● System
The module should support:
● Official goals ● Student-created goals ● Linked goals ● Suggested changes ● Progress evidence ● Completion ● Archiving

<!-- page 22 -->

67. Concerns
    Tutors should be able to create concerns.
    Concerns should support:
    ● Parent visibility ● Student visibility restrictions ● Parent comments ● Urgent escalation ● Resolution ● Reopening ● History ● Admin access
68. Private Notes
    The system should distinguish:
    ● Tutor internal notes ● Parent-private notes ● User-visible comments ● Manager internal notes ● Safeguarding records ● Formal decisions

Module Eighteen: Assessments 69. Assessment Types
Studdy should support:
● Live assessment ● Independent assessment ● Tutor-created assessment ● Studdy-created assessment ● Marketplace assessment ● Assessment packages 70. Assessment Workflow
The module should support:
● Parent request ● Tutor acceptance ● Instant purchase where enabled ● Student completion ● Tutor marking ● AI draft report

<!-- page 23 -->

● Tutor review ● Parent report ● Progress updates ● Resource recommendations ● Tutor matching impact 71. Assessment Marketplace
Tutors should be able to browse and purchase assessments.
Paid assessments should follow marketplace quality controls.

Module Nineteen: Resource Marketplace 72. Resource Types
Resources may include:
● Worksheets ● Videos ● Lesson plans ● Revision packs ● Assessments ● Homework templates ● Skill frameworks ● Teaching guides ● Interactive materials 73. Visibility
Resources may be:
● Private ● Student-specific ● Cohort-specific ● Tutor-shared ● Organisation-only ● Free marketplace ● Paid marketplace ● Public preview 74. Marketplace Review
Paid resources require initial admin approval.
Review may include:
● Originality ● Quality

<!-- page 24 -->

● Accuracy ● Audience suitability ● Copyright risk ● Curriculum claims ● Pricing ● Attribution ● Licence terms ● Royalty allocation 75. Versions and Forking
Resources should support:
● Version history ● Attribution ● Editable copies ● Forking ● Meaningful-value requirements ● Contributor agreements ● Reviews ● Reporting 76. Multiple Contributors
Resources should support:
● Primary creator ● Co-authors ● Editors ● Reviewers ● Organisation ownership ● Platform share ● Royalty percentages ● Version-specific agreements
Changes affecting attribution, ownership, royalties or licences should require affected contributor approval. 77. Resource Royalties
The system should:
● Validate total splits ● Calculate earnings ● Allocate refunds proportionally ● Preserve version-specific splits ● Show contributor earnings ● Support admin dispute resolution

Module Twenty: Ratings and Reviews

<!-- page 25 -->

78. Tutor Ratings
    Ratings should support:
    ● Public overall rating ● Teaching quality ● Communication ● Reliability ● Subject-specific rating where sufficient data exists ● Moderation ● Disputes ● Review history
79. Student Feedback
    Students may provide lightweight private feedback.
80. Resource Reviews
    Marketplace resources should support:
    ● Rating ● Written review ● Verified purchase indicator ● Reporting ● Specialist review ● Moderation

Module Twenty-One: Messaging and Notifications 81. Messaging
The messaging module should support:
● Parent–tutor communication ● Student communication where permitted ● Organisation communication ● Support communication ● Lesson-specific threads ● Case-specific threads ● Attachments ● Moderation access ● Audit history 82. Central Notification Engine

<!-- page 26 -->

All modules should send notification events to one central rules engine.
The engine should support:
● In-platform notifications ● Email ● Future mobile notifications ● Future SMS ● Mandatory alerts ● Optional reminders ● Digests ● Quiet hours ● Escalations ● Role-specific rules ● Regional rules ● Notification preferences 83. Notification Rules
Notification rules should define:
● Trigger ● Recipient ● Channel ● Priority ● Delay ● Reminder schedule ● Escalation ● User preference ● Mandatory status ● Region

Module Twenty-Two: Support and Case Management 84. Support Cases
Cases should support:
● Case reference ● Case type ● Status ● User-visible updates ● Internal notes ● Evidence ● Linked bookings ● Linked payments ● Linked users ● Assigned manager

<!-- page 27 -->

● Due date ● Risk level ● Escalation ● Resolution 85. Case Statuses
User-visible statuses may include:
● Received ● Under review ● Waiting for you ● Waiting for another party ● Decision made ● Resolved ● Reopened ● Closed 86. Evidence
Users should be able to upload:
● Screenshots ● Receipts ● Payment evidence ● Documents ● Images ● Statements
Evidence should be scanned, attributed and retained appropriately. 87. Restricted Case Sections
Cases may include sections restricted to:
● Safeguarding ● Finance ● Legal ● Identity verification ● Platform Owner ● Other specialist roles 88. Case Merging
Managers should be able to merge related cases into one master case while preserving original references and history. 89. Support Feedback
Users may optionally rate support after resolution.

<!-- page 28 -->

Module Twenty-Three: Organisations and Schools 90. Organisation Accounts
Organisation accounts may represent:
● Tutoring companies ● Schools ● Learning centres ● Charities ● Community organisations ● Specialist programmes 91. Organisation Capabilities
Organisations should be able to:
● Invite tutors ● Remove tutors ● Assign tutors ● Create services ● Manage programmes ● Set pricing rules ● Set commission rules ● Manage resources ● Manage cohorts ● View aggregate reports ● Manage organisation users ● Set internal approval workflows 92. Tutor Affiliation
Tutors should retain individual identities while affiliated with one or several organisations.
The system should distinguish:
● Tutor-owned service ● Organisation-owned service ● Tutor-delivered organisation service ● Independent service ● Organisation affiliation 93. Organisation Rules
Organisations may set mandatory:
● Pricing ● Discounts ● Packages

<!-- page 29 -->

● Payment methods ● Internal commission ● Service requirements
Tutors may request exceptions. 94. Private Organisation Marketplace
Organisations may operate private resource libraries or marketplaces for their tutors and students.

Module Twenty-Four: Platform Owner and Manager Administration 95. Platform Owner
Studdy should initially have one Platform Owner.
The Platform Owner controls:
● Platform-wide settings ● Manager permissions ● Financial settings ● Commission rules ● Legal rules ● Safeguarding configuration ● Country activation ● Owner-only overrides ● Audit access ● Emergency controls ● Ownership transfer 96. Platform Managers
Managers may specialise in:
● Tutor onboarding ● Support ● Finance ● Safeguarding ● Content ● Marketplace ● Organisations ● Technical operations 97. Custom Manager Roles
The Platform Owner should be able to create custom manager roles.

<!-- page 30 -->

Roles should define:
● Capabilities ● Data visibility ● Country or region scope ● Organisation scope ● Subject scope ● Financial authority ● Approval rights ● Impersonation rights ● Export rights ● Temporary access ● Alert requirements 98. Role and Scope
Manager authority should depend on both:
● What the manager can do ● Where and to whom they may do it 99. Temporary Elevated Access
The Platform Owner may grant temporary access to an owner-only capability.
The grant should:
● Specify capability ● Specify scope ● Record reason ● Set expiry ● Log activity ● Expire automatically 100. Impersonation
The Platform Owner may impersonate any user.
Managers may impersonate only users within their permitted role and scope.
Impersonation should display a clear banner and preserve a full audit trail.

Module Twenty-Five: Manager Tasks and Workflow 101. Manager Next Required Action

<!-- page 31 -->

Managers should have a Next Required Action dashboard ranked by urgency, risk and deadline. 102. Internal Tasks
Managers should be able to:
● Create tasks ● Assign tasks ● Reassign tasks ● Set due dates ● Set priority ● Link cases and users ● Add internal notes ● Escalate ● Close tasks 103. Task Templates
Managers should be able to create reusable templates and checklists.
Templates should support:
● Required steps ● Evidence requirements ● Default role ● Due dates ● Risk level ● Approval path ● Escalation ● Communication templates ● Closure criteria ● Version history 104. Escalation
Overdue tasks may escalate through:

1. Assignee reminder 2. Team lead alert 3. Reassignment 4. Platform Owner escalation 5. High-risk overdue alert

Module Twenty-Six: Rules and Configuration 105. Configuration Hierarchy

<!-- page 32 -->

Settings should inherit through:
Global → country or region → platform programme → organisation → tutor → service → booking exception 106. Effective Value Display
The admin interface should show:
● Current effective value ● Source level ● Inherited or overridden status ● Locked status ● Change history ● Restore-default action 107. Scheduled Rules
Admin should be able to create temporary rules with:
● Start ● End ● Scope ● Priority ● Reason ● Automatic reversion ● Audit history 108. Rule Preview
Before activation, admin should see:
● Users affected ● Services affected ● Bookings affected ● Current values ● New values ● Conflicts ● Financial impact ● Notifications triggered 109. Draft and Approval Workflow
Rules should support:
● Draft ● Review ● Approval ● Rejection ● Scheduling ● Activation ● Rollback ● Version comparison

<!-- page 33 -->

Approval requirements should depend on risk.

Module Twenty-Seven: Audit, Security and Data Protection 110. Central Audit Log
Every manager action should be logged.
The log should support filtering by:
● Manager ● Role ● User ● Module ● Action ● Region ● Date ● Risk ● Impersonation ● Approval ● Original value ● New value 111. Sensitive Access
Sensitive-data access should require appropriate role and scope.
High-risk downloads should require a recorded purpose.
The highest-risk categories may require additional approval. 112. Data Minimisation
Exports and reports should mask or remove unnecessary personal information.
Possible controls include:
● Masked email ● Masked phone ● Hidden address ● Pseudonymised student ● Removed private notes ● Aggregated results ● Hidden safeguarding data 113. Retention and Deletion

<!-- page 34 -->

Retention should be configurable by:
● Data type ● Country ● Legal requirement ● Case type ● Account status ● Safeguarding requirement
Permanent deletion should remain an owner-level or tightly controlled action.

Module Twenty-Eight: Reporting and Analytics 114. Analytics Event Framework
Major actions should emit structured analytics events.
Events should support:
● Product usage ● Booking conversion ● Tutor performance ● Matching outcomes ● Payment health ● Lesson delivery ● Student engagement ● Marketplace activity ● Support performance ● Organisation activity 115. Operational Dashboards
Dashboards may include:
● Tutor onboarding ● Payment and commission ● Safeguarding ● Marketplace moderation ● Support workload ● Tutor reliability ● Booking conversion ● Organisation activity 116. Custom Dashboards
The Platform Owner should be able to:
● Select metrics

<!-- page 35 -->

● Apply filters ● Group data ● Save views ● Set thresholds ● Schedule delivery ● Assign visibility ● Export reports 117. Scheduled Reports
Saved dashboards may be sent by email.
The system should re-check permissions at generation time.
Delivery should stop automatically when the recipient loses access. 118. Alert Thresholds
The Platform Owner should be able to define alerts based on:
● Case volume ● Risk ● Response time ● Refund levels ● Commission failure ● Tutor cancellation ● Resource queue ● Safeguarding backlog ● Other custom thresholds

Module Twenty-Nine: Data Export 119. Scoped Exports
Managers may export only within their assigned role and scope. 120. Export Permission Levels
Roles may support:
● No export ● Aggregated report only ● PDF ● CSV ● Scheduled export ● Sensitive export ● Raw data export

<!-- page 36 -->

121. Export Controls
     Sensitive exports should support:
     ● Purpose declaration ● Audit logging ● Data masking ● Secure link ● Expiry ● Role revalidation ● Owner restriction

Module Thirty: Integrations 122. Central Integrations Module
All external systems should be managed through one integration layer.
Potential integrations include:
● Stripe ● Calendar systems ● Google Meet ● Future embedded video platform ● Email provider ● SMS provider ● Accounting platforms ● Identity verification ● Cloud storage ● Analytics systems 123. Integration Health
The module should show:
● Connection status ● Authentication status ● Last successful sync ● Last failed sync ● Webhook health ● Error logs ● Retry queue ● Credential expiry ● Regional availability ● Test mode 124. Integration Administration
Authorised users should be able to:

<!-- page 37 -->

● Connect ● Disconnect ● Reauthenticate ● Retry ● Pause ● Test ● Rotate credentials ● View logs ● View affected records ● Receive health alerts

Module Thirty-One: Shared Platform Services 125. Search
Studdy should provide structured search across:
● Tutors ● Students ● Families ● Bookings ● Resources ● Assessments ● Cases ● Organisations ● Transactions ● Audit records
Search results should respect permissions. 126. File Management
File services should support:
● Upload ● Virus scanning ● Preview ● Download control ● Storage limits ● Versioning ● Retention ● Access logging ● Regional storage requirements 127. Activity Timeline
Major entities should have a traceable activity timeline.

<!-- page 38 -->

Examples include:
● Student ● Tutor ● Booking ● Payment ● Case ● Resource ● Organisation 128. Status Engine
Studdy should use consistent, understandable statuses across modules. 129. Task Engine
A shared task engine should power:
● Tutor actions ● Parent actions ● Student actions ● Manager tasks ● Case actions ● Approval requests ● Escalations 130. Approval Engine
A shared approval engine should support:
● Tutor applications ● Paid resources ● Admin rules ● Refunds ● Commission adjustments ● Organisation exceptions ● High-risk actions ● Temporary elevated access

Module Thirty-Two: Future Capabilities 131. Mobile App
The architecture should support a future parent, tutor and student app. 132. Embedded Lesson Room
A Studdy-owned lesson room may later replace or supplement external video platforms.

<!-- page 39 -->

133. Student-to-Tutor Actions
     Students may later create structured requests or tasks for tutors.
134. Additional Payment Methods
     New payment methods may be enabled by region.
135. Automated Admin Enforcement
     Selected rules may later support configurable automatic restrictions or suspensions.
136. Multi-Guardian Families
     More complex guardian permissions may be introduced later.
137. Advanced Organisation Features
     Future organisation capabilities may include:
     ● Enterprise contracts ● Central billing ● Staff scheduling ● School data imports ● Programme reporting ● Organisation branding ● Custom domains

Module Thirty-Three: Capability Design Principles 138. Student continuity first
Student learning history should survive tutor changes, family changes and account transitions. 139. Tutor business ownership
Tutors should control their services, availability, prices and teaching processes within platform rules. 140. Parent clarity
Parents should understand what is happening, what is required and what they are paying for.

<!-- page 40 -->

141. Student simplicity
     Student interfaces should prioritise learning rather than administration.
142. Operational configurability
     Rules should be adjustable through admin settings without routine code changes.
143. Owner control with delegated management
     The Platform Owner retains ultimate authority while managers receive limited, scoped capabilities.
144. Privacy by design
     Users and managers should see only the data necessary for their role and purpose.
145. Automation with accountable review
     Routine work should be automated, while high-risk decisions retain appropriate human oversight.
146. Auditability
     Material actions, exceptions and changes should remain traceable.
147. International expansion
     Countries should be activated through configuration rather than platform reconstruction.
148. Shared engines over duplicated logic
     Notifications, tasks, approvals, analytics, permissions, status and integrations should be central platform services used by all modules.
