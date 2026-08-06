# Permissions, Roles and Access Control

> **Source document 08 of the Studdy planning pack.**
> Extracted verbatim from `08Permissions, Roles and Access Control.pdf` on 7 August 2026.
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

Studdy Permissions, Roles and Access
Control

Version: Draft 0.1
Product:

Studdy

Status:

Ready

for

review

1. Purpose
   This document defines how Studdy determines what each person can:
   ● View ● Create ● Edit ● Comment on ● Share ● Approve ● Download ● Export ● Archive ● Restore ● Restrict ● Suspend ● Override ● Impersonate ● Permanently delete
   It covers:
   ● Role-based access ● Capability-based permissions ● Relationship-based access ● Record-level scope ● Student and family permissions ● Tutor access ● Cross-tutor learning continuity ● Organisation access ● Manager roles and scopes ● Platform Owner authority ● Temporary access ● Sensitive-data controls ● Impersonation ● Exports and screenshots ● Session security ● Access explanations ● Audit and access history
   Studdy should apply the principle of minimum necessary access .
   A user should receive only the capabilities and information required for their legitimate role,
   relationship

and

purpose.

<!-- page 2 -->

Part One: Core Access-Control Principles 2. One identity, several roles
Every person should have one permanent User identity.
One User may hold several roles, including:
● Parent or guardian ● Dependent student ● Independent student ● Tutor ● Supporter ● Organisation member ● Organisation manager ● Platform Manager ● Platform Owner
Users should work within one role-specific workspace at a time.
Switching workspace should change:
● Navigation ● Available actions ● Search scope ● Messages ● Notifications ● Visible records ● Permission context
Permissions must remain separated by role even where one person holds several roles. 3. Capability-based permissions
Permissions should be built from reusable capabilities rather than hardcoded into each role.
A capability should normally combine:
● Resource ● Action ● Scope ● Limits ● Conditions
Examples include:
● booking.view ● booking.create

<!-- page 3 -->

● booking.cancel ● lesson_summary.edit ● lesson_summary.approve ● student_progress.view ● student_progress.export ● payment.refund ● resource.publish ● organisation_member.manage ● safeguarding_case.view ● user.impersonate 4. Standard permission actions
Standard actions should include:
● View ● Create ● Edit ● Comment ● Share ● Assign ● Approve ● Reject ● Request changes ● Download ● Export ● Archive ● Restore ● Restrict ● Suspend ● Reinstate ● Override ● Delete ● Permanently delete ● Impersonate
Additional module-specific actions may be created where required. 5. Access sources
A user’s effective access may come from several sources:
● User Role Assignment ● Family Membership ● Tutor–Student Relationship ● Tutor–Student Subject Link ● Organisation Membership ● Programme assignment ● Cohort assignment ● Supporter Relationship ● Manager Role ● Manager Scope

<!-- page 4 -->

● Case assignment ● Permission Grant ● Temporary Access Grant ● Approval Delegation ● Record ownership ● Record authorship ● Platform Owner authority
Studdy should preserve the source of each permission. 6. Combined access calculation
Effective access should be calculated from all relevant sources together.
The system should evaluate:
● Active role ● Active workspace ● Relationship status ● Subject scope ● Organisation scope ● Country or region ● Record visibility ● Sensitivity level ● Permission Grants ● Restrictions ● Suspensions ● Temporary access ● Financial limits ● Authentication strength ● Declared purpose ● Retention status 7. Restrictive conflict handling
Where permission sources conflict, the most restrictive applicable rule should normally win.
Examples:
● A general role permits viewing, but the record is safeguarding restricted → access denied. ● Organisation membership permits reporting, but the user lacks identifiable-student access → only aggregated data is shown. ● Tutor relationship permits progress access, but a parent has disabled cross-tutor sharing → records from other tutors remain hidden. ● A manager role permits exporting, but a temporary restriction blocks exports → export denied.
An authorised override may be allowed only through an explicit capability and audited process. 8. Access should not be inferred too broadly

<!-- page 5 -->

Access to one record does not automatically imply access to all linked information.
Examples:
● Access to a Support Case does not automatically grant safeguarding-section access. ● Access to a Student Profile does not automatically grant family payment information. ● Access to an Organisation does not automatically grant individual learning records. ● Access to a Booking does not automatically grant private tutor notes. ● Access to a Lesson does not automatically grant raw recording access.

