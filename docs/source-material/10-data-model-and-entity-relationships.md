# Data Model and Entity Relationships

> **Source document 10 of the Studdy planning pack.**
> Extracted verbatim from `10Data Model and Entity Relationships.pdf` on 7 August 2026.
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

Studdy Data Model and Entity
Relationships

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
   This document defines Studdy’s core data model, permanent records, ownership boundaries
   and

entity

relationships.

It translates the approved product principles, permissions, user journeys, functional
capabilities

and

information

architecture

into

a

structured

model

for:

● Database architecture ● API design ● Authentication and permissions ● Financial ledgers ● Student learning records ● Tutor operations ● Organisation management ● Support and administration ● Auditability ● Reporting and analytics ● Future international expansion
This document describes the conceptual model. Exact table names, indexes, storage
technologies

and

database

implementation

choices

may

be

refined

during

technical

design.

Part One: Data Modelling Principles 2. Permanent Identity
Core people, relationships and business records should use permanent internal identifiers.
Records should not be duplicated merely because a person changes role, a tutor changes
pricing

or

a

student

changes

family

status.

3. One Person, One User Identity
   Every person should have one permanent User record.
   Role-specific profiles and memberships should attach to that User record.
   A person may simultaneously be:

<!-- page 2 -->

● Tutor ● Parent ● Student ● Supporter ● Organisation member ● Platform Manager ● Platform Owner 4. Historical Preservation
Past agreements and activity must not be silently rewritten when current settings change.
Studdy should preserve:
● Booking snapshots ● Service versions ● Rule versions ● Policy versions ● Pricing breakdowns ● Status history ● Financial ledger entries ● Record versions ● Permission history ● Consent history 5. Soft Deletion by Default
Records should normally be archived, deactivated, anonymised or soft-deleted rather than physically removed.
Physical deletion should occur only where:
● Required by an applicable retention rule ● Required by a valid privacy request ● Approved by an authorised owner-level process ● No legal, financial, audit or safeguarding hold applies 6. Immutable Financial History
Original financial movements should not be edited.
Corrections should use:
● Reversal entries ● Adjustment entries ● Replacement allocations ● Credit entries ● Refund entries 7. Explicit Relationships
Important relationships should use dedicated entities rather than unstructured fields.

<!-- page 3 -->

Examples include:
● Family Membership ● Tutor–Student Relationship ● Organisation Membership ● Supporter Relationship ● Payment Allocation ● Permission Grant ● Conversation Participant 8. Shared Cross-Platform Models
Studdy should use shared models for common capabilities where practical.
Examples include:
● Comment ● Task ● File ● Saved Item ● Preference ● Record Version ● Status History ● Domain Event ● Entity Link 9. Specialised Models for Business Logic
A generic link should not replace a specialised entity where the relationship contains significant rules or lifecycle behaviour.
For example, Tutor–Student Relationship should remain specialised because it contains:
● Relationship source ● Subjects ● Permissions ● Payment rules ● Status ● History 10. International Readiness
Country and region should be explicit where they materially affect:
● Currency ● Tax ● Consent ● Retention ● Safeguarding ● Curriculum ● Payments ● Rules ● Notifications

<!-- page 4 -->

● Addresses

Part Two: Identifiers and References 11. Internal Identifiers
Every entity should have a permanent internal identifier suitable for system relationships.
A UUID or equivalent non-sequential internal identifier may be used. 12. Human-Readable References
Major entities should also receive a permanent human-readable reference.
Examples include:
● USER-00010481 ● BOOK-00010482 ● CASE-00010483 ● PAY-00010484 ● LESSON-00010485 ● STUDENT-00010486 ● RESOURCE-00010487 13. Global Reference Sequence
The numeric portion should use one global platform sequence.
The prefix identifies the entity type.
References should:
● Never be reused ● Remain stable after archival ● Remain visible in audit history ● Be safe to use in support communication ● Not expose sensitive information 14. Correlation Identifiers
Related operations should also support a Correlation ID .
A correlation may link:
● Booking request ● Payment authorisation ● Tutor acceptance ● Notification events ● Webhooks

<!-- page 5 -->

● Ledger entries ● Audit entries ● Integration retries
This supports tracing one user action across several modules.

Part Three: User and Role Entities 15. User
The User entity represents one person.
Suggested fields include:
● Internal ID ● Human-readable reference ● Legal name ● Display name ● Preferred name ● Email ● Phone ● Profile photo ● Date of birth where required ● Country ● Region ● Time zone ● Locale ● Account status ● Authentication status ● Multi-factor status ● Last login ● Created date ● Archived date ● Deleted date ● Retention-until date ● Legal-hold status 16. User Role Assignment
A User Role Assignment links a User to an available platform role.
Possible roles include:
● Parent ● Tutor ● Dependent Student ● Independent Student ● Supporter ● Organisation User ● Platform Manager

<!-- page 6 -->

● Platform Owner
Suggested fields include:
● User ● Role type ● Status ● Start date ● End date ● Assigned by ● Scope ● Workspace availability ● Reason ● Status history 17. Role Profile
Role-specific information should live in separate profiles.
Potential entities include:
● Parent Profile ● Tutor Profile ● Student Profile ● Supporter Profile ● Manager Profile
A role profile should link back to one User. 18. Platform Owner
There should initially be one active Platform Owner assignment.
Owner-level capabilities may include:
● Full platform configuration ● Manager permissions ● Financial rules ● Legal settings ● Safeguarding settings ● Emergency controls ● Permanent deletion approval ● Ownership transfer ● Full audit access
Ownership changes should preserve history and require high-security controls. 19. Manager Role
A Platform Manager should be represented through:
● User ● Manager Profile ● Manager Role Assignment

<!-- page 7 -->

● Manager Scope ● Approval Limits ● Temporary Access Grants 20. Custom Manager Role
The Platform Owner should be able to define custom manager roles.
A custom role may include:
● Capability list ● Data visibility ● Country scope ● Region scope ● Organisation scope ● Subject scope ● Financial thresholds ● Approval rights ● Export rights ● Impersonation rights ● Sensitive-data rights ● Alert requirements 21. Manager Scope
A manager’s scope should be stored separately from the role itself.
Examples include:
● New Zealand ● Auckland ● Selected organisations ● Mathematics marketplace resources ● Finance records only ● Tutor applicants only
One manager may hold several role-and-scope combinations. 22. Temporary Access Grant
Temporary elevated access should use a dedicated record.
Suggested fields include:
● Manager ● Capability ● Scope ● Granted by ● Reason ● Start time ● Expiry time ● Status ● Approval requirement ● Revoked date

<!-- page 8 -->

● Related audit records
Temporary access should expire automatically.

Part Four: Family and Student Entities 23. Family Account
A Family Account should be its own permanent entity.
It should not exist merely as fields on the primary parent.
Suggested fields include:
● Family reference ● Family display name ● Primary country ● Region ● Default currency ● Account status ● Primary guardian membership ● Created date ● Archived date ● Family preferences ● Financial account ● Support status 24. Family Membership
A Family Membership links a User to a Family Account.
Possible membership roles include:
● Primary guardian ● Additional guardian ● Dependent student ● Independent student with family link ● Supporter ● Authorised family user
Suggested fields include:
● Family ● User ● Membership role ● Start date ● End date ● Status ● Permissions ● Invitation source ● Added by

