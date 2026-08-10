# Statuses, State Transitions and Business Rules

> **Source document 09 of the Studdy planning pack.**
> Extracted verbatim from `09Statuses, State Transitions and Business ….pdf` on 7 August 2026.
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

Studdy Statuses, State Transitions and
Business

Rules

Version: Draft 0.1
Product:

Studdy

Status:

Ready

for

review

1. Purpose
   This document defines how Studdy records move between statuses, what conditions must
   be

satisfied

before

each

change,

who

may

approve

or

perform

the

change,

and

what

related

actions

must

occur.

It covers:
● Shared lifecycle categories ● Module-specific statuses ● Status-change preconditions ● Approval workflows ● Grace periods and scheduled changes ● Restrictions, suspensions and permanent removal ● Reversals and corrections ● Owner and manager overrides ● Automated consistency checks ● User-facing explanations ● Transition history and audit requirements
The technical term status transition means a record changing from one status to another.
Examples include:
● Booking: Requested → Confirmed ● Payment: Pending → Paid ● Tutor application: Under review → Approved ● Support case: Open → Closed
User-facing interfaces should normally use plain wording such as status change , approval
request
,

cancellation

request

or

reinstatement

request
.

Part One: Shared Status Principles 2. Shared lifecycle categories
Studdy should use the following broad lifecycle categories:
● Draft ● Pending

<!-- page 2 -->

● Active ● Paused ● Completed ● Cancelled ● Archived
Module-specific statuses should sit beneath these categories.
Examples:
Broad category
Module-specific status
Pending Awaiting tutor acceptance
Pending Pending payment authorisation
Active Confirmed
Paused Restricted
Paused Suspended
Completed Lesson completed
Cancelled Cancelled by parent
Archived Retention archive
This gives the platform a consistent structure without forcing unrelated records to use identical wording. 3. Distinct paused-state meanings
The following statuses should remain separate:
Under Review
The record is being assessed.
Existing activity may continue, pause or become restricted depending on risk.
Restricted
The record remains active, but selected capabilities are unavailable.
Suspended
The record’s primary activity is temporarily stopped.
Reinstatement remains possible.
Permanently Removed
The relevant role, capability or access has been removed indefinitely.

<!-- page 3 -->

Reinstatement requires an exceptional appeal, corrective decision or Platform Owner override. 4. User-facing status explanations
Technical statuses should normally remain consistent across the system.
Instead of creating a separate user-facing status for every context, Studdy should provide an information control beside the status.
The information control may explain:
● What the status means ● Why the record has this status ● What is currently allowed ● What is currently blocked ● What must happen next ● Who is responsible ● When the status will be reviewed ● Whether an appeal is available
Example:
Status: Held for reassignment ⓘ
Your original tutor is no longer available for this lesson. You may choose another tutor, request more options, cancel the booking or receive an eligible refund or credit.
Different visible wording may still be used where the internal wording would be unnecessarily technical, misleading or inappropriate for the affected user. 5. Workflow finality
Not every workflow needs one universal terminal status.
Each workflow should instead define which statuses are considered final.
A final status means that ordinary actions can no longer reopen the record.
Further action may still occur through:
● Appeal ● Correction ● Reverse transition ● Linked replacement record ● Platform Owner override
Examples of potentially final statuses include:
● Permanently removed ● Fully refunded ● Expired ● Archived ● Appeal dismissed

<!-- page 4 -->

● Resource withdrawn permanently

Part Two: Status Transition Model 6. Transition Record
Every important status change should create an immutable Transition Record .
The record should include:
● Entity type ● Entity ID ● Previous status ● Target status ● Transition type ● Requester ● Requester role ● Requester scope ● Requested date and time ● Completed date and time ● Current revision ● Preconditions checked ● Passed preconditions ● Failed preconditions ● Rule Version applied ● Approval formula ● Approval records ● Grace period ● Scheduled completion time ● Acknowledgement requirement ● Resulting actions ● Related tasks ● Related notifications ● Related Domain Event ● Override status ● Override reason ● Correlation ID 7. Transition revisions
A status-change request should support revisions.
Examples:
● Revision 1: Original refund request ● Revision 2: Refund amount corrected ● Revision 3: Additional evidence attached
Each approval must identify the exact revision approved.

<!-- page 5 -->