Part Two: Capability Scopes and Limits 9. Standard record scopes
Capabilities should support standard scopes.
Own
Records belonging to the user.
Created
Records created by the user.
Assigned
Records formally assigned to the user.
Relationship-linked
Records available through an active family, tutor, student or supporter relationship.
Subject-linked
Records linked to an approved subject within an active tutoring relationship.
Programme-linked
Records linked to an assigned programme or cohort.
Organisation
Records owned by or assigned to the user’s organisation.
Regional
Records within an authorised region.
Country
Records within an authorised country.

<!-- page 6 -->

All
All records permitted by the role and sensitivity level. 10. Capability limits
Capabilities may include limits such as:
● Maximum refund amount ● Maximum credit amount ● Maximum financial adjustment ● Approved subjects ● Approved year levels ● Service types ● Student age ● Organisation ● Country ● Region ● Risk level ● Sensitivity level ● Export size ● Record count ● Date range ● Access duration ● Approved payment account ● Required authentication level
Examples:
● Finance Manager may approve refunds up to $500. ● Tutor may edit progress only for active students and approved subjects. ● Organisation manager may publish services only within their organisation. ● Verification reviewer may access identity documents only while the application remains assigned. 11. Exceeding a limit
Where an action exceeds a user’s limit, Studdy should:
● Block the action ● Explain the applicable limit ● Identify the required role or approver ● Allow an access or approval request where appropriate ● Preserve the attempted action in the audit log where significant

Part Three: Access Explanations 12. Information icon

<!-- page 7 -->

Important records, statuses and actions should include an information icon.
The icon should explain:
● Whether the user has access ● Which capability is required ● Which source grants access ● What scope applies ● What limits apply ● Which rule blocks access ● Whether stronger authentication is required ● What the user can do next ● Who can approve access
Example:
Refund unavailable ⓘ
Your Finance Manager role allows refunds up to $500. This request is for $720 and requires Senior Finance approval. 13. Why can I access this?
Where useful, Studdy should show every active source granting access.
Example:
You can view this student’s Mathematics progress because:
● You are their active Mathematics tutor. ● You are assigned to their organisation programme.
Removing one source should not remove access where another valid source remains. 14. Why can’t I access this?
A blocked-access explanation should state:
● Missing capability ● Missing relationship ● Scope mismatch ● Sensitivity restriction ● Expired access ● Required approval ● Required authentication ● Next action
Sensitive internal rules should not be exposed where doing so would create a security, fraud or safeguarding risk.

Part Four: Access Requests

<!-- page 8 -->

15. Request access from the blocked screen
    Users should be able to request access directly from a blocked record or action.
    The request should route automatically according to:
    ● Capability requested ● Record type ● Organisation ● Country or region ● Sensitivity ● Financial threshold ● Existing relationship ● Manager scope ● Assigned approver
16. Access Request record
    An Access Request should contain:
    ● Requester ● Requested capability ● Requested action ● Record or record scope ● Reason ● Educational, operational or business purpose ● Requested start date ● Requested end date ● Urgency ● Sensitivity level ● Required approver ● Approval status ● Conditions ● Discussion ● Evidence ● Revision history ● Created date ● Expiry date
    The request should seek the narrowest access reasonably required.
17. Access-request outcomes
    Access requests should support:
    ● Approve ● Approve with conditions ● Reject ● Request changes
    They should use the shared approval framework, including:
    ● Approval records ● Approval formulas

<!-- page 9 -->

● Expiry ● Delegation ● Discussion ● Attachments ● Revisions ● Material-change invalidation ● Audit logging 18. Conditional access
Approval conditions may include:
● Read-only access ● Named records only ● No downloads ● Stronger authentication ● Manager supervision ● Privacy training ● Limited date range ● Limited duration ● Purpose declaration ● Watermarked viewing

Part Five: Automatic Access Removal 19. Ending the access source
Access should normally end automatically when the source that granted it ends.
Examples:
● Tutor–Student Relationship closes ● Subject link ends ● Family Membership ends ● Organisation Membership ends ● Case assignment is removed ● Manager role ends ● Temporary Access Grant expires ● Delegation expires ● Permission Grant is revoked ● Programme assignment ends 20. Recalculate before removal
Studdy should recalculate all access sources before removing access.
Where another valid source still grants the capability, access should remain.
The access explanation should update to show the remaining source.

<!-- page 10 -->