<!-- page 9 -->

● End reason ● Status history 25. Primary Guardian
The Family Account should identify one primary guardian for the core initial journey.
Additional guardians may be supported later.
Changing the primary guardian should not change:
● Family identity ● Student identity ● Booking history ● Payment history ● Tutor relationships 26. Student User Identity
Every student should have a User record, even where login is not yet enabled.
Possible access states include:
● No login enabled ● Parent-managed access ● Dependent-student login active ● Independent access active ● Access suspended 27. Student Profile
The Student Profile represents the student’s permanent learning identity.
Suggested fields include:
● Student User ● Family Account ● Student status ● School year ● School or education provider ● Curriculum framework ● Learning preferences ● General goals ● Relevant support information ● Login access state ● Independence status ● Created date ● Archived date ● Transfer history 28. Student Subject Section
Each Student Profile should contain subject-specific sections.

<!-- page 10 -->

Suggested fields include:
● Student Profile ● Subject ● Curriculum ● Year level ● Status ● Start date ● End date ● Current tutors ● Current skills ● Current goals ● Subject preferences ● Subject-level progress summary
One Student Profile may contain many subject sections. 29. Student Independence Transition
A dependent-to-independent transition should use a dedicated record.
Suggested fields include:
● Student ● Previous family permissions ● Requested date ● Requested by ● Parent input ● Tutor input ● Admin decision ● Effective date ● New payment responsibility ● Former-parent access ● Supporter arrangements ● Reversal status 30. Supporter Relationship
A Supporter Relationship links a trusted supporter to an independent student.
Suggested fields include:
● Student ● Supporter User ● Relationship description ● Permissions ● Start date ● End date ● Status ● Created by ● Revoked by ● Status history

<!-- page 11 -->

Part Five: Address and Location Entities 31. Saved Location
Locations should belong to a Family Account, Tutor Profile or Organisation where appropriate.
Suggested fields include:
● Owner type ● Owner ID ● Location label ● Address fields ● Country ● Region ● Coordinates where permitted ● Access instructions ● Location type ● Active status ● Created date ● Archived date
Examples include:
● Home ● Other guardian’s home ● Tutor home ● School ● Public library ● Learning centre 32. Location Privacy
Tutor home addresses and other private addresses should use permission-aware visibility.
The location record should distinguish:
● Public summary ● Approximate area ● Exact address ● Booking-only visibility ● Admin-only fields 33. Booking Location Snapshot
Each confirmed booking should store a snapshot of the selected location.
The snapshot should preserve:
● Address used ● Location label ● Travel fee ● Travel assumptions

<!-- page 12 -->

● Access instructions ● Pet disclosure ● Safety information
Later changes to the Saved Location must not alter historical bookings.

Part Six: Tutor and Organisation Entities 34. Tutor Profile
The Tutor Profile should link to one User.
Suggested fields include:
● Tutor reference ● Biography ● Profile photo ● Introductory video ● Teaching style ● Subjects ● Year levels ● Qualifications ● Verification status ● Visibility status ● Recommendation status ● Service areas ● Travel settings ● Payment eligibility ● Direct-payment eligibility ● Organisation affiliations ● Public-profile status ● Created date ● Approved date ● Suspended date 35. Tutor Verification
Verification should use structured records rather than a single status field.
Possible entities or record types include:
● Identity Verification ● Qualification Verification ● Reference Check ● Interview Record ● Trial Lesson Review ● Verification Label
Each should preserve:
● Verification type

<!-- page 13 -->

● Submitted evidence ● Reviewer ● Result ● Date ● Expiry ● Notes ● Status ● Audit history 36. Organisation
The Organisation entity may represent:
● Tutoring business ● School ● Learning centre ● Charity ● Community organisation ● Specialist programme provider
Suggested fields include:
● Organisation reference ● Legal name ● Trading name ● Organisation type ● Country ● Region ● Status ● Branding ● Financial account ● Payment settings ● Default rules ● Created date ● Approved date ● Suspended date 37. Organisation Membership
An Organisation Membership links a User to an Organisation.
Suggested fields include:
● Organisation ● User ● Role ● Scope ● Status ● Start date ● End date ● Permissions ● Approval authority ● Financial visibility ● Programme visibility

<!-- page 14 -->

● Resource visibility ● Invitation source ● Status history
One User may hold different roles across several organisations. 38. Tutor Organisation Affiliation
A tutor’s affiliation should be represented by Organisation Membership plus role-specific fields where necessary.
The system should distinguish:
● Independent tutor ● Affiliated tutor ● Tutor delivering organisation-owned services ● Tutor offering independent services while affiliated ● Tutor affiliated with several organisations

Part Seven: Tutor–Student Relationships 39. Tutor–Student Relationship
Every tutor–student relationship should use one permanent dedicated entity.
One relationship may cover several subjects.
Suggested fields include:
● Tutor ● Student ● Family ● Organisation ● Relationship source ● Marketplace or tutor-brought classification ● Start date ● End date ● Status ● Direct-payment eligibility ● Default payment method ● Communication permissions ● Record-sharing permissions ● Parent visibility ● Student visibility ● Tutor collaboration settings ● Removal reason ● Handover status ● Status history 40. Relationship Source

<!-- page 15 -->

Relationship source should be specific to the tutor–family relationship.
Possible values include:
● Marketplace ● Permanent tutor code ● Single-use invitation ● Referral code ● Organisation assignment ● Admin assignment ● Existing relationship migration
A family may be tutor-brought for one tutor and marketplace-sourced for another. 41. Tutor–Student Subject Link
Subjects within the relationship should use a separate linking record.
Suggested fields include:
● Tutor–Student Relationship ● Student Subject Section ● Subject ● Year level ● Start date ● End date ● Status ● Active services ● Progress access ● Sharing permissions ● Subject-specific notes 42. Relationship Payment Rules
Payment rules may attach to the Tutor–Student Relationship.
Possible fields include:
● Stripe required ● Direct bank transfer permitted ● Cash permitted ● Payment deadline ● Tutor commission rate ● Organisation commission ● Default billing cadence ● Admin exception ● Effective dates ● Rule version 43. Relationship Lifecycle
A relationship should preserve:
● Start

<!-- page 16 -->

● Pause ● Reactivation ● Removal ● End ● Tutor departure ● Family transfer ● Admin reassignment ● Historical access
Ending the relationship should not remove historical lesson, progress or financial records.

Part Eight: Service Entities 44. Service
One shared Service entity should support tutor-owned and organisation-owned services.
Suggested fields include:
● Service reference ● Owner type ● Owner ID ● Delivering tutor ● Organisation ● Service name ● Subject ● Year level ● Format ● Service type ● Status ● Current version ● Visibility ● Capacity ● Approval requirement ● Created date ● Archived date 45. Service Ownership
Ownership fields should distinguish:
● Tutor-owned service ● Organisation-owned service ● Tutor-owned service offered through an organisation ● Organisation programme delivered by several tutors 46. Service Version

<!-- page 17 -->