The record should preserve:
● Original request ● Every revision ● Fields changed ● Change author ● Requested amendments ● Invalidated approvals ● Current approval state ● Discussion history 8. Transition discussion
A status-change request should support a discussion thread.
The discussion may contain:
● Clarifying questions ● Responses ● Requested changes ● Supporting evidence ● Internal notes ● User-visible comments ● Mentions ● Attachments ● Links to existing Studdy records
Visibility must follow role, scope and sensitivity rules. 9. Structured preconditions
Every allowed transition should define:
● Permitted current statuses ● Target status ● Required fields ● Required linked records ● Required consent ● Required payment status ● Required approvals ● Required evidence ● Actor roles ● Scope restrictions ● Blocking conditions ● Grace period ● Resulting events ● Reversal route
These conditions should be defined centrally rather than separately in every screen. 10. Failed preconditions

<!-- page 6 -->

Where a status change is blocked, Studdy should show every known blocking issue together.
Each issue should explain:
● What is missing or invalid ● Which rule caused the issue ● Which record is affected ● Who can resolve it ● What action is required ● Whether an override is available
Example:
This booking cannot be confirmed because:
● Payment authorisation is missing. ● Tutor acceptance has not been received. ● Recording consent is incomplete. ● The selected time is no longer within the tutor’s availability. 11. Reverse transitions
Records should normally move backwards only through an explicit corrective or reverse transition.
Examples:
● Completed → Reopened ● Paid → Refund pending ● Closed → Reopened ● Published → Unpublishing ● Suspended → Reinstatement review ● Confirmed → Cancellation pending
Directly changing a record backwards should be reserved for authorised overrides. 12. Scheduled transitions
Automatic status changes should be stored as scheduled records.
A Scheduled Transition should contain:
● Source record ● Current status ● Planned target status ● Trigger ● Scheduled time ● Grace period ● Cancellation conditions ● Intervention rights ● Reminder rules ● Processing status ● Completion result

<!-- page 7 -->

Users should be shown meaningful scheduled changes, such as:
● This request will expire in three hours. ● This recording will be deleted on 18 August. ● This payment will be retried tomorrow. ● This case will close in 48 hours unless you reply.

Part Three: Grace Periods and Reminders 13. Grace periods
A transition may use a short grace period where immediate finalisation could create unnecessary reversals.
Possible uses include:
● Accidental booking cancellation ● Payment retry ● Case closure ● Booking-request expiry ● Slot release ● Account archival ● Summary deadline escalation
A grace period should define:
● Duration ● Trigger ● Visible intermediate status ● Actions still permitted ● Cancellation conditions ● Responsible party ● Reminder schedule ● Scope
Grace periods should not delay urgent action required for:
● Safety ● Fraud prevention ● Account security ● Legal compliance ● Safeguarding 14. Intermediate statuses
Where a grace period materially affects the user, a visible intermediate status should be used.
Examples:

<!-- page 8 -->

● Cancellation scheduled ● Pending closure ● Payment retry scheduled ● Pending suspension ● Pending archival ● Expiry scheduled ● Awaiting final review
Very short technical delays do not always require a visible status. 15. Transition reminders
Important scheduled changes should support configurable reminders.
Reminder rules may define:
● Recipient role ● Channel ● Timing ● Number of reminders ● Escalation timing ● Mandatory status ● Acknowledgement requirement ● Quiet-hour handling ● Country scope ● Organisation scope ● Service scope
Low-value changes should not create excessive notifications.

Part Four: Approval Rules 16. Approval outcomes
An approver should be able to select:
● Approve ● Approve with conditions ● Reject ● Request changes
A comment should be required for:
● Rejection ● Requested changes ● Conditional approval 17. Approval Record
Each decision should create an immutable Approval Record containing:

<!-- page 9 -->

● Transition request ● Transition revision ● Approver ● Approver role ● Scope ● Decision ● Date and time ● Comment ● Conditions ● Delegated-authority status ● Expiry ● Withdrawal status ● Rule Version 18. Multi-party approvals
A transition may require several separate approvals.
Examples include:
● Parent approval ● Student approval ● Tutor approval ● Organisation approval ● Manager approval ● Platform Owner approval
Supported approval formulas should include:
● All required approvers ● Any one authorised approver ● Minimum number, such as two of three ● One approver from each group ● Sequential approval ● Conditional approval above a threshold 19. Approval expiry
Approvals should be able to expire.
An approval may become invalid when:
● The booking time changes ● Price changes ● Tutor changes ● Student changes ● Service Version changes ● Location changes ● Payment method changes ● Organisation involvement changes ● Relevant consent is withdrawn ● The approval deadline passes

<!-- page 10 -->

20. Approval withdrawal
    An approver may withdraw approval before the status change becomes final.
    Withdrawal should record:
    ● Original approval ● Person withdrawing ● Date and time ● Reason ● Consequence ● Notifications ● Whether the request was paused or cancelled
    Once the status change is final, the user should use a reverse or corrective process instead.