21. Historical access
    Limited historical access may remain where needed for:
    ● Tax ● Earnings ● Payment disputes ● Appeals ● Completed lessons ● Legal obligations ● Safeguarding ● Audit ● Record correction
    Historical access should normally be:
    ● Read-only ● Time-limited where possible ● Restricted to relevant records ● Logged
22. Session effect
    Ordinary permission removal should take effect immediately at the permission level.
    The user may remain signed in but lose access to the affected records and controls.
    Studdy should recheck permissions when the user:
    ● Opens a record ● Refreshes a page ● Performs an action ● Changes workspace ● Downloads ● Exports ● Calls a protected API
    Entire sessions should be terminated immediately for:
    ● Account suspension ● Suspected compromise ● Serious safeguarding restriction ● Permanent removal ● Privileged manager access removal ● Security incident ● Serious privacy or fraud concern

Part Six: Parent and Family Permissions 23. Parent access to dependent students

<!-- page 11 -->

Parents or guardians should normally have access to the dependent student’s:
● Profile ● Bookings ● Lesson summaries ● Homework ● Assessments ● Progress ● Goals ● Payments ● Tutor relationships ● Assigned resources ● Tutor communications ● Important dates ● Concerns visible to parents
Exceptions may apply to:
● Safeguarding-only records ● Internal investigations ● Legally restricted information ● Security records ● Information whose disclosure creates a serious risk
Exceptions must rely on a defined rule, authorised decision and audit history. 24. Parent financial authority
Parents retain financial authority for dependent students.
Dependent students cannot normally:
● Approve payments ● Change payment methods ● Purchase packages ● Purchase paid assessments ● Approve price changes ● Approve refunds ● Manage credits ● Accept bank-transfer terms ● Manage commission-related matters 25. Parent-private notes
Parents may create private notes visible to:
● The authoring parent ● Authorised platform staff
These should remain hidden from:
● Tutors ● Dependent students ● Unauthorised family members ● Organisation users

<!-- page 12 -->

A parent may deliberately convert or share a private note.

Part Seven: Dependent-Student Permissions 26. Modular permission categories
Parents should manage dependent-student permissions by category rather than through one overall access level.
Categories should include:
● Bookings ● Rescheduling ● Cancellations ● Tutor communication ● Homework ● Learning records ● Goals ● Important dates ● Resources ● Financial visibility ● Profile information 27. Booking permissions
Parents may allow a dependent student to:
● View bookings ● Suggest preferred times ● Request a booking ● Request a reschedule ● Request a cancellation ● View exact tutor availability ● Book directly with approved tutors
Student-created requests may require parent approval.
Where direct booking is enabled:
● The parent is notified ● Financial control remains with the parent ● The student cannot approve price changes ● The student cannot buy paid products ● Permission may be revoked immediately 28. Financial visibility
Financial records should be hidden from dependent students by default.

<!-- page 13 -->

Parents may optionally allow selected information, such as:
● Whether a lesson is paid ● Remaining package lessons ● Booking credit availability ● General cancellation consequences
The following should remain hidden unless explicitly permitted:
● Payment methods ● Bank information ● Refund destination ● Family payment history ● Tutor earnings ● Commission ● Financial disputes ● Detailed credits 29. Learning permissions
Dependent students may normally:
● View student-friendly progress ● View approved lesson feedback ● Submit homework ● Upload files ● Add personal goals ● Add test dates ● View assigned resources ● Comment where permitted
They should not directly overwrite:
● Tutor-created goals ● Tutor progress judgements ● Formal concerns ● Assessment results ● Historical submissions
They may request correction. 30. Permission preview
Before saving a permission change, Studdy should preview:
● What the student can view ● What they can create ● What they can change ● What remains hidden ● What still requires parent approval ● Whether financial control remains with the parent ● Effects on pending requests ● Effects on current sessions

<!-- page 14 -->

31. Immediate enforcement
    Permission changes should normally take effect immediately.
    Examples:
    ● Booking authority revoked during a pending request → request pauses or returns to the parent. ● Messaging access removed → no new messages can be sent. ● Detailed progress access removed → only the student-friendly view remains. ● Financial visibility disabled → financial information disappears immediately.