Once published or used in a booking, service details should become immutable through versioning.
A Service Version may include:
● Duration ● Price ● Currency ● Travel fee rules ● Trial settings ● Package eligibility ● Cancellation terms ● Rescheduling terms ● Minimum notice ● Response deadline ● Capacity ● Payment methods ● Location rules ● Recording settings ● Student eligibility ● Effective dates 47. Service Drafts
Unpublished drafts may be edited freely.
Once a version is used in a booking, changes should create a new Service Version. 48. Service Duplication
Duplicating a service should create:
● New Service ID ● New draft version ● Copied settings ● Unpublished status ● Link to source service where useful

Part Nine: Programme and Group Entities 49. Programme
An Organisation or Tutor may create a broader Programme .
A Programme may contain:
● Services ● Fixed cohorts

<!-- page 18 -->

● Drop-in sessions ● Resources ● Assessments ● Pricing ● Dates ● Capacity ● Tutors ● Organisation rules 50. Cohort
A Cohort represents a fixed group of students.
Suggested fields include:
● Programme ● Service ● Tutors ● Start date ● End date ● Minimum size ● Maximum size ● Status ● Schedule ● Pricing ● Resource access ● Waiting-list status 51. Cohort Membership
A Cohort Membership links a student to a Cohort.
Suggested fields include:
● Cohort ● Student ● Family ● Start date ● End date ● Join date ● Status ● Price ● Payment arrangement ● Catch-up access ● Removal reason ● Progress visibility 52. Drop-In Session
A Drop-In Session may be represented as a service-specific scheduled group booking with date-specific capacity.
It should support:

<!-- page 19 -->

● Session date ● Capacity ● Participants ● Waiting list ● Per-session price ● Attendance ● Individual student outcomes

Part Ten: Booking Entities 53. Booking
A Booking represents what was scheduled and agreed.
Suggested fields include:
● Booking reference ● Student ● Tutor ● Tutor–Student Relationship ● Service ● Service Version ● Recurring Series ● Cohort or group session ● Subject ● Scheduled start ● Scheduled end ● Time zone ● Status ● Format ● Location snapshot ● Price snapshot ● Policy snapshot ● Payment status ● Tutor acceptance status ● Parent approval status ● Created by ● Created date 54. Booking Snapshot
Each booking should preserve a full snapshot of:
● Service name ● Service version ● Duration ● Price ● Currency ● Travel fee ● Discounts

<!-- page 20 -->

● Payment method ● Cancellation terms ● Rescheduling terms ● Recording settings ● Location ● Organisation involvement ● Commission rules ● Applicable platform rules ● Admin exceptions 55. Booking Status
Possible statuses include:
● Draft ● Requested ● Awaiting payment authorisation ● Awaiting tutor acceptance ● Accepted ● Confirmed ● Declined ● Withdrawn ● Expired ● Rescheduled ● Cancelled ● Completed ● Disputed
Current status should live on the Booking while transitions are preserved in Status History. 56. Booking Request
A booking request may use the Booking record in a requested state.
Request-specific fields may include:
● Request expiry ● Tutor response deadline ● Payment authorisation ● Temporary calendar reservation ● Decline reason ● Withdrawal date 57. Rescheduling
An ordinary reschedule should retain the same Booking ID.
Booking Change History should preserve:
● Original date and time ● New date and time ● Requester ● Approver

<!-- page 21 -->

● Date ● Reason ● Policy applied ● Price adjustment 58. Replacement Booking
A replacement Booking should be created where there is a material change such as:
● Different tutor ● Different student ● Different service ● Admin reassignment ● Tutor departure ● Package transfer
The replacement should link to the original. 59. Booking Change
A structured Booking Change entity may record:
● Booking ● Change type ● Previous values ● New values ● Requested by ● Approved by ● Effective date ● Reason ● Financial adjustment ● Status

Part Eleven: Recurring Series 60. Recurring Series
A Recurring Series should be a parent record for recurring bookings.
Suggested fields include:
● Series reference ● Tutor–Student Relationship ● Service ● Subject ● Frequency ● Regular day ● Regular time ● Time zone ● Start date

<!-- page 22 -->

● End date ● Ongoing status ● Price rule ● Payment arrangement ● Location ● Pause status ● Slot-protection period ● Future-generation window ● Status 61. Generated Bookings
Individual Bookings should be generated beneath the Recurring Series.
Past bookings should remain unchanged when future series settings change. 62. Series Change
A Series Change record should distinguish:
● This lesson only ● This and future lessons ● Entire series ● Pause ● Resume ● End ● Price change ● Frequency change ● Location change

Part Twelve: Lesson Entities 63. Lesson
A Lesson represents what actually happened educationally.
It should remain separate from Booking.
Suggested fields include:
● Lesson reference ● Booking ● Tutor ● Student or group ● Actual start ● Actual end ● Attendance ● Delivery format ● Completion status ● Recording status

<!-- page 23 -->

● Transcript status ● Lesson-plan link ● Summary status ● Dispute status ● Created date ● Completed date 64. Booking and Lesson Relationship
A normal individual Booking may create one Lesson.
A cancelled Booking may create no Lesson.
A group Booking may create:
● One shared Lesson ● Several Student Lesson Outcome records 65. Shared Group Lesson
A shared group Lesson may contain:
● Tutors ● Cohort ● Participant list ● Shared lesson plan ● Shared materials ● Shared recording ● Shared transcript ● Group summary ● Group homework ● Attendance overview 66. Student Lesson Outcome
Each participant in a group lesson should have a separate Student Lesson Outcome.
Suggested fields include:
● Shared Lesson ● Student ● Attendance ● Individual progress ● Individual feedback ● Homework ● Goals ● Concerns ● Evidence ● Parent-visible summary ● Tutor internal observations
This preserves student privacy and individual learning continuity.

<!-- page 24 -->

Part Thirteen: Recording, Transcript and Summary Entities 67. Recording
A Recording entity should contain:
● Lesson ● File ● Start and end time ● Recording provider ● Consent status ● Availability status ● Retention-until date ● Deletion status ● Exception reason ● Access restrictions 68. Transcript
A Transcript entity should contain:
● Lesson ● Transcript version ● Provider ● Language ● Speaker segments ● Generation status ● Review status ● File or structured content ● Retention rule ● Access restrictions 69. Lesson Summary
A Lesson Summary should be versioned.
Possible stages include:
● AI draft ● Tutor-edited draft ● Tutor-approved version ● Later amendment ● Superseded version 70. Summary Version
A Summary Version should record:
● Lesson Summary

<!-- page 25 -->

● Version number ● Author ● Source ● Content ● Approval status ● Visibility ● Date ● Change summary ● Previous version ● Amendment reason
Parents and students should see only the latest approved version available to them.

Part Fourteen: Curriculum and Skill Entities 71. Subject
A Subject entity should support:
● Subject name ● Category ● Country applicability ● Curriculum applicability ● Active status ● Aliases ● Parent subject ● Subject hierarchy 72. Curriculum Framework
A Curriculum Framework should contain:
● Name ● Country or region ● Version ● Effective dates ● Year levels ● Standards ● Status ● Source ● Approval history 73. Curriculum Standard
A Curriculum Standard may include:
● Framework

<!-- page 26 -->