21. Material changes
    Approvals should be invalidated when a material field changes.
    Material fields may include:
    ● Price ● Currency ● Date ● Time ● Duration ● Tutor ● Student ● Service Version ● Location ● Payment method ● Refund amount ● Organisation involvement ● Permission scope ● Record-sharing terms ● Risk classification
    Minor corrections should not invalidate approval.
    Fields should be classified as:
    ● Material ● Non-material ● Conditionally material
22. Approval delegation
    Authorised people may temporarily delegate approval authority.
    Delegation should define:
    ● Original approver ● Delegate

<!-- page 11 -->

● Scope ● Start and end time ● Approval categories ● Financial limits ● Risk limits ● Reason ● Revocation status
Delegated authority should not normally cover:
● Platform ownership transfer ● Permanent deletion ● Serious safeguarding closure ● Major financial write-offs ● High-risk privacy exceptions 23. Conditional approval
An approval may include mandatory conditions.
Each condition should become a linked Task containing:
● Condition ● Assignee ● Due date ● Required evidence ● Verification requirement ● Escalation rule ● Consequence if missed
Where a mandatory condition is missed, the affected record should normally become Suspended .
Suspension should be proportionate to the missed condition.
A minor overdue administrative task should not automatically suspend an entire account where a narrower restriction is sufficient.

Part Five: Acknowledgement Rules 24. Acknowledgement modes
A transition may use one of four acknowledgement modes:
● No acknowledgement ● Notification acknowledgement ● Acceptance required ● Objection window 25. Appropriate acknowledgement uses

<!-- page 12 -->

Acknowledgement may be required for:
● Recurring lesson term changes ● Replacement tutor acceptance ● Organisation involvement ● Record-sharing permission changes ● Payment-plan agreements ● Package transfers ● Independent-student transition ● Material active-service policy changes
Acknowledgement should not block urgent:
● Safety action ● Fraud restriction ● Security lockout ● Legal restriction ● Emergency cancellation

Part Six: Overrides and Consistency Controls 26. Platform Owner authority
The Platform Owner may move any record to any status.
Owner action should support two modes.
Status-only override
Changes only the selected record’s status.
This should display a strong inconsistency warning where related records may be affected.
Status-and-corrections override
Changes the status and creates required related actions, such as:
● Ledger reversals ● Payment adjustments ● Commission recalculation ● Booking corrections ● Lesson corrections ● Progress corrections ● Package balance changes ● Notifications ● Tasks ● Timeline entries
This should be the recommended mode wherever dependencies exist.

<!-- page 13 -->

27. High-risk owner overrides
    High-risk overrides should require:
    ● Reason ● Impact preview ● Explicit confirmation ● Audit logging ● Linked corrections ● Optional second approval ● Notification decision
28. Manager overrides
    Managers may override statuses only within:
    ● Assigned module ● Authorised role ● Country or region ● Organisation scope ● Financial threshold ● Sensitivity clearance ● Temporary Access Grant
29. Invalid status combinations
    Studdy should continuously detect inconsistent record states.
    Examples include:
    ● Cancelled Booking with Completed Lesson ● Refunded Payment with active paid Package value ● Suspended Tutor with future Confirmed Bookings ● Archived Student with active Tutor–Student Relationships ● Closed Case with incomplete mandatory Tasks ● Published Resource with unapproved current version ● Paid Commission Entry without Ledger Entry ● Paid Payout without successful processor confirmation
    Each warning should include:
    ● Inconsistency ● Affected records ● Risk level ● Recommended correction ● Authorised resolver ● Automated-fix availability
    Critical inconsistencies should block further related actions unless explicitly overridden.

<!-- page 14 -->

Part Seven: Restriction, Suspension and Removal Rules 30. Narrowest sufficient restriction
Studdy should apply the narrowest restriction that adequately controls the risk.
Examples:
● Overdue commission → restrict new direct-payment bookings ● Missing subject qualification → restrict that subject ● Payment dispute → hold disputed payout ● Account compromise → lock account access ● Serious conduct concern → suspend teaching ● Safeguarding concern → suspend all relevant access immediately 31. Restriction record
A restriction or suspension should define:
● Affected capability ● Affected records ● Reason ● Risk level ● Start date ● Review date ● Responsible reviewer ● Reinstatement conditions ● Existing booking impact ● Communication restrictions ● Financial consequences ● Appeal rights 32. Required review dates
Every restriction and suspension should have a review date.
It should not remain active indefinitely without deliberate review.
If the deadline passes without a decision, the restriction should remain active and trigger:
● Immediate escalation ● Overdue warning ● Manager notification ● Senior-manager notification ● Mandatory review Task ● Platform Owner dashboard alert ● Proportionality reassessment
Lower-risk restrictions may automatically narrow rather than disappear where an applicable Rule permits it.