Part Eight: Independent-Student Permissions 32. Independent-student authority
An independent student should have parent-equivalent control over their own:
● Bookings ● Payments ● Tutors ● Homework ● Progress ● Goals ● Concerns ● Assessments ● Resources ● Profile ● Communication ● Permissions ● Supporter access 33. Transition from dependent to independent
When a student becomes independent, access should be reviewed by category.
Possible outcomes include:
● Continue ● Read-only historical access ● Explicit Permission Grant required ● Immediate removal ● End after a transition period
Default approach:
● New bookings and communications become controlled by the independent student. ● Former-parent access to new records requires permission.

<!-- page 15 -->

● Family-paid historical financial records remain visible where relevant. ● Historical learning access may remain read-only according to the transition decision. ● Legal and safeguarding rules may override the normal arrangement. 34. Former-parent access
The independent student may grant the former parent:
● No access ● Read-only access ● Limited category access ● Selected-record access ● Booking assistance ● Supporter access
The independent student may later narrow or revoke access.

Part Nine: Supporter Permissions 35. Supporter default access
Supporter access should be view-only by default.
Possible areas include:
● Upcoming bookings ● Progress ● Homework ● Important dates ● Emergency information
Selected operational permissions may later be granted, such as helping manage bookings. 36. Supporter transparency
Tutors should be able to see:
● That a supporter exists ● Supporter name ● Relationship description ● Current permissions
The independent student may remove the supporter at any time.
All changes should remain in permission history.

Part Ten: Tutor Permissions

<!-- page 16 -->

37. Tutor operational permissions
    Tutors may generally:
    ● Manage their profile ● Manage services ● Manage pricing ● Manage availability ● Accept or decline bookings ● View assigned students ● Prepare lessons ● Record outcomes ● Assign homework ● Review homework ● Add progress updates ● Add goals ● Create concerns ● Create assessments ● Upload resources ● Manage relevant payments ● View commission records ● Communicate with authorised families ● Create invitation and referral codes
38. Relationship and subject limits
    Tutors should normally see only:
    ● Students with an active or authorised historical relationship ● Subjects covered by that relationship ● Records relevant to those subjects ● Records needed for active services ● Information necessary for lesson delivery
    A Mathematics tutor should not automatically see:
    ● English lesson records ● Unrelated assessments ● Family payment history ● Private family notes ● Another tutor’s private notes ● Unrelated Support Cases
39. Tutor internal notes
    Tutor internal notes should remain visible to:
    ● The creating tutor ● Authorised platform staff
    They should remain hidden from:
    ● Parents ● Students

<!-- page 17 -->

● Other tutors by default ● Organisation users without a specific capability
A tutor may convert an internal note into:
● Progress update ● Goal ● Concern ● Handover note ● Tutor-shared note 40. Historical tutor access
When the relationship ends, the tutor should lose access to future activity.
They may retain limited read-only access to:
● Lessons they delivered ● Summaries they authored ● Earnings records ● Payment disputes ● Handover records ● Appeal or case records

Part Eleven: Cross-Tutor Sharing 41. Default sharing
Approved subject-relevant learning records should be shared by default between active tutors working with the same student.
The parent or independent student may turn sharing off or narrow it. 42. Records shared by default
Subject-relevant records may include:
● Approved lesson summaries ● Progress updates ● Current goals ● Relevant assessments ● Homework outcomes ● Evidence ● Handover summaries ● Relevant formal concerns where permission allows 43. Records not shared by default
The following should remain private unless separately authorised:

<!-- page 18 -->

● Tutor internal notes ● Unapproved AI drafts ● Private planning ● Unrelated subjects ● Restricted concerns ● Safeguarding records ● Parent-private notes ● Manager internal notes 44. No silent overwriting
One tutor must not silently overwrite another tutor’s:
● Progress judgement ● Goal ● Observation ● Assessment result ● Concern
A tutor may:
● Add supporting evidence ● Suggest a change ● Comment ● Add a linked goal ● Create a new subject-specific judgement ● Request correction 45. Broader access requests
A tutor may request broader learning-record access where another subject contains genuinely relevant information.
The request should include:
● Record or subject requested ● Educational purpose ● Reason ● Requested duration ● Whether view-only access is sufficient
The parent or independent student normally approves. 46. Cross-tutor downloads
Cross-tutor learning access should be view-only inside Studdy by default.
Download should require:
● Separate capability ● Defined purpose ● Approved scope ● Data minimisation ● Watermarking

<!-- page 19 -->