● Standard code ● Title ● Description ● Subject ● Year level ● Parent standard ● Prerequisites ● Effective dates ● Status 74. Skill Framework
A Skill Framework may be:
● Tutor-created ● Organisation-created ● Studdy-created ● Marketplace resource ● Curriculum-linked ● Private
Suggested fields include:
● Owner ● Subject ● Year level ● Version ● Licence ● Visibility ● Marketplace status ● Contributor ownership 75. Skill
A Skill entity may contain:
● Skill Framework ● Name ● Description ● Category ● Subject ● Year level ● Progress scale ● Prerequisites ● Suggested evidence ● Curriculum links ● Status 76. Student Skill
A Student Skill link connects a student to a skill.
It may contain:

<!-- page 27 -->

● Student Subject Section ● Skill ● Active status ● Current progress ● Start date ● Completion date ● Priority ● Assigned tutor ● Latest evidence date
The detailed progress history should remain in Progress Update records.

Part Fifteen: Progress, Goals and Evidence 77. Progress Update
Progress should be stored as individual immutable records over time.
Suggested fields include:
● Student ● Subject ● Skill ● Curriculum Standard ● Tutor ● Progress level ● Date ● Confidence ● Comment ● Visibility ● Source lesson ● Source assessment ● Evidence links ● Corrected or superseded status ● Previous update
The current level may be derived from the latest valid record. 78. Progress Scale
Progress scales should be configurable.
Possible examples include:
● Not started ● Emerging ● Developing ● Secure

<!-- page 28 -->

● Mastered
A scale may belong to:
● Studdy ● Curriculum ● Tutor framework ● Organisation 79. Goal
A Goal should support:
● Student ● Subject ● Creator ● Goal type ● Title ● Description ● Priority ● Due date ● Status ● Visibility ● Parent goal ● Child goals ● Linked prerequisites ● Skills ● Curriculum standards ● Evidence ● Completion history ● Reopening history 80. Goal Hierarchy
Broad goals may contain smaller child goals.
Goals may also link across subjects where appropriate. 81. Evidence Item
An Evidence Item represents material supporting a learning judgement.
Possible types include:
● Homework submission ● Assessment answer ● Tutor observation ● Uploaded work ● Resource completion ● Lesson recording excerpt ● Transcript segment ● Parent-provided result ● Student reflection

<!-- page 29 -->

Suggested fields include:
● Evidence type ● Student ● Creator ● Date ● Description ● Source record ● File ● Visibility ● Status ● Retention rule 82. Evidence Link
One evidence item should be reusable across several:
● Skills ● Goals ● Standards ● Progress updates ● Assessments
Evidence Link may be implemented through the generic Entity Link model.

Part Sixteen: Tutor Observation Entities 83. Tutor Observation
Tutor observations should be structured records.
Suggested fields include:
● Student ● Tutor ● Date ● Subject ● Skill ● Goal ● Observation ● Context ● Confidence ● Related lesson ● Visibility ● Parent-sharing status ● Evidence links ● Progress contribution ● Correction status 84. Observation and Notes

<!-- page 30 -->

Tutor Observation is distinct from a general private tutor note.
An observation is structured learning evidence.
A private tutor note may instead contain planning or operational information.

Part Seventeen: Homework Entities 85. Homework Assignment
Homework should be its own entity, separate from Resource.
Suggested fields include:
● Homework reference ● Student ● Tutor ● Subject ● Instructions ● Related lesson ● Due date ● Status ● Assigned resources ● Skills ● Goals ● Parent visibility ● Student visibility ● Created date ● Completed date 86. Homework Submission
A Homework Assignment may have several Submission records.
Suggested fields include:
● Homework Assignment ● Submission number ● Student ● Submitted date ● Written response ● Files ● Links ● Student comment ● Late status ● Current status ● Superseded by ● Tutor review status 87. Homework Review

<!-- page 31 -->

Tutor feedback may use a structured Homework Review entity or fields linked to each Submission.
It may contain:
● Tutor ● Review date ● Feedback ● Status ● Revision requested ● Skills demonstrated ● Progress updates ● Evidence links ● Parent visibility

Part Eighteen: Assessment and Question Entities 88. Assessment
An Assessment defines reusable assessment content.
Suggested fields include:
● Assessment reference ● Owner ● Subject ● Year level ● Curriculum ● Assessment type ● Version ● Visibility ● Marketplace status ● Price ● Licence ● Status 89. Question
A Question should be independently reusable and versioned.
Suggested fields include:
● Question reference ● Owner ● Subject ● Year level ● Question type ● Question text

<!-- page 32 -->

● Difficulty ● Marks ● Expected answer ● Marking guide ● Skills ● Curriculum standards ● Version ● Status 90. Assessment Question
An Assessment Question links a Question Version to an Assessment Version.
Suggested fields include:
● Assessment Version ● Question Version ● Order ● Marks ● Required status ● Assessment-specific wording ● Assessment-specific settings 91. Assessment Attempt
An Assessment Attempt represents one student completing an assessment.
Suggested fields include:
● Student ● Assessment Version ● Tutor ● Attempt number ● Start time ● Completion time ● Status ● Accommodations ● Total marks ● Result ● AI analysis status ● Tutor report status ● Evidence generated ● Progress updates generated 92. Assessment Answer
Each answer should link to:
● Assessment Attempt ● Question Version ● Student response ● Files ● Marks

<!-- page 33 -->

● Tutor feedback ● AI draft marking ● Tutor-approved marking ● Evidence ● Skills

Part Nineteen: Resource Marketplace Entities 93. Resource
A Resource represents reusable learning or teaching content.
Possible resource types include:
● Worksheet ● Video ● Revision pack ● Assessment ● Lesson plan ● Homework template ● Skill framework ● Teaching guide ● Interactive material
Suggested fields include:
● Resource reference ● Owner ● Subject ● Year level ● Resource type ● Current version ● Visibility ● Marketplace status ● Price ● Licence ● Created date ● Archived date 94. Resource Version
Resource versions should preserve:
● Content ● Files ● Description ● Preview ● Curriculum links

<!-- page 34 -->

● Skills ● Licence ● Contributor agreement ● Price where version-specific ● Approval status ● Change summary 95. Resource Visibility
Possible values include:
● Private ● Student-specific ● Cohort-specific ● Tutor-shared ● Organisation-only ● Marketplace free ● Marketplace paid ● Public preview 96. Resource Assignment
A Resource Assignment links a resource to:
● Student ● Homework ● Lesson ● Cohort ● Organisation programme ● Tutor
It should contain:
● Assigned by ● Assigned date ● Due date where applicable ● Completion status ● Visibility ● Access period 97. Resource Purchase
A Resource Purchase should link:
● Buyer ● Family ● Tutor ● Organisation ● Resource Version ● Payment Allocation ● Licence ● Purchase date ● Refund status

<!-- page 35 -->

98. Resource Contributor
    Resource Contributor records should support:
    ● Primary creator ● Co-author ● Editor ● Reviewer ● Organisation owner ● Platform share
99. Royalty Split
    Royalty splits should preserve:
    ● Resource Version ● Contributor ● Percentage or fixed share ● Approval status ● Effective date ● Refund treatment ● Payout status
    Changes affecting another contributor’s share require approval.
100.  Resource Review
      A Resource Review may contain:
      ● Resource ● Reviewer ● Verified purchase status ● Rating ● Comment ● Date ● Moderation status ● Report status