<!-- page 15 -->

33. Appeal rights
    People affected by a restriction, suspension or permanent removal should normally have an appeal route.
    An Appeal Record should contain:
    ● Original decision ● Appellant ● Appeal reason ● Evidence ● Submission date ● Review deadline ● Reviewer ● Independence requirement ● Status ● Decision ● Explanation ● Resulting status changes
    Appeal information may be limited where full disclosure would create legal, security or safeguarding risk.
34. Independent appeal review
    Appeals should normally be reviewed by someone other than the original decision-maker.
    Possible reviewers include:
    ● Another authorised manager ● Senior manager ● Different function ● Platform Owner ● External reviewer
35. Permanent removal
    Permanent removal should require:
    ● Defined grounds ● Evidence ● Higher approval authority ● Impact assessment ● Written decision ● Appeal information ● Financial reconciliation ● Booking handling ● Relationship handling ● Data-retention determination ● Complete audit history
    Removal may apply to:
    ● Entire account

<!-- page 16 -->

● Tutor role ● Particular subject ● Particular service ● Organisation participation ● Resource publishing ● Payout privileges

Part Eight: Reinstatement Rules 36. Reinstatement request
Reinstatement should use a structured approval process.
It should assess:
● Original reason ● Required corrective actions ● Evidence ● Outstanding conditions ● Current risk ● Affected capabilities ● Continued restrictions ● Future review needs
Possible outcomes include:
● Fully reinstated ● Reinstated with restrictions ● Reinstated with conditions ● Continued suspension ● Permanently removed 37. Service reactivation after reinstatement
Tutor services and availability should not automatically reactivate.
The tutor should review and confirm:
● Services offered ● Pricing ● Availability ● Locations ● Travel rules ● Payment settings ● Qualification evidence ● Communication settings ● Recording settings ● Organisation affiliations ● Reinstatement conditions
Affected services should return as:

<!-- page 17 -->

● Draft after reinstatement ● Reinstatement review ● Ready to republish
Previously confirmed future bookings should be assessed separately.

Part Nine: Tutor Application Workflow 38. Tutor application statuses
Broad state
Detailed status
Draft Application draft
Pending Submitted
Pending Identity review
Pending Reference checks
Pending Interview required
Pending Trial lesson review
Pending Changes requested
Active Conditionally approved
Active Approved
Paused Under review
Paused Restricted
Paused Suspended
Cancelled Withdrawn
Completed Rejected
Completed Permanently ineligible
Archived Archived application 39. Tutor application transitions
Current status Action Target status Main preconditions
Application draft Submit Submitted Required fields and declarations complete
Submitted Begin review Identity review Reviewer assigned

<!-- page 18 -->

Identity review Pass identity check
Reference checks Identity verified
Reference checks
Request interview
Interview required Required references received or exception approved
Interview required
Approve progression
Trial lesson review or Approved
Interview completed
Any pending review
Request changes
Changes requested Clear required changes recorded
Changes requested
Resubmit Previous review stage
Requested changes completed
Trial lesson review
Approve Approved Trial review passed
Any review stage
Approve with conditions
Conditionally approved
Conditions and deadlines recorded
Conditionally approved
Complete conditions
Approved Conditions verified
Conditionally approved
Miss mandatory condition
Suspended Deadline passed
Any pending status
Reject Rejected Reason and appeal rights recorded
Rejected Resubmit Submitted Resubmission allowed and issues addressed
Any non-final state
Withdraw Withdrawn Applicant confirmation 40. Tutor application diagram flowchart LR A[Application draft] --> B[Submitted] B --> C[Identity review] C --> D[Reference checks] D --> E[Interview required] E --> F[Trial lesson review] F --> G[Approved] E --> G C --> H[Changes requested] D --> H E --> H F --> H H --> C H --> D H --> E H --> F F --> I[Conditionally approved]

<!-- page 19 -->

I --> G I --> J[Suspended] C --> K[Rejected] D --> K E --> K F --> K K --> B
Part Ten: Tutor Account Workflow 41. Tutor account statuses
● Active ● Under review ● Restricted ● Pending suspension ● Suspended ● Reinstatement review ● Reinstated with conditions ● Permanently removed ● Voluntarily inactive ● Archived 42. Tutor suspension consequences
When a tutor becomes suspended, Studdy should assess every future booking.
Each booking should become one of:
● Safe to continue ● Held for reassignment ● Requires cancellation ● Requires manual review ● Reassigned pending parent approval
The assessment should consider:
● Suspension reason ● Severity ● Subject affected ● Service affected ● Booking date ● Payment state ● Parent preference ● Replacement availability ● Student continuity ● Safeguarding restrictions 43. Suspended-tutor access