● Access logging 47. Sharing changes
Tutors should be notified when sharing is:
● Enabled ● Disabled ● Materially narrowed ● Expanded
The notification should explain:
● Category affected ● Effective time ● Records no longer visible ● Whether access may be requested
Private reasoning should not be disclosed unless the parent or student chooses to share it.

Part Twelve: Organisation Permissions 48. Organisation membership
Organisation access should depend on:
● Organisation Membership ● Organisation role ● Scope ● Programme assignment ● Tutor assignment ● Student participation ● Capability limits ● Sensitivity rights
Membership alone should not provide blanket access. 49. Organisation role examples
Possible organisation roles include:
● Tutor ● Programme Manager ● Academic Manager ● Finance Manager ● Resource Manager ● Organisation Administrator ● Organisation Owner ● Support Coordinator

<!-- page 20 -->

50. Student learning access
    Organisation managers should see individual student learning records only where their role and programme responsibility genuinely require it.
    Examples:
    ● Finance Manager sees payment and attendance information, not learning observations. ● Programme Manager sees programme progress summaries. ● Academic Manager may view identified records for assigned students. ● Resource Manager does not receive student-record access.
51. Aggregated reporting by default
    Organisation reporting should use aggregated data by default.
    Examples:
    ● Student count ● Average attendance ● Homework completion rate ● Programme progress distribution ● Capacity ● Revenue ● Tutor activity
52. Pseudonymised reporting
    Where student-level analysis is needed without names, Studdy should use pseudonymised identifiers.
    Example:
    ● STUDENT-1048 ● STUDENT-1182
    Identifiable records should require an additional capability and legitimate programme purpose.
53. Organisation-managed permissions
    Authorised organisation managers may manage:
    ● Organisation members ● Organisation roles ● Programme assignments ● Tutor assignments ● Organisation resources ● Organisation services ● Internal approvals
    They may not override locked platform rules involving:

<!-- page 21 -->

● Safeguarding ● Legal obligations ● Privacy ● Audit ● Security ● Platform financial controls

Part Thirteen: Platform Manager Permissions 54. Manager capability model
Manager authority should depend on both:
● What the manager can do ● Where and to whom they may do it
A manager role should define:
● Capabilities ● Country or region ● Organisation scope ● Subject scope ● Financial limits ● Approval rights ● Export rights ● Impersonation rights ● Sensitive-data rights ● Alert requirements 55. Example manager roles
Possible roles include:
● Tutor Onboarding Manager ● Support Manager ● Finance Manager ● Safeguarding Manager ● Content Manager ● Marketplace Manager ● Organisation Manager ● Technical Operations Manager ● Privacy Manager 56. Case assignment
Assignment to a case may grant access only to:
● The case

<!-- page 22 -->

● Linked records required for the case ● Approved restricted sections ● Related communication ● Evidence ● Required actions
Case assignment should not automatically grant unrelated records. 57. Manager overrides
Managers may override only within:
● Assigned capability ● Module ● Scope ● Financial threshold ● Risk authority ● Sensitivity clearance ● Temporary Access Grant
All overrides should require:
● Reason ● Audit record ● Impact preview where material ● Approval where required ● User notification where appropriate

Part Fourteen: Platform Owner Permissions 58. Platform Owner authority
The Platform Owner should be able to:
● Configure platform roles ● Create manager roles ● Assign manager scopes ● Grant temporary elevated access ● Manage global rules ● Access audit records ● Perform owner-level overrides ● Manage emergency controls ● Approve permanent deletion ● Manage ownership transfer ● Access platform-wide configuration 59. Owner access is still audited

<!-- page 23 -->

Platform Owner authority should not mean invisible or untracked access.
Owner actions should still record:
● Identity ● Role ● Purpose ● Date and time ● Original value ● New value ● Scope ● Approval ● Correlation ID ● Impersonation status 60. High-risk owner actions
High-risk owner actions should require:
● Strong authentication ● Explicit reason ● Impact preview ● Confirmation ● Optional second approval ● Detailed audit logging
Examples include:
● Permanent deletion ● Manager privilege escalation ● Emergency suspension ● Financial write-off ● Ownership transfer ● Disabling safeguarding rules ● Accessing owner-only legal material

Part Fifteen: Sensitive Data 61. Sensitive-data categories
Separate capabilities should apply to:
● Safeguarding records ● Identity documents ● Background checks ● Medical or learning-support information ● Payment methods ● Bank and payout details ● Restricted case notes ● Legal records

<!-- page 24 -->