Part Twenty: Pricing Entities 101. Pricing Breakdown
Every chargeable booking or purchase should create a Pricing Breakdown.
Suggested fields include:
● Source entity ● Currency ● Base amount

<!-- page 36 -->

● Duration adjustment ● Travel fee ● Tutor discount ● Package discount ● Referral credit ● Studdy credit ● Tax ● Processing fee ● Studdy commission ● Organisation commission ● Parent total ● Estimated tutor take-home ● Version ● Effective date 102. Pricing Component
A Pricing Breakdown may use individual Pricing Component records.
Possible component types include:
● Base price ● Travel ● Discount ● Tax ● Credit ● Processing fee ● Commission ● Refund adjustment 103. Pricing Adjustment
A later change should create a Pricing Adjustment rather than edit the original breakdown.
It should contain:
● Original breakdown ● Adjustment reason ● Changed components ● Created by ● Approval ● Effective date ● Related dispute or admin action

Part Twenty-One: Financial Accounts and Ledger 104. Financial Account

<!-- page 37 -->

Each relevant party should have one or more Financial Accounts.
Possible owners include:
● Family Account ● Tutor ● Organisation ● Studdy ● Payment processor clearing ● Credit liability ● Refund liability 105. Account Types
Possible account types include:
● Parent payable ● Tutor earnings receivable ● Tutor pending payout ● Tutor commission owed ● Organisation revenue ● Platform commission revenue ● Credit balance ● Refund liability ● Processor clearing ● Payment-plan balance 106. Ledger Entry
Every financial movement should create an immutable Ledger Entry.
Possible entry types include:
● Parent charge ● Tutor payout ● Commission ● Direct-payment commission owed ● Refund ● Credit issued ● Credit redeemed ● Processor fee ● Commission waiver ● Package purchase ● Package usage ● Chargeback ● Adjustment ● Payment-plan instalment ● Referral reward 107. Ledger Entry Fields
Suggested fields include:

<!-- page 38 -->

● Entry reference ● Entry type ● Amount ● Currency ● Source account ● Destination account ● Effective date ● Created date ● Status ● Source entity ● External reference ● Created by ● Reason ● Reversal link ● Correlation ID 108. Reversals
Corrections should create a reversing entry and, where needed, a replacement entry.
The original Ledger Entry should remain immutable.

Part Twenty-Two: Payment, Payout and Commission Entities 109. Payment
A Payment represents money paid or committed by a parent or buyer.
Suggested fields include:
● Payment reference ● Payer ● Family ● Amount ● Currency ● Payment method ● Processor ● Status ● Authorised amount ● Captured amount ● Paid date ● External processor ID ● Failure reason ● Refund status 110. Payment Allocation

<!-- page 39 -->

One Payment may cover several items.
A Payment Allocation should link a Payment to:
● Booking ● Package ● Resource ● Assessment ● Programme ● Student ● Tutor
Suggested fields include:
● Payment ● Chargeable item ● Student ● Tutor ● Amount allocated ● Tax component ● Credit applied ● Refundable amount ● Status 111. Processor Transaction
A Processor Transaction should store Stripe or other processor records.
Possible types include:
● Authorisation ● Charge ● Capture ● Refund ● Transfer ● Payout ● Fee ● Dispute ● Chargeback
It should contain:
● Processor ● External ID ● Payment ● Payout ● Amount ● Currency ● Status ● Raw event reference ● Date 112. Payout

<!-- page 40 -->

A Payout represents money sent or scheduled to a tutor or organisation.
Suggested fields include:
● Payout reference ● Payee ● Amount ● Currency ● Payment allocations ● Status ● Scheduled date ● Paid date ● Processor ● External ID ● Failure reason ● Adjustment status 113. Commission Entry
A Commission Entry represents Studdy commission related to a chargeable item.
Suggested fields include:
● Tutor ● Organisation ● Booking or purchase ● Commission basis ● Rate ● Amount ● Currency ● Status ● Estimated date ● Chargeable date ● Statement ● Paid date ● Adjustment ● Waiver
Possible statuses include:
● Estimated ● Reserved ● Chargeable ● Adjusted ● Owed ● Paid ● Waived ● Disputed 114. Commission Statement
Direct-payment tutors should receive weekly or fortnightly statements.
A Commission Statement should contain:

<!-- page 41 -->

● Tutor ● Billing period ● Included Commission Entries ● Opening balance ● New commission ● Credits ● Adjustments ● Payments ● Closing balance ● Collection status 115. Payment Plan
A Payment Plan should support overdue tutor balances.
Suggested fields include:
● Tutor ● Balance ● Instalment amount ● Frequency ● Start date ● End date ● Payment method ● Status ● Booking restrictions ● Missed-instalment rules ● Created by ● Approval

Part Twenty-Three: Credit Entities 116. Credit
Studdy should use one shared Credit entity.
Suggested fields include:
● Credit reference ● Owner ● Credit type ● Source ● Original value ● Remaining value ● Currency ● Status ● Expiry date ● Usage restrictions ● Eligible tutor ● Eligible student

<!-- page 42 -->

● Eligible subject ● Eligible service ● Refundable status ● Created by ● Revoked by ● Revocation reason 117. Credit Types
A controlled Credit Type field should include values such as:
● Referral ● Refund ● Promotional ● Tutor cancellation ● Package transfer ● Commission ● Admin goodwill
Additional tags may support reporting. 118. Credit Usage
Credit redemption should create:
● Credit-use record ● Payment Allocation or Commission application ● Ledger Entry ● Remaining balance update ● Audit entry 119. Credit Revocation
Revocation should preserve:
● Original credit ● Remaining amount ● Reason ● Admin ● Date ● Related misuse case ● Ledger effect

Part Twenty-Four: Package Entities 120. Package
A Package should belong by default to:

<!-- page 43 -->

● Family ● Student ● Tutor–Student Relationship ● Tutor service
Suggested fields include:
● Package reference ● Service ● Tutor ● Student ● Family ● Original quantity ● Original monetary value ● Currency ● Purchase date ● Expiry date ● Status ● Transfer rules ● Refund rules ● Payment Allocation 121. Package Balance
Package balance should track both quantity and value.
Suggested fields include:
● Remaining lesson quantity ● Remaining monetary value ● Used quantity ● Used value ● Expired quantity ● Expired value ● Refunded quantity ● Refunded value ● Transferred quantity ● Transferred value ● Promotional quantity ● Promotional value 122. Package Usage
Each usage should link:
● Package ● Booking ● Lesson ● Quantity consumed ● Value consumed ● Date ● Reversal status

<!-- page 44 -->

123. Package Transfer
     A Package Transfer should contain:
     ● Source package ● Source relationship ● Destination package or Credit ● Quantity transferred ● Value transferred ● Reason ● Approval ● Date ● Original tutor ● New tutor ● Admin case
     Monetary value should govern cross-tutor transfer.

Part Twenty-Five: Referral Entities 124. Referral Code
Referral and invitation codes should use a structured entity.
Suggested fields include:
● Code ● Code owner ● Tutor ● Family ● Organisation ● Code type ● Usage limit ● Expiry ● Eligible service ● Eligible subject ● Active status ● Created date 125. Code Types
Possible values include:
● Permanent tutor code ● Single-family invitation ● Single-use invitation ● Reusable referral ● Limited-use promotion ● School or organisation code