<!-- page 20 -->

A suspended tutor may retain read-only access to records needed for:
● Earnings ● Payouts ● Commission ● Tax ● Payment disputes ● Support cases ● Suspension evidence ● Appeals
They should not automatically retain access to:
● Current student communications ● Future lesson information ● New family details ● Unrelated student records ● Restricted safeguarding content
All access should be logged. 44. Tutor account diagram flowchart LR A[Active] --> B[Under review] B --> A B --> C[Restricted] B --> D[Pending suspension] D --> E[Suspended] C --> E E --> F[Reinstatement review] F --> G[Reinstated with conditions] F --> A G --> A F --> H[Permanently removed] E --> H A --> I[Voluntarily inactive] I --> A
Part Eleven: Service Publishing Workflow 45. Service statuses
● Draft ● Changes requested ● Pending approval ● Approved ● Scheduled for publication

<!-- page 21 -->

● Published ● Restricted ● Suspended ● Unpublishing ● Unpublished ● Draft after reinstatement ● Archived 46. Service transition rules
Current status Action Target status Preconditions
Draft Submit for approval
Pending approval Required fields complete
Pending approval Request changes
Changes requested
Required changes recorded
Changes requested
Resubmit Pending approval Revision created
Pending approval Approve Approved Ownership, pricing and policy checks passed
Approved Publish now Published Effective Service Version exists
Approved Schedule publication
Scheduled for publication
Publication time set
Scheduled for publication
Activate Published Scheduled time reached
Published Restrict Restricted Restriction scope defined
Published Suspend Suspended Reason and review date recorded
Published Unpublish Unpublishing Active booking impact assessed
Unpublishing Complete Unpublished Required notifications completed
Suspended tutor reinstated
Return service Draft after reinstatement
Tutor must reconfirm and republish
Any inactive status Archive Archived Retention rules checked 47. Service diagram flowchart LR A[Draft] --> B[Pending approval] B --> C[Changes requested] C --> B B --> D[Approved] D --> E[Scheduled for publication]

<!-- page 22 -->

D --> F[Published] E --> F F --> G[Restricted] F --> H[Suspended] F --> I[Unpublishing] I --> J[Unpublished] H --> K[Draft after reinstatement] K --> B
Part Twelve: Booking Workflow 48. Booking statuses
● Draft ● Requested ● Pending payment authorisation ● Awaiting tutor acceptance ● Awaiting parent approval ● Confirmed ● Held ● Held for reassignment ● Reassignment proposed ● Cancellation scheduled ● Cancelled ● Declined ● Withdrawn ● Expired ● In progress ● Completed ● Disputed ● Replaced ● Archived 49. Booking-confirmation preconditions
A Booking should not become Confirmed until applicable conditions are satisfied.
Possible conditions include:
● Tutor acceptance ● Parent approval ● Student permission ● Payment authorisation ● Required consent ● Tutor availability ● Service eligibility ● Location validity ● Organisation approval ● Required Rule Versions ● Capacity availability

<!-- page 23 -->

50. Booking transition table
    Current status Action Target status
    Draft Submit request Requested
    Requested Require payment Pending payment authorisation
    Requested Send to tutor Awaiting tutor acceptance
    Pending payment authorisation
    Authorise payment Awaiting tutor acceptance or Confirmed
    Awaiting tutor acceptance Tutor accepts Confirmed
    Awaiting tutor acceptance Tutor declines Declined
    Requested Parent withdraws Withdrawn
    Requested or pending Deadline passes Expired
    Confirmed Place on hold Held
    Confirmed Begin lesson In progress
    In progress Complete lesson Completed
    Confirmed Request cancellation
    Cancellation scheduled
    Cancellation scheduled Complete cancellation
    Cancelled
    Confirmed Tutor unavailable Held for reassignment
    Held for reassignment Propose tutor Reassignment proposed
    Reassignment proposed Parent accepts Confirmed with replacement
    Reassignment proposed Parent rejects Held for reassignment
    Held for reassignment Parent cancels Cancellation scheduled
    Any eligible status Raise dispute Disputed
    Material replacement required
    Create replacement Replaced