● Privacy evidence ● Raw recordings ● Raw transcripts ● Authentication data ● Security records ● Owner-only controls 62. Sensitive-access conditions
Sensitive access may require:
● Additional capability ● Active assignment ● Strong authentication ● Declared purpose ● Time limit ● Read-only restriction ● No-download restriction ● Watermarking ● Access logging ● Approval ● Periodic review 63. Purpose declaration
Purpose declaration should be required for the highest-risk access, including:
● Safeguarding records outside an assigned case ● Identity and background-check documents ● Sensitive exports ● Former-user restricted records ● Temporary elevated access ● Owner-only privacy or legal data ● Impersonation access to sensitive records ● Records outside ordinary assignment
Accepted purposes may include:
● Safeguarding investigation ● Identity verification ● Payment dispute ● Privacy request ● Legal obligation ● Approved quality review ● Technical investigation
Where a manager is already assigned to the relevant case, the assignment may serve as the purpose.

Part Sixteen: Access History

<!-- page 25 -->

64. User-visible access history
    Parents and independent students should be able to view meaningful access history for sensitive student information.
    It should show:
    ● Viewer ● Viewer role ● Data category ● Date and time ● Access source ● Purpose ● View, download, export or change ● Temporary or standard access ● Impersonation status
65. Priority access-history events
    The main view should prioritise:
    ● Safeguarding access ● Medical or learning-support records ● Identity records ● Recordings and transcripts ● Restricted concerns ● Downloads ● Exports ● Manager access ● Impersonation ● Access after relationship closure
    Ordinary active-tutor viewing may remain available in a detailed audit view without generating constant notifications.
66. Access notifications
    Users should normally be notified when access is:
    ● Granted ● Expanded ● Narrowed ● Revoked ● Temporarily elevated ● Used for a high-risk export ● Used through impersonation for a material action
    Users should not receive a notification every time an active tutor opens an ordinary authorised record.

<!-- page 26 -->

Part Seventeen: Exports, Downloads and Screenshots 67. Export permission levels
Capabilities may permit:
● No export ● Aggregated report only ● PDF ● CSV ● Scheduled export ● Sensitive export ● Raw-data export 68. Data minimisation
Exports should automatically remove or mask information outside the approved purpose and scope.
Controls may include:
● Masked email ● Masked phone ● Hidden address ● Student reference instead of name ● Removed private notes ● Removed safeguarding content ● Limited subjects ● Limited date range ● Removed payment details ● Aggregated results 69. Sensitive export controls
Sensitive exports should require:
● Strong authentication immediately before generation ● Purpose declaration ● Permission revalidation ● Watermark ● Audit logging ● Secure download link ● Expiry ● Download limit ● Data masking ● Owner or specialist approval where required 70. Screenshot limitations

<!-- page 27 -->

Studdy should reduce casual copying but should not claim screenshots can be completely prevented.
Controls may include:
● Visible viewer watermarks ● Confidential labels ● Disabling app screenshots where supported ● Hiding content in app-switcher previews ● Preventing print and copy for selected records ● Reauthentication before viewing ● Partial reveal of highly sensitive information ● Logging access to sensitive screens
A person may still photograph a screen using another device.
Watermarking, minimisation and audit logging are therefore more reliable than screenshot blocking alone. 71. Sensitive-screen watermark
Highly sensitive screens should display:
● Viewer name ● Viewer role ● Date and time ● Session reference ● Confidential classification
Watermarks should also appear on authorised downloads and printouts.

Part Eighteen: Session and Device Security 72. Active sessions
Users should be able to view:
● Device ● Browser or app ● Approximate location ● Sign-in time ● Last activity ● Authentication method ● Current session ● Elevated access status 73. Session controls

<!-- page 28 -->

Users should be able to:
● Sign out one device ● Sign out all other devices ● Revoke a suspicious session ● Review recent security activity ● Update credentials ● Enable stronger authentication 74. Sensitive-record inactivity timeout
Access to highly sensitive records should expire after a short period of inactivity even where the general account session remains active.
The user should be required to:
● Reauthenticate ● Reconfirm purpose where applicable ● Reopen the sensitive record
The rest of the Studdy session may remain active. 75. Strong-authentication events
Stronger authentication should be required for:
● Sensitive exports ● Bank or payout changes ● Authentication changes ● Manager privilege changes ● Permanent deletion ● Owner actions ● High-risk impersonation ● Highly sensitive record access where configured