<!-- page 45 -->

126. Referral Attribution
     Referral attribution should record:
     ● Referrer ● Referred family ● Tutor relationship ● Code used ● Join date ● First eligible lesson ● Reward eligibility ● Status
127. Referral Reward
     Referral Reward should contain:
     ● Attribution ● Recipient ● Reward type ● Value ● Activation condition ● Activated date ● Expiry ● Status ● Credit ● Revocation ● Misuse case

Part Twenty-Six: Comment, Conversation and Message Entities 128. Comment
One shared Comment entity should support comments across:
● Lesson summaries ● Homework ● Goals ● Assessments ● Progress updates ● Concerns ● Resources ● Support cases ● Tasks
Suggested fields include:
● Parent record

<!-- page 46 -->

● Author ● Author role ● Body ● Date ● Visibility ● Internal status ● Reply-to comment ● Thread ● Resolution status ● Edited date ● Attachments ● Mentions 129. Conversation
One shared Conversation entity should support:
● Parent–tutor ● Student–tutor ● Organisation ● Support ● Internal manager ● Case-related messaging
Suggested fields include:
● Conversation reference ● Conversation type ● Related entity ● Status ● Created date ● Closed date ● Visibility model 130. Conversation Participant
Participants should use a separate entity.
Suggested fields include:
● Conversation ● User ● Role used ● Participant type ● Joined date ● Left date ● Read position ● Posting permission ● Notification preference ● Visibility restriction 131. Message

<!-- page 47 -->

A Message should contain:
● Conversation ● Sender ● Sender role ● Body ● Sent date ● Edit history ● Attachments ● Visibility ● Moderation status ● Deleted status ● Reply relationship

Part Twenty-Seven: Task Entities 132. Task
One shared Task entity should support:
● Parent actions ● Tutor actions ● Student actions ● Organisation tasks ● Manager tasks ● System-generated actions
Suggested fields include:
● Task reference ● Task type ● Title ● Instructions ● Creator ● Assignee ● Assignee role ● Workspace ● Priority ● Due date ● Status ● Required status ● Related entity ● Escalation rule ● Completion evidence ● Reopened status ● Visibility ● Parent task ● Created date ● Completed date

<!-- page 48 -->

133. Task Checklist
     A Task may contain checklist items.
     Suggested fields include:
     ● Task ● Item ● Order ● Required status ● Completion status ● Completed by ● Completed date
134. Task Template
     Reusable Task Templates may contain:
     ● Task type ● Checklist ● Default assignee role ● Default due period ● Risk level ● Approval steps ● Escalation rules ● Communication templates ● Closure requirements ● Version

Part Twenty-Eight: Notification Entities 135. Notification Event
A Notification Event represents the shared trigger.
Suggested fields include:
● Event type ● Source entity ● Actor ● Date ● Priority ● Event properties ● Correlation ID 136. Notification
One Notification record should be created per recipient.

<!-- page 49 -->

Suggested fields include:
● Notification Event ● Recipient ● Workspace ● Message ● Channel ● Priority ● Mandatory status ● Delivery status ● Read status ● Action link ● Created date ● Sent date ● Read date ● Reminder schedule ● Language 137. Delivery Attempt
Notification delivery attempts should record:
● Notification ● Channel ● Provider ● Attempt time ● Status ● Failure reason ● Retry date ● External reference

Part Twenty-Nine: Support and Case Entities 138. Support Case
The Support Case model should support:
● User support ● Payment disputes ● Privacy requests ● Safeguarding ● Technical incidents ● Marketplace disputes ● Tutor onboarding issues ● Organisation issues
Suggested fields include:

<!-- page 50 -->

● Case reference ● Case type ● User-visible status ● Internal status ● Risk level ● Assigned manager ● Scope ● Created date ● Due date ● Resolved date ● Closed date ● User-visible summary ● Internal summary ● Decision ● Resolution 139. Case Link
Cases should link flexibly to several records through Entity Link or a specialised Case Link.
Possible linked entities include:
● Users ● Families ● Students ● Tutors ● Organisations ● Bookings ● Lessons ● Payments ● Payouts ● Packages ● Resources ● Assessments ● Integrations ● Other cases 140. Restricted Case Section
Restricted sections should support:
● Safeguarding-only ● Finance-only ● Legal-only ● Identity-verification-only ● Owner-only
Suggested fields include:
● Case ● Restriction type ● Content ● Author ● Date

<!-- page 51 -->

● Required role ● Required scope ● Access history 141. Case Evidence
Case evidence should link to central File and Entity Link records.
It should preserve:
● Uploader ● Date ● Evidence type ● Description ● Sensitivity ● Download restrictions ● Retention rule ● Scan status 142. Case Merge
Merged cases should preserve:
● Master case ● Original cases ● Merge reason ● Manager ● Date ● Separation history where reversed

Part Thirty: Privacy and Consent Entities 143. Consent Record
Consent should use immutable records.
Suggested fields include:
● User ● Student concerned ● Guardian ● Consent type ● Purpose ● Policy version ● Date accepted ● Acceptance method ● Country ● Region ● Expiry ● Withdrawal date

<!-- page 52 -->

● Evidence ● Related service or feature ● Status 144. Consent Withdrawal
Withdrawal should create:
● New linked consent state ● Effective date ● Initiator ● Affected features ● Required follow-up tasks ● Notifications ● Audit record 145. Permission Grant
Operational permissions should use versioned Permission Grant records.
Examples include:
● Student may request bookings ● Student may book directly ● Tutor may view another tutor’s summaries ● Supporter may view progress ● Former parent may view selected records ● Organisation manager may approve pricing
Suggested fields include:
● Grantor ● Recipient ● Permission type ● Scope ● Start date ● End date ● Status ● Conditions ● Related student ● Related family ● Related organisation ● Previous version ● Revocation details 146. Privacy Request
Privacy requests should use Support Case with specialised fields.
Possible request types include:
● Access ● Correction ● Deletion

<!-- page 53 -->

● Export ● Consent withdrawal ● Complaint
Suggested privacy-specific fields include:
● Identity verification ● Legal deadline ● Data categories ● Exemptions ● Decision ● Export package ● Completion date

Part Thirty-One: Retention Entities 147. Retention Rule
Retention rules should be configurable records.
Suggested fields include:
● Data category ● Entity type ● Country ● Region ● Case type ● Legal basis ● Retention period ● Start trigger ● End action ● Anonymisation rule ● Legal-hold behaviour ● Exceptions ● Rule version ● Effective dates ● Approval status 148. Retention Status
Important records may contain:
● Retention-until date ● Legal-hold status ● Deletion eligibility ● Anonymisation status ● Disposal status ● Last retention review 149. Legal Hold

<!-- page 54 -->

A Legal Hold should contain:
● Entity or data category ● Reason ● Created by ● Start date ● End date ● Scope ● Approval ● Release history