51. Replacement tutor choice
    Parents should be able to:
    ● Accept a proposed tutor ● Reject the tutor ● Request further options ● Search independently ● Pause affected lessons ● Cancel ● Request eligible credit or refund

<!-- page 24 -->

Rejecting several proposed tutors should not remove valid credit or refund rights. 52. Booking diagram flowchart LR A[Draft] --> B[Requested] B --> C[Pending payment authorisation] B --> D[Awaiting tutor acceptance] C --> D D --> E[Confirmed] D --> F[Declined] B --> G[Withdrawn] B --> H[Expired] E --> I[In progress] I --> J[Completed] E --> K[Cancellation scheduled] K --> L[Cancelled] E --> M[Held for reassignment] M --> N[Reassignment proposed] N --> E N --> M M --> K
Part Thirteen: Recurring Series Workflow 53. Recurring Series statuses
● Draft ● Pending approval ● Active ● Change pending ● Paused ● Slot release scheduled ● End scheduled ● Ended ● Cancelled ● Archived 54. Recurring Series rules
Changes should distinguish:
● One lesson only ● This and future lessons ● Entire series ● Pause ● Resume ● End ● Change tutor

<!-- page 25 -->

● Change time ● Change price ● Change location
A material change may require renewed parent or tutor approval.

Part Fourteen: Lesson Workflow 55. Lesson statuses
● Scheduled ● Ready to begin ● In progress ● Attendance incomplete ● Completion pending ● Completed ● Summary pending ● Follow-up pending ● Correction requested ● Reopened ● Cancelled ● Invalidated ● Archived 56. Lesson-completion preconditions
A Lesson should not become Completed until applicable fields are recorded:
● Actual start ● Actual end ● Attendance ● Delivery format ● Tutor confirmation ● Group participant outcomes where applicable 57. Lesson reverse transition
Completed lessons should not be directly changed back to Scheduled.
They should use:
● Correction requested ● Reopened ● Invalidated
Possible consequences include:
● Progress correction ● Homework withdrawal ● Summary revision

<!-- page 26 -->

● Payment review ● Commission adjustment ● Parent notification 58. Lesson diagram flowchart LR A[Scheduled] --> B[Ready to begin] B --> C[In progress] C --> D[Attendance incomplete] C --> E[Completion pending] D --> E E --> F[Completed] F --> G[Summary pending] G --> H[Follow-up pending] F --> I[Correction requested] I --> J[Reopened] J --> F F --> K[Invalidated]
Part Fifteen: Payment Workflow 59. Payment statuses
● Created ● Pending authorisation ● Authorised ● Capture scheduled ● Paid ● Payment retry scheduled ● Failed ● Partially refunded ● Fully refunded ● Disputed ● Chargeback received ● Reversed ● Written off ● Archived 60. Payment rules
A Payment should not become Paid without:
● Successful processor confirmation or verified permitted payment evidence ● Matching Payment Allocation ● Matching Ledger Entries ● Currency agreement ● Amount reconciliation

<!-- page 27 -->

61. Payment diagram flowchart LR A[Created] --> B[Pending authorisation] B --> C[Authorised] C --> D[Capture scheduled] C --> E[Paid] D --> E B --> F[Payment retry scheduled] F --> B F --> G[Failed] E --> H[Partially refunded] E --> I[Fully refunded] E --> J[Disputed] J --> K[Chargeback received] K --> L[Reversed]
    Part Sixteen: Payout and Commission Workflows
62. Payout statuses
    ● Draft ● Pending reconciliation ● Ready ● Scheduled ● Processing ● Paid ● Failed ● Held ● Disputed ● Reversed ● Cancelled
63. Payout preconditions
    A Payout should not become Paid without:
    ● Payee eligibility ● Reconciled allocations ● Matching Ledger Entries ● Successful processor transaction ● No applicable hold ● Required tax or identity records
64. Commission statuses
    ● Estimated

<!-- page 28 -->

● Reserved ● Chargeable ● Adjusted ● Owed ● Payment plan active ● Paid ● Waived ● Disputed ● Reversed 65. Commission suspension rule
Overdue commission should normally restrict the narrowest relevant capability.
Possible response:
● Reminder ● Payment retry ● Payment plan ● Restrict new direct-payment bookings ● Suspend direct-payment eligibility ● Wider suspension only where necessary

Part Seventeen: Homework Workflow 66. Homework statuses
● Draft ● Assigned ● Viewed ● In progress ● Submitted ● Resubmitted ● Late ● Under review ● Revision requested ● Completed ● Withdrawn ● Archived 67. Homework transitions
A Homework Assignment may have several submissions.
Resubmission should not overwrite earlier work.
The current Assignment status may be derived from:
● Latest valid submission ● Tutor review