Part Nineteen: Temporary Access 76. Temporary Access Grant
Temporary access should define:
● User ● Capability ● Scope ● Reason ● Start time ● Expiry time ● Approver ● Conditions ● Sensitive-data rights

<!-- page 29 -->

● Download rights ● Status ● Revocation details 77. Automatic expiry
Temporary access should always expire automatically.
An extension should require new or revised approval confirming:
● Access is still necessary ● Scope remains correct ● Role remains active ● No narrower option is available ● Risk remains acceptable 78. Expiry reminders
The user and approver may receive reminders before expiry where continued access may be needed.
Expired access must not remain active because nobody reviewed it.

Part Twenty: Impersonation 79. Impersonation purpose
Impersonation should be used for:
● Troubleshooting ● Reproducing user-interface issues ● Understanding permission problems ● Verifying what the user sees ● Limited support actions
It should not be used as a hidden administrative shortcut. 80. Read-only by default
Impersonation should be read-only by default.
Recommended capability split:
● impersonation.view ● impersonation.interact ● impersonation.sensitive_interact
Interactive impersonation should require:

<!-- page 30 -->

● Additional capability ● Specific reason ● Appropriate scope ● Limited duration ● Audit logging 81. Required reason and banner
Impersonation must require a reason before it begins.
A permanent banner should show:
● Represented user ● Real manager ● Reason ● Start time ● Read-only or interactive status ● Exit action 82. Privilege ceiling
Managers must not impersonate users with a higher privilege level than their own.
Scope restrictions also apply.
Examples:
● Organisation manager cannot impersonate Platform Manager. ● Finance Manager cannot impersonate Platform Owner. ● General support manager cannot impersonate a safeguarding specialist to gain restricted access. 83. Permission behaviour during impersonation
Impersonation should not bypass ordinary approvals or limits.
An action must be allowed by both:
● The represented user’s permission ● The impersonating manager’s permission
The more restrictive result applies.
Where the manager needs to exceed the user’s authority, they should exit impersonation and use an explicit admin action. 84. Sensitive actions blocked during impersonation
The following should normally be blocked:
● Changing payment methods ● Changing bank details ● Changing payout details

<!-- page 31 -->

● Resetting authentication ● Resetting multi-factor authentication ● Changing student permissions ● Granting supporter access ● Accepting legal terms ● Providing consent ● Approving payments ● Approving refunds ● Exporting sensitive data ● Permanent deletion ● Manager permission changes ● Platform Owner actions 85. Impersonation history
Users should be able to view material actions performed through impersonation.
The history should show:
● Date and time ● Support or manager identity ● Reason ● Read-only or interactive status ● Records changed ● Actions performed ● Outcome ● Related Support Case ● Correction or reversal history
Routine read-only troubleshooting may be summarised as one session.
Confidential internal notes and restricted safeguarding information do not need to be disclosed.

Part Twenty-One: Audit Requirements 86. Access logging
The following should be logged:
● Sensitive record view ● Download ● Export ● Impersonation ● Permission change ● Temporary access ● Approval delegation ● Access request ● Restriction ● Override

<!-- page 32 -->

● Failed access attempt ● Strong-authentication event 87. Audit fields
Audit records should include:
● Actor ● Actor role ● Active workspace ● Capability ● Scope ● Action ● Entity ● Date and time ● Access source ● Purpose ● Original value ● New value ● Impersonation status ● Approval ● Correlation ID ● Risk level ● Session reference 88. Audit immutability
Audit records should not be edited or deleted through ordinary workflows.
Corrections should use:
● Linked correction records ● Reversal entries ● Explanatory amendments

Part Twenty-Two: Role Summary 89. Parent or Guardian
May normally:
● Manage dependent students ● Control student permissions ● Manage tutors ● Manage bookings ● Manage payments ● View learning records ● View concerns shared with parents ● Approve cross-tutor sharing

<!-- page 33 -->

● Request support ● Manage family locations ● Manage favourites
May not:
● Overwrite tutor-created learning records ● View safeguarding-only sections without authorisation ● Act as the tutor ● Access unrelated families 90. Dependent Student
May receive permission to:
● View lessons ● Request bookings ● Communicate with tutors ● Submit homework ● View progress ● Add goals ● Add important dates ● View resources
May not normally:
● Manage family finances ● Approve prices ● Buy paid products ● Manage refunds ● View private tutor notes ● View parent-private notes ● View safeguarding records 91. Independent Student
May normally:
● Manage their own tutors ● Manage bookings ● Manage payments ● Control permissions ● Control supporter access ● Control former-parent access ● View and manage their learning record ● Request corrections ● Manage resources and assessments 92. Tutor
May normally:
● Manage profile and services ● Manage assigned students