Part Thirty-Two: File Entities 150. File
One central File entity should store:
● File reference ● Storage location ● File name ● MIME type ● Size ● Uploader ● Upload date ● Checksum ● Scan status ● Encryption status ● Version ● Retention rule ● Retention-until date ● Deletion status 151. File Link
A File Link or generic Entity Link should control:
● Parent record ● File purpose ● Visibility ● Access permissions ● Expiry ● Download restriction ● Evidence classification ● Attachment type 152. File Access Log
Sensitive file access should record:

<!-- page 55 -->

● User ● Role ● File ● Action ● Date ● Purpose ● Download status ● Impersonation status ● Scope

Part Thirty-Three: Preference and Saved Item Entities 153. Preference
One flexible Preference entity should support:
● Dashboard widgets ● Mobile navigation ● Saved layouts ● Notification preferences ● Quiet hours ● Default filters ● Last-used views ● Search scope ● Accessibility ● Display options
Suggested scope fields include:
● User ● Workspace ● Device type ● Feature ● Country ● Organisation 154. Saved Item
One shared Saved Item entity should support:
● Favourite tutor ● Shortlisted tutor ● Pinned student ● Saved resource ● Saved search ● Shortcut ● Saved report

<!-- page 56 -->

Suggested fields include:
● Owner User or Family ● Item type ● Linked entity ● Workspace ● Private note ● Position ● Folder ● Saved date ● Status

Part Thirty-Four: Rules and Configuration Entities 155. Rule
A Rule represents a permanent business-policy identity.
Suggested fields include:
● Rule reference ● Rule name ● Module ● Purpose ● Current version ● Owner ● Status 156. Rule Version
A Rule Version should contain:
● Rule ● Version number ● Logic ● Wording ● Locked status ● Priority ● Effective date ● Expiry date ● Change summary ● Created by ● Approval state 157. Rule Scope
Rule Scope should define where the rule applies.

<!-- page 57 -->

Possible dimensions include:
● Global ● Country ● Region ● Programme ● Organisation ● Tutor ● Service ● Booking exception 158. Rule Approval
Rule Approval should preserve:
● Rule Version ● Reviewer ● Role ● Decision ● Date ● Comment ● Approval level ● Emergency status 159. Rule Schedule
Rule Schedule should contain:
● Rule Version ● Start date ● End date ● Activation status ● Automatic reversion ● Preview result ● Conflict result 160. Rule Conflict
A Rule Conflict record should identify:
● Conflicting rules ● Scope overlap ● Priority ● Resolution ● Resolved by ● Date 161. Effective Rule Snapshot
Transactions such as Bookings should record the exact Rule Versions applied.

<!-- page 58 -->

Part Thirty-Five: Status, Audit and Version Entities 162. Status History
Every major entity should have immutable Status History.
Suggested fields include:
● Entity type ● Entity ID ● Previous status ● New status ● Effective date ● Actor ● Role ● Reason ● Related event ● Override status ● Impersonation status ● Reversal link 163. Audit Log
Audit should remain separate from Status History.
Audit should record meaningful actions such as:
● Creation ● Field change ● Sensitive view ● Download ● Export ● Comment ● Permission change ● Impersonation ● Financial adjustment ● Rule change ● Status change ● Admin override 164. Audit Fields
Suggested fields include:
● Audit reference ● Actor ● Role ● Scope ● Action ● Entity

<!-- page 59 -->

● Date ● Original values ● New values ● Reason ● IP or session where permitted ● Impersonation ● Approval ● Correlation ID ● Risk level 165. Record Version
One shared Record Version model should support versioned entities such as:
● Services ● Lesson summaries ● Resources ● Skill frameworks ● Assessments ● Questions ● Rules ● Policies ● Reports ● Templates
Suggested fields include:
● Entity type ● Entity ID ● Version number ● Snapshot or changed fields ● Author ● Date ● Status ● Change summary ● Approval state ● Previous version ● Effective dates

Part Thirty-Six: Generic Entity Links 166. Entity Link
One generic Entity Link model should support flexible cross-record relationships.
Suggested fields include:
● Source entity type ● Source entity ID ● Target entity type

<!-- page 60 -->

● Target entity ID ● Relationship type ● Added by ● Added date ● Visibility ● Context note ● Status 167. Appropriate Uses
Entity Link is suitable for:
● Evidence to Skill ● Evidence to Goal ● File to Case ● Case to Booking ● Task to Student ● Comment to Summary ● Resource to Assessment ● Related case records 168. Inappropriate Uses
Entity Link should not replace specialised entities where substantial business logic exists.
Specialised models should remain for:
● Family Membership ● Organisation Membership ● Tutor–Student Relationship ● Payment Allocation ● Conversation Participant ● Permission Grant ● Cohort Membership

Part Thirty-Seven: Integration Entities 169. Integration Connection
One shared Integration Connection entity should represent external connections.
Possible integrations include:
● Stripe ● Google Calendar ● Google Meet ● Email provider ● File storage ● Accounting platform ● Identity verification

<!-- page 61 -->

● SMS provider
Suggested fields include:
● Integration type ● Provider ● Owner ● Country ● Organisation ● Status ● Authentication status ● Last successful sync ● Last error ● Test mode ● Created date ● Disabled date 170. Credential Record
Credential records should be protected and may contain:
● Integration Connection ● Credential reference ● Secret-storage reference ● Created date ● Expiry date ● Rotation date ● Status ● Created by
Secrets should not be stored in ordinary application tables. 171. Sync Job
A Sync Job should contain:
● Integration Connection ● Job type ● Start time ● End time ● Status ● Records processed ● Failure count ● Retry status ● Correlation ID 172. Webhook Event
A Webhook Event should contain:
● Integration Connection ● Provider event ID ● Event type

<!-- page 62 -->

● Received date ● Processing status ● Related entity ● Retry count ● Error ● Raw payload reference 173. Integration Error
Integration errors should record:
● Integration Connection ● Error type ● Severity ● Date ● Affected entity ● Message ● Retry eligibility ● Resolution ● Related incident case

Part Thirty-Eight: Domain Events and Analytics 174. Domain Event
One central Domain Event model should represent significant business events.
Examples include:
● Booking requested ● Booking accepted ● Lesson completed ● Homework submitted ● Summary approved ● Payment failed ● Refund issued ● Tutor suspended ● Resource published ● Case escalated 175. Domain Event Fields
Suggested fields include:
● Event type ● Source entity ● Actor

<!-- page 63 -->

● Role ● Workspace ● Date ● Related entities ● Properties ● Country ● Organisation ● Processing status ● Correlation ID 176. Domain Event Consumers
A Domain Event may trigger:
● Notification ● Task ● Analytics Event ● Integration sync ● Ledger progression ● Audit entry ● Status transition ● Timeline activity 177. Analytics Event
Analytics should use one standard event model.
Suggested fields include:
● Event name ● User ● Role ● Workspace ● Entity ● Session ● Date ● Country ● Region ● Organisation ● Device ● Platform ● Flexible properties ● Consent classification ● Privacy classification
Operational data should remain the system of record. Analytics events support measurement and reporting.

<!-- page 64 -->