<!-- page 29 -->

● Due date ● Revision requirement

Part Eighteen: Assessment Workflow 68. Assessment-definition statuses
● Draft ● Pending review ● Changes requested ● Approved ● Published ● Restricted ● Withdrawn ● Archived 69. Assessment-attempt statuses
● Not started ● In progress ● Submitted ● Auto-analysis pending ● Tutor review pending ● Changes required ● Marked ● Report approved ● Completed ● Invalidated
An Assessment Attempt should not become Completed until the required marking and report approvals are complete.

Part Nineteen: Resource Publishing Workflow 70. Resource statuses
● Draft ● Pending contributor approval ● Pending platform review ● Changes requested ● Approved ● Scheduled for publication ● Published

<!-- page 30 -->

● Restricted ● Unpublishing ● Unpublished ● Permanently withdrawn ● Archived 71. Resource preconditions
Publication may require:
● Approved current Resource Version ● Ownership declaration ● Contributor approval ● Licence ● Pricing ● Preview ● File scan ● Curriculum classification ● Moderation approval 72. Resource diagram flowchart LR A[Draft] --> B[Pending contributor approval] B --> C[Pending platform review] C --> D[Changes requested] D --> C C --> E[Approved] E --> F[Scheduled for publication] E --> G[Published] F --> G G --> H[Restricted] G --> I[Unpublishing] I --> J[Unpublished] J --> K[Permanently withdrawn]
Part Twenty: Support Case Workflow 73. Support Case statuses
● New ● Triage ● Open ● Awaiting user response ● Awaiting internal action ● Awaiting third party ● Under investigation ● Resolution proposed ● Closure scheduled

<!-- page 31 -->

● Closed ● Reopened ● Escalated ● Appeal open ● Archived 74. Case closure rules
A Case should not close while required Tasks remain incomplete.
Closure may include a grace period.
The user should see:
● Proposed resolution ● Closure date ● Objection route ● Reopening rights 75. Support Case diagram flowchart LR A[New] --> B[Triage] B --> C[Open] C --> D[Awaiting user response] C --> E[Awaiting internal action] C --> F[Under investigation] D --> C E --> C F --> G[Resolution proposed] G --> H[Closure scheduled] H --> I[Closed] I --> J[Reopened] J --> C C --> K[Escalated] I --> L[Appeal open]
Part Twenty-One: Appeal Workflow 76. Appeal statuses
● Draft ● Submitted ● Eligibility review ● Evidence requested ● Under independent review ● Decision pending ● Upheld ● Partially upheld ● Dismissed

<!-- page 32 -->

● Withdrawn ● Closed 77. Appeal outcomes
An appeal may result in:
● Original decision confirmed ● Restriction narrowed ● Suspension lifted ● Reinstatement review ● Permanent removal reversed ● New conditions ● Further investigation ● Financial correction ● New decision required

Part Twenty-Two: Organisation Workflow 78. Organisation statuses
● Draft ● Application submitted ● Verification pending ● Changes requested ● Approved ● Active ● Restricted ● Suspended ● Reinstatement review ● Permanently removed ● Voluntarily closed ● Archived 79. Organisation impact assessment
Suspension should assess:
● Organisation-owned services ● Tutors ● Programmes ● Cohorts ● Future bookings ● Parent payments ● Tutor payouts ● Resource access ● Organisation communications
The narrowest sufficient restriction should be preferred.

<!-- page 33 -->

Part Twenty-Three: Rule and Policy Workflow 80. Rule statuses
● Draft ● Pending review ● Changes requested ● Approved ● Scheduled ● Active ● Superseded ● Suspended ● Withdrawn ● Archived 81. Rule activation preconditions
A Rule Version should not become Active until:
● Scope defined ● Conflicts assessed ● Approval complete ● Effective date reached ● Required communication completed ● Migration impact assessed
Historic transactions should retain the Rule Version that originally applied.

Part Twenty-Four: Integration Workflow 82. Integration statuses
● Unconfigured ● Configuration in progress ● Testing ● Active ● Degraded ● Retry scheduled ● Restricted ● Disabled ● Revoked ● Archived

<!-- page 34 -->

83. Integration rules
    Integration failure should not automatically rewrite Studdy’s operational or financial records.
    External state and internal state should be reconciled through:
    ● Webhook Event ● Sync Job ● Processor Transaction ● Integration Error ● Reconciliation Task