<!-- page 34 -->

● Deliver lessons ● Record learning activity ● Assign and review homework ● Add goals, progress and concerns ● View approved shared records ● Manage relevant earnings ● Communicate with authorised users
May not normally:
● View unrelated subjects ● View family finances ● View other tutors’ private notes ● View safeguarding sections ● Alter another tutor’s judgement ● Access future student activity after relationship closure 93. Supporter
May normally receive:
● View-only access ● Selected booking information ● Selected learning information ● Selected homework or important dates
Additional actions require explicit Permission Grants. 94. Organisation User
Access depends on:
● Membership role ● Programme assignment ● Organisation scope ● Student assignment ● Capability ● Sensitivity level
Organisation membership alone does not grant full student access. 95. Platform Manager
Access depends on:
● Manager role ● Manager scope ● Financial limit ● Case assignment ● Sensitive-data capability ● Temporary Access Grant
Manager actions must be auditable.

<!-- page 35 -->

96. Platform Owner
    May exercise platform-wide authority, subject to:
    ● Strong authentication ● Audit ● Impact review ● High-risk confirmations ● Optional second approval ● Legal and safeguarding obligations

Part Twenty-Three: Technical Enforcement Principles 97. Server-side enforcement
Permissions must be enforced on the server and database layer.
Hidden interface controls alone are not sufficient. 98. Database policies
Database access should use:
● Row-level restrictions ● Relationship checks ● Scope checks ● Sensitivity checks ● Active-status checks ● Permission Grants ● Owner-level exceptions 99. API enforcement
Every protected API action should revalidate:
● User identity ● Active role ● Workspace ● Capability ● Scope ● Record relationship ● Sensitivity ● Current restrictions ● Authentication strength ● Access expiry

<!-- page 36 -->

100. Search enforcement
     Search should return only records the user can access.
     Search must not expose:
     ● Hidden titles ● Record counts ● Snippets ● Sensitive references ● Unauthorised relationships
101. Notification enforcement
     Notifications should not reveal information the recipient cannot access.
     When access ends:
     ● Future notifications stop ● Existing links are revalidated ● Scheduled reports stop ● Saved shortcuts disappear ● Message visibility updates
102. Export-time revalidation
     Permission should be checked both:
     ● When the export is requested ● When the export is generated ● When the export is downloaded
     A delayed export should be cancelled if the user loses access before completion.

Part Twenty-Four: Approved Access Principles
Studdy will:
● Use reusable action-and-resource capabilities. ● Calculate access from roles, relationships, scopes and grants. ● Apply the most restrictive applicable rule. ● Explain important access decisions through an information icon. ● Allow access requests from blocked screens. ● Grant only the narrowest access required. ● Expire temporary access automatically. ● Revoke access when its source ends. ● Preserve narrow historical access where legally or operationally necessary. ● Give parents control over dependent-student permissions.

<!-- page 37 -->

● Hide dependent-student financial information by default. ● Use modular student permission categories. ● Give independent students control over new records and supporter access. ● Restrict tutors to relevant students and subjects. ● Enable approved subject-relevant cross-tutor sharing by default. ● Allow parents and independent students to disable or narrow sharing. ● Keep tutor internal notes private by default. ● Make cross-tutor access view-only by default. ● Limit organisation access by role, programme and purpose. ● Use aggregated organisation reporting by default. ● Require additional capability for identifiable student records. ● Use separate capabilities for highly sensitive information. ● Require purpose declarations for the highest-risk access. ● Provide meaningful sensitive-access history. ● Minimise and mask exports. ● Use visible watermarks on highly sensitive screens. ● Require stronger authentication for sensitive exports. ● Support active-device and session revocation. ● Expire sensitive-record access after inactivity. ● Make impersonation read-only by default. ● Require a reason and permanent banner for impersonation. ● Prevent managers from impersonating higher-privilege users. ● Block highly sensitive actions during impersonation. ● Preserve user-visible history of material impersonation actions. ● Audit Platform Owner access and overrides. ● Enforce permissions through server, API and database controls.