Part Thirty-Nine: Timeline and Activity Entities 178. Activity Record
A shared Activity Record or derived timeline view should support major entities such as:
● Student ● Tutor ● Booking ● Payment ● Case ● Resource ● Organisation 179. Timeline Sources
Timeline entries may derive from:
● Domain Events ● Status History ● Comments ● Tasks ● Progress Updates ● Lesson Summaries ● Payments ● Assessments ● Homework ● Audit records where authorised 180. Visibility
Each timeline item should respect:
● User role ● Relationship ● Workspace ● Record visibility ● Permission Grants ● Restricted-case access

Part Forty: Principal Entity Relationships 181. User Relationships
● One User may have many User Role Assignments. ● One User may have one or more Role Profiles.

<!-- page 65 -->

● One User may belong to many Family Accounts over time. ● One User may belong to many Organisations. ● One User may hold many Manager Roles and Scopes. 182. Family Relationships
● One Family Account may have many Family Memberships. ● One Family Account may contain many Student Profiles. ● One Family Account may own many Saved Locations. ● One Family Account may have many Tutor–Student Relationships. ● One Family Account may have many Payments, Credits and Support Cases. 183. Student Relationships
● One Student User has one primary Student Profile. ● One Student Profile has many Subject Sections. ● One Student Profile may have many Tutor–Student Relationships. ● One Student Profile may have many Bookings, Lessons, Goals, Homework Assignments and Assessment Attempts. ● One Student Profile may have many Progress Updates and Evidence Items. 184. Tutor Relationships
● One Tutor Profile may own many Services. ● One Tutor Profile may have many Service Versions. ● One Tutor Profile may have many Tutor–Student Relationships. ● One Tutor Profile may deliver many Lessons. ● One Tutor Profile may belong to many Organisations. ● One Tutor Profile may own or contribute to many Resources. 185. Booking Relationships
● One Service may have many Service Versions. ● One Booking links to one exact Service Version. ● One Recurring Series may generate many Bookings. ● One Booking may create one Lesson. ● One group Booking may create one shared Lesson and many Student Lesson Outcomes. ● One Booking may have one or more Pricing Breakdowns and Adjustments. ● One Booking may receive one or more Payment Allocations. 186. Learning Relationships
● One Skill Framework contains many Skills. ● One Student Skill links one Student Subject Section to one Skill. ● One Goal may contain many child Goals. ● One Evidence Item may link to many Skills, Goals, Standards and Progress Updates. ● One Homework Assignment may have many Submissions. ● One Assessment may contain many Assessment Questions. ● One Assessment Attempt may contain many Answers.

<!-- page 66 -->

187. Financial Relationships
     ● One Financial Account may have many Ledger Entries. ● One Payment may have many Payment Allocations. ● One Payment Allocation may fund a Booking, Package, Resource or Assessment. ● One Payout may contain value from many Payment Allocations. ● One Booking or purchase may create one or more Commission Entries. ● One Credit may be redeemed across permitted allocations. ● One Package may have many Usage records.
188. Support Relationships
     ● One Support Case may link to many Users, Bookings, Lessons, Payments and Files. ● One Support Case may contain many Tasks, Comments and restricted sections. ● Several Support Cases may be merged into one master case.
189. Organisation Relationships
     ● One Organisation has many Organisation Memberships. ● One Organisation may own many Services and Programmes. ● One Programme may contain many Cohorts and Drop-In Sessions. ● One Cohort may contain many Cohort Memberships. ● One Organisation may own a private Resource library.

Part Forty-One: Current-State and History Pattern 190. Current-State Fields
Major entities may retain current-state fields for efficient application loading.
Examples include:
● Current status ● Current Service Version ● Current Progress level ● Current balance ● Current permission ● Current Rule Version 191. Historical Records
The current state must be supported by immutable history, such as:
● Status History ● Record Version ● Ledger Entry

<!-- page 67 -->

● Progress Update ● Permission Grant ● Rule Version ● Consent Record ● Booking Change 192. No Silent Rewrites
Updating a current-state field must not erase the historical records that explain it.

Part Forty-Two: Data Ownership Principles 193. User-Owned Identity
A User owns their identity and account preferences, subject to legal and platform requirements. 194. Family-Owned Operational Records
The Family Account owns family-level records such as:
● Saved locations ● Family favourites ● Family payment methods ● Family credits ● Parent-private notes 195. Student-Centred Learning Record
The Student Profile is the central home of the student’s learning continuity.
Tutor contributions remain attributable to the tutor but form part of the student’s historical record. 196. Tutor-Owned Business Records
Tutors own or control:
● Tutor Profile ● Tutor-owned Services ● Availability ● Tutor-created Resources ● Tutor-created Skill Frameworks ● Internal Notes ● Business preferences

<!-- page 68 -->

This remains subject to platform rules, moderation and contractual requirements. 197. Organisation-Owned Records
Organisations may own:
● Organisation Services ● Programmes ● Cohorts ● Organisation Resource libraries ● Organisation rules ● Internal reports
Individual tutor identity and authorship should remain attributable. 198. Platform-Controlled Records
Studdy controls platform-level records such as:
● Rules ● Audit ● Manager access ● Integration health ● Financial ledger ● Platform notifications ● Moderation decisions ● Safeguarding records

Part Forty-Three: Data Security and Access Principles 199. Role and Scope Enforcement
Access should depend on:
● User role ● Workspace ● Relationship ● Organisation membership ● Country or regional scope ● Permission Grant ● Record visibility ● Manager capability ● Sensitive-data classification 200. Sensitive Data Classification
Records should support classifications such as:

<!-- page 69 -->

● Public ● Matched-family only ● Active-relationship only ● Private user ● Tutor-only ● Parent-only ● Manager restricted ● Finance restricted ● Safeguarding restricted ● Owner only 201. Access Logging
Sensitive access should be logged, including:
● Recording views ● Identity-document views ● Safeguarding records ● Restricted case sections ● Sensitive downloads ● Exports ● Impersonation 202. Data Minimisation
Queries, reports and exports should retrieve only the fields required for the role and purpose.

Part Forty-Four: Data Model Design Principles 203. One User identity
People should not need duplicate accounts for different roles. 204. One Student Profile
A student should retain one continuous learning identity across tutors, subjects and time. 205. One Tutor–Student Relationship
One relationship should support several subjects between the same tutor and student. 206. Scheduling and learning separation
Booking stores what was agreed.

<!-- page 70 -->

Lesson stores what happened. 207. Reusable content separation
Resource stores reusable content.
Homework Assignment stores the student-specific instruction and outcome.
Assessment stores reusable assessment content.
Assessment Attempt stores one student’s completion. 208. Financial processor independence
Stripe and future processors should be integrated but should not be the sole explanation of Studdy’s internal financial state. 209. Immutable financial ledger
Financial corrections should be additive and reversible, not destructive. 210. Evidence-backed progress
Progress should be explainable through linked evidence. 211. Explicit permission history
Permission changes should remain versioned and traceable. 212. Generic models with sensible limits
Shared models should reduce duplication, but specialised entities should remain where important business logic exists. 213. Versioned business truth
Services, policies, rules, summaries and resources should preserve the exact version used at the relevant time. 214. Event-driven interoperability
Domain Events should allow notifications, tasks, analytics, integrations and financial processes to respond consistently. 215. Soft deletion and retention
Archival, anonymisation and deletion should be governed by explicit retention rules. 216. International configuration

<!-- page 71 -->

Country-specific differences should extend the shared model rather than require separate platform structures.