Part Twenty-Five: Common Business Rules 84. No silent status changes
Every material status change should produce:
● Transition Record ● Status History ● Domain Event ● Audit entry ● Required notifications ● Related Tasks where applicable 85. No incomplete linked corrections
A status change affecting financial, learning or relationship records should not complete unless required linked corrections are created or explicitly waived. 86. Idempotency
Automated transitions should be safe to retry without producing duplicate:
● Payments ● Ledger Entries ● Notifications ● Tasks ● Refunds ● Commission Entries ● Bookings 87. Effective-time accuracy
Studdy should distinguish:
● Time the status change was requested

<!-- page 35 -->

● Time it was approved ● Time it became effective ● Time it was recorded ● Time an external system confirmed it 88. Actor attribution
Every transition should record whether it was performed by:
● User ● Parent ● Student ● Tutor ● Organisation representative ● Manager ● Platform Owner ● Automated system ● External integration 89. Notification proportionality
Not every internal status change requires a user notification.
Notifications should depend on:
● User impact ● Urgency ● Required action ● Financial consequence ● Safety consequence ● Ability to appeal ● Scheduled future effect 90. Repeated resubmission
Rejected requests should remain resubmittable unless locked by an authorised person.
A lock should record:
● Reason ● Scope ● Duration ● Appeal route ● Unlock authority ● Related Support Case
Repeated invalid or abusive requests may be routed into a formal appeal or support process. 91. Parent choice and continuity
Where tutoring arrangements change, Studdy should support continuity without removing family choice.

<!-- page 36 -->

A parent should not be forced to accept a replacement tutor unless a specific organisation programme rule was agreed in advance. 92. Historical integrity
Archived, cancelled, reversed or invalidated records should remain visible to authorised users where needed for:
● Audit ● Tax ● Financial reconciliation ● Appeals ● Safeguarding ● Dispute resolution ● Learning continuity

Part Twenty-Six: Required Transition Table Fields
Every detailed workflow table produced during technical design should contain:
Field Purpose
Current status Status from which action is allowed
Action Requested or automatic event
Target status Resulting status
Preconditions Required conditions
Blocking conditions Conditions preventing change
Authorised actor Person or system allowed to act
Approval formula Required approval combination
Acknowledgement User acknowledgement requirement
Grace period Delay before finalisation
Reminder rules Notifications before change
Linked corrections Financial or operational consequences
Domain Event Event emitted
Reverse route Approved correction path
Override rules Manager and Owner authority
Finality Whether ordinary reopening is allowed

<!-- page 37 -->

Part Twenty-Seven: Implementation Priorities 93. Initial implementation
The first production implementation should prioritise complete status models for:

1. Tutor application 2. Tutor account 3. Service publishing 4. Booking 5. Lesson 6. Payment 7. Payout and commission 8. Support Case
2. Later implementation
   Detailed automated workflows may then be added for:
   ● Homework ● Assessments ● Resources ● Organisations ● Appeals ● Integrations ● Rule activation ● Advanced privacy requests
3. Configuration approach
   Status names and core meanings should be centrally controlled.
   Country, organisation or service configuration may alter:
   ● Preconditions ● Approval formulas ● Grace periods ● Reminder schedules ● Financial consequences ● Review deadlines
   Configuration should not create contradictory meanings for the same status.

Part Twenty-Eight: Summary of Approved Principles

<!-- page 38 -->

Studdy will:
● Use shared lifecycle categories with module-specific statuses. ● Explain blocked actions clearly. ● Store an immutable record for every important status change. ● Check all transition preconditions together. ● Use grace periods where reversal is likely. ● Show meaningful upcoming automatic status changes. ● Support multi-party approval. ● Allow approval expiry and withdrawal. ● Invalidate approval when material information changes. ● Support approval delegation within controlled boundaries. ● Keep rejected requests resubmittable unless explicitly locked. ● Support conditional approval with mandatory Tasks. ● Suspend affected activity when critical conditions are missed. ● Apply the narrowest sufficient restriction. ● Distinguish Under Review, Restricted, Suspended and Permanently Removed. ● Give restrictions and suspensions required review dates. ● Preserve appeal rights in most serious cases. ● Use independent appeal reviewers where practical. ● Assess future bookings automatically when a tutor is suspended. ● Require parent approval before confirming a replacement tutor. ● Preserve legitimate historical access for suspended tutors. ● Keep restrictions active when reviews are overdue rather than restoring access automatically. ● Require structured reinstatement approval. ● Require tutors to confirm and republish services after reinstatement. ● Allow the Platform Owner to override any status with full auditing and consistency controls. ● Use both written transition tables and visual workflow diagrams. ● Provide hover or information explanations for technical statuses. ● Define finality separately for each workflow rather than forcing one universal terminal status.
