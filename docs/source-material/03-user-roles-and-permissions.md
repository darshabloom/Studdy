# User Roles and Permissions

> **Source document 03 of the Studdy planning pack.**
> Extracted verbatim from `03User Roles and Permissions.pdf` on 7 August 2026.
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

Studdy User Roles and Permissions
Status: Draft 0.1
Product:

Studdy

1. Purpose
   This document defines the main Studdy user roles, their account relationships, permissions
   and

visibility

boundaries.

These rules should guide:
● Authentication ● Role-based navigation ● Dashboards ● Database permissions ● Admin tooling ● Student privacy ● Tutor collaboration ● Booking workflows ● Payment controls ● Audit history
Permissions should be configurable where practical, while maintaining clear platform-wide
safeguards.

2. Core Roles
   Studdy should support the following roles:
   ● Tutor ● Parent or guardian ● Dependent student ● Independent student ● Supporter ● Admin
   One person may hold several roles under the same account.
   Examples include:
   ● Tutor and parent ● Tutor and independent student ● Parent and admin ● Tutor, parent and admin
   Users should enter one role workspace at a time.
   A clear role switcher should allow users to move between their available workspaces without
   signing

out.

<!-- page 2 -->

Data and permissions must remain separated by role, even when the same person holds several roles. 3. Account Identity
Every user should have one primary account identity.
The account may contain:
● User ID ● Profile photo ● Display name ● Contact information ● Login credentials ● Notification settings ● Active roles ● Verification status ● Audit history
Role-specific information should remain attached to the relevant role profile.
For example, tutor pricing and availability belong to the tutor profile, while family details belong to the parent role. 4. Profile Photos
Profile photos should be supported for:
● Tutors ● Parents ● Students ● Independent students ● Supporters ● Admin users
Tutor photos may appear publicly.
Dependent student photos should remain private to authorised users.
Parents should control whether a dependent student’s photo is visible to:
● Assigned tutors ● Other authorised family users ● Admin
Students should never have public marketplace profiles. 5. Family Account Model
The main family journey should use one primary parent or guardian account.
The primary parent manages:
● Student profiles

<!-- page 3 -->

● Bookings ● Payments ● Student permissions ● Tutor relationships ● Locations ● Progress access ● Homework access ● Assessments ● Favourites ● Family notifications
A second guardian may be invited later as an optional capability.
Multiple-guardian management should remain outside the main initial user journey.
Where an additional guardian is enabled, their access should be recorded and visible to authorised family users and tutors where relevant. 6. Student Profiles and Student Workspaces
Every student should have:
● A permanent Student ID ● A student profile ● A student workspace ● A learning history ● Role-specific permissions
A student profile may exist before the student has a separate login.
Young students may initially access their workspace through parent-managed access on a trusted device.
Separate student login methods may later include:
● Email login ● Username and PIN ● Parent-managed access ● Passkey ● Other age-appropriate authentication
The login method may remain flexible while the student profile and permissions stay consistent. 7. Dependent Student Role
A dependent student is linked to a parent or guardian who retains financial and permission control.
Dependent student dashboard
The dependent student should see a simplified view containing:
● Next lesson ● Homework

<!-- page 4 -->

● Student-friendly goals ● Upcoming tests and deadlines ● Simple progress indicators ● Approved lesson feedback ● Assigned resources ● Booking requests they are authorised to manage
Information hidden from dependent students
Dependent students should not see:
● Payment information ● Tutor concerns ● Detailed parent-facing progress analysis ● Internal tutor notes ● Parent-private notes ● Incident records ● Admin records ● Sensitive safeguarding information 8. Dependent Student Booking Permissions
Parents can create bookings for dependent students without student approval.
Parents control whether a dependent student may:
● Request a booking ● Request a reschedule ● Request a cancellation ● Add preferred lesson times ● View exact availability ● Communicate through the Studdy messaging system
Student-created booking requests should normally go to the parent for approval.
Parents may grant direct booking authority to an older dependent student.
Where direct booking authority is enabled:
● The request may go directly to the tutor. ● The parent receives a notification. ● The parent retains all financial control. ● The student cannot approve price changes or paid products. ● The parent can revoke the permission immediately.
If permission is revoked while a request is pending, the request should pause or return to the parent. 9. Dependent Student Financial Permissions
Parents control all financial actions for dependent students.
Dependent students cannot:
● Approve price changes

<!-- page 5 -->

● Purchase packages ● Purchase paid assessments ● Approve refunds ● Manage credits ● Change payment methods ● Approve Stripe payments ● Confirm bank-transfer terms ● Accept commission-related terms
Dependent students should not see family payment records. 10. Dependent Student Learning Permissions
Dependent students may:
● Submit homework ● Upload files ● Type homework responses ● Add test and exam dates ● Add personal learning goals ● View student-friendly progress ● View assigned resources ● View approved lesson summaries
Dependent students cannot edit tutor-created goals.
Student-created goals may later be:
● Accepted into the formal learning plan ● Linked to tutor-created goals ● Commented on ● Archived
Students should not permanently delete:
● Homework submissions ● Test dates ● Learning records
They may request correction or removal.
Parents and tutors may correct student-created information.
Corrections should preserve:
● Original value ● Corrected value ● Person making the correction ● Date and time ● Reason where relevant 11. Parent Role
Parents should be able to:

<!-- page 6 -->

● Create and manage student profiles ● Find and shortlist tutors ● Request bookings ● Manage recurring bookings ● Reschedule and cancel bookings ● Control student permissions ● Pay for tutoring ● Manage packages and credits ● View approved lesson summaries ● View homework and assessments ● View simple and detailed progress ● Add tests and important dates ● Comment on goals and concerns ● Request corrections ● Save tutors to favourites ● Add private notes to favourites ● Manage saved addresses ● Provide pet and safety information ● Report concerns ● Archive student profiles ● Remove tutors from an active student relationship
Parents should not directly overwrite tutor-created learning records.
They may comment, provide context and request changes. 12. Parent-Private Notes
Parents may create notes visible only to:
● The parent ● Authorised admin
These notes remain hidden from:
● Tutors ● Dependent students ● Other unrelated users
Parents should be able to convert or share a private note when the information becomes relevant to a tutor.
Admin access to parent-private notes is available by default under the approved admin-access model.
Access should remain logged. 13. Tutor Role
Tutors should be able to:
● Manage their public profile ● Set subjects and year levels ● Set prices ● Set discounts

<!-- page 7 -->

● Create packages ● Manage availability ● Manage capacity ● Accept or decline bookings ● Enable instant booking later ● Manage waiting lists ● View assigned student profiles ● Prepare lessons ● Create lesson plans ● Record lesson outcomes ● Assign and review homework ● Track progress ● Add goals and concerns ● Create assessments ● Upload resources ● Create paid resources ● Review community resources ● Communicate with families ● Manage payment records relevant to their services ● View commission statements ● Create referral and invitation codes ● Hide or unlist their public profile ● Invite families through private links
Tutors should see only information relevant to their tutoring relationships and authorised platform functions. 14. Tutor Internal Notes
Tutors may create private internal notes for legitimate tutoring purposes.
Examples include:
● Teaching approaches to try ● Lesson-planning observations ● Follow-up reminders ● Unconfirmed learning hypotheses ● Resource ideas ● Context that is premature for parent-facing publication
Internal notes should remain visible to:
● The tutor who created them ● Authorised admin
They should remain hidden from:
● Parents ● Students ● Other tutors by default
Tutors may convert an internal note into:
● A parent-visible concern ● A progress update

<!-- page 8 -->

● A goal ● A handover note ● A tutor-shared note
Internal notes should not become a place for inappropriate personal commentary. 15. Tutor Handover and Collaboration
When a tutor ends a student relationship, Studdy should prompt them to create a concise handover summary.
Tutors working with the same student may choose whether to share:
● Lesson summaries ● Goals ● Selected notes ● Progress evidence ● Relevant concerns ● Handover information
Sharing should be explicit and traceable.
Shared records should show:
● Creator ● Date created ● Sharing status ● Date shared ● Who can view it
Parents may control whether tutors can see one another’s records.
The recommended default is sharing within the same subject or closely related learning area.
Tutors should not overwrite another tutor’s goals or progress judgement.
They may:
● Suggest a change ● Add a linked goal ● Create a subject-specific goal ● Add supporting evidence ● Comment on the existing record 16. Overall Student Progress Record
Each student should have one overall Studdy progress record.
Progress should be organised by:
● Subject ● Curriculum area ● Skill ● Goal

<!-- page 9 -->

● Assessment ● Contributing tutor ● Supporting evidence
Each contribution should remain attributable to its creator.
Progress should be additive and traceable.
One tutor should not silently replace another tutor’s judgement. 17. Concerns
Tutors may create concerns relating to a student’s learning or tutoring support.
A concern may be visible to:
● Tutor ● Parent ● Authorised admin
The tutor may mark a concern as hidden from the dependent student.
Parents may:
● View concerns ● Comment ● Add context ● Request a correction ● Mark a concern as urgent for admin attention
Parents cannot directly edit tutor-created concerns.
Tutors may:
● Update concerns ● Add evidence ● Close concerns ● Reopen concerns ● Convert internal notes into concerns
Closed concerns should remain visible in detailed history. 18. Independent Student Role
An independent student has parent-equivalent control over their own tutoring account.
They should be able to manage:
● Bookings ● Payments ● Tutors ● Homework ● Progress ● Goals ● Concerns

<!-- page 10 -->

● Assessments ● Resources ● Important dates ● Supporter access ● Profile information ● Communication ● Permissions
Independent students may join in two ways:
● Independent from sign-up ● Transition from an existing dependent profile 19. Independent from Sign-Up
A person may choose to register as an independent student from the beginning.
They receive full control without creating a parent account.
This is suitable for:
● Older secondary students where appropriate ● Tertiary students ● Adult learners ● Other self-managing students
Studdy may apply eligibility checks where needed. 20. Transition from Dependent to Independent
A dependent student may request independent status later.
This transition requires admin approval.
Input may be requested from:
● Student ● Parent or guardian ● Tutor
The transition process should confirm:
● Payment responsibility ● Parent access ● Existing bookings ● Support needs ● Student responsibilities ● Tutor awareness
Tutors should be notified when the student’s status changes.
The former parent retains access to historical records from the period when they managed the account.
The independent student controls access to new records.

<!-- page 11 -->

They may grant the former parent:
● No access ● Read-only access ● Limited access ● Access to selected areas
The independent student can later invite the parent back.
Admin may reverse independent status where:
● It was granted in error ● A serious safeguarding issue exists ● The account structure is materially incorrect
Any reversal must be logged and explained. 21. Supporter Role
An independent student may appoint a trusted supporter.
Supporter access should be view-only by default.
Possible view permissions include:
● Upcoming bookings ● Progress ● Homework ● Important dates ● Emergency information
The independent student may later grant selected actions, such as helping manage bookings.
Tutors should be able to see:
● That a supporter exists ● The supporter’s name ● Their relationship description ● Their current permissions
Independent students can remove supporters at any time.
All supporter access changes should remain in audit history. 22. Student Profile Lifecycle
Parents should archive student profiles rather than permanently delete them.
Archiving should:
● Hide the profile from routine family views ● Preserve lesson history ● Preserve payments ● Preserve homework ● Preserve progress

<!-- page 12 -->

● Preserve assessments ● Preserve tutor relationships ● Preserve audit history
Parents should be able to restore archived profiles.
Past tutors may retain access only to records from their own tutoring relationship, subject to retention rules.
Admin should be able to:
● Merge duplicate student profiles ● Transfer a student profile between family accounts ● Correct relationship errors ● Preserve history during transfers
Profile merging should preserve:
● Bookings ● Payments ● Homework ● Progress ● Assessments ● Notes ● Concerns ● Tutor relationships ● Audit history
Conflicts should be reviewed before the merge is completed. 23. Removing a Tutor
Parents may remove a tutor from a student’s active profile.
Removing a tutor should:
● End access to future student activity ● End new booking access unless re-invited ● Preserve past lesson records ● Preserve payment records ● Preserve tutor-created progress contributions ● Preserve relevant audit history
The tutor retains access to past lesson records they created, subject to retention and safeguarding rules. 24. Tutor Profile Visibility
Tutors may change their public visibility.
Possible states include:
● Public and recommended ● Public with reduced recommendation visibility ● Unlisted

<!-- page 13 -->

● Existing students only ● Waiting-list only ● Fully suspended
An unlisted tutor:
● Remains available to existing students ● Can accept bookings through a tutor code ● Can accept private-link invitations ● Does not appear in ordinary public search ● Does not appear in normal recommendations ● Remains visible to families who previously favourited them ● Displays an Unlisted label
Families may be prompted to remove an unlisted tutor from favourites unless they already have an active relationship or invitation. 25. Tutor Codes and Private Invitations
Every tutor should have:
● A permanent tutor identity code ● A permanent private profile link
Tutors may also create separate codes for:
● Individual families ● Referral sources ● Promotions ● Schools ● Community groups ● Existing-student referrals ● Subjects ● Services
Code types may include:
● Single-use ● Single-family ● Reusable ● Limited-use ● Expiring
Default direct family invitations should be single-use.
Tutors may intentionally create reusable codes for referrals and promotion.
Tutor codes should help identify:
● Who introduced the family ● Whether a relationship is tutor-brought ● Which payment rules apply ● Referral attribution ● Promotion performance

<!-- page 14 -->

26. Tutor-Brought and Marketplace Relationships
    Source classification belongs to each tutor–family relationship.
    A family may be:
    ● Tutor-brought for Tutor A ● Marketplace-sourced for Tutor B
    Tutor-brought relationship
    The family may pay that tutor through:
    ● Bank transfer ● Cash ● Stripe
    The tutor still owes Studdy commission on chargeable bookings.
    Marketplace relationship
    Payments should go through Stripe by default.
    Studdy’s fee should be collected automatically.
    Admin may approve exceptions.
    Admin can correct the source classification with a logged reason.
27. Referral Credits
    Referral rewards may apply to:
    ● Tutor referrals ● Family referrals ● Tutor-brought relationships ● Marketplace relationships
    Tutor referral credits should reduce Studdy commission owed.
    They may be used regardless of whether the lesson payment was made through:
    ● Stripe ● Bank transfer ● Cash
    Family referral credits should initially apply only to Stripe-paid lessons.
    Tutors may see which referral generated their commission credit, using limited identifying information.
    Referral rewards should become available only after the referred family completes and pays for its first eligible lesson.
    Possible rewards include:

<!-- page 15 -->

● Commission credit for the referring tutor ● First-lesson credit for the referred family ● Family referral credit ● Limited-time commission reduction
Admin should control:
● Reward amount ● Eligibility ● Expiry ● Maximum balance ● Promotion limits ● Revocation ● Misuse handling
The recommended credit expiry is 12 months.
Pending credits may remain queued when an account reaches its maximum balance. 28. Referral Credit Use
Families should choose when to apply referral credit at Stripe checkout.
Tutors may exclude selected discounted lessons or packages from referral-credit use.
Admin may set:
● Maximum combined discount ● Minimum payable amount ● Credit stacking rules ● Eligible services ● Expiry rules
Checkout should separately display:
● Tutor discount ● Referral credit ● Studdy-funded credit ● Final payable amount
Admin may revoke rewards where fraud, duplicate accounts or misuse is found.
All referral credit activity should remain in a ledger. 29. Admin Role
Admin should have broad platform capabilities for:
● Support ● Safeguarding ● Moderation ● Quality assurance ● Payment administration ● Account correction ● Tutor management

<!-- page 16 -->

● Content management ● User management ● Platform configuration
Admin access should be powerful and auditable. 30. Admin Data Access
Authorised admin may access:
● User profiles ● Student profiles ● Bookings ● Lesson records ● Homework ● Progress ● Concerns ● Payments ● Messages ● Recordings ● Transcripts ● Internal tutor notes ● Parent-private notes ● Incident records ● Referral records ● Audit history
Sensitive access should be logged.
Ordinary support access does not need to notify users every time.
Users should be notified about:
● Material amendments ● Reversals ● Impersonation that changes data ● Account restrictions ● Significant profile changes ● Pricing changes made by admin 31. Admin Impersonation
Admin may impersonate another user for troubleshooting.
Impersonation should:
● Require a reason ● Display a clear admin banner ● Create an audit record ● Distinguish admin actions from real-user actions ● Prevent silent high-risk changes where practical
Users should be able to view material changes made during impersonation.

<!-- page 17 -->

32. Admin Amendments
    Sensitive records should normally be corrected through logged amendments.
    An amendment should preserve:
    ● Original value ● Corrected value ● Admin identity ● Date and time ● Reason
    Sensitive records include:
    ● Payments ● Bookings ● Progress ● Concerns ● Permissions ● Tutor verification ● Incidents ● Account status
    Direct editing may be used for low-risk information such as:
    ● Spelling errors ● Duplicate tags ● Contact details ● Formatting ● Administrative labels
33. Admin Reversals and Overrides
    Admin may reverse or override:
    ● Booking actions ● Payment actions ● Progress actions ● Tutor assignments ● Visibility settings ● Account permissions ● Student status ● Referral classifications ● Referral rewards
    Reversals should preserve the original action and reason.
    Admin may create bookings on behalf of parents and tutors.
    Admin-created bookings should show:
    ● Admin creator ● Reason ● Date created ● Any overridden rules

<!-- page 18 -->

Normal tutor acceptance and payment rules should still apply unless admin explicitly overrides them. 34. Admin Tutor Management
Admin may:
● Approve tutors ● Reject tutors ● Change tutor status ● Edit verification labels ● Correct tutor profiles ● Remove inappropriate content ● Publish profiles ● Unpublish profiles ● Reduce recommendation visibility ● Unlist tutors ● Suspend tutors ● Assign tutors to students ● Modify pricing where necessary ● Correct subjects and year levels
Routine tutor pricing and personal-profile content should remain tutor-controlled.
Admin pricing changes should require:
● A reason ● An audit record ● Tutor notification where material
Admin may assign a tutor to a student.
The tutor should normally accept the assignment unless an emergency or correction requires an override. 35. Admin Recommendation Controls
Admin should be able to place tutors into recommendation states such as:
● Normal visibility ● Reduced visibility ● Recommendations paused ● Unlisted ● Existing students only ● Fully suspended
Recommendation changes should not require full account suspension.
The tutor should normally receive:
● The new status ● The reason ● Any required action ● Review or appeal information

<!-- page 19 -->

36. Audit History
    Studdy should preserve audit history for significant actions.
    Audit records should include:
    ● User or admin identity ● Role used ● Action ● Date and time ● Original value ● New value ● Reason where applicable ● Impersonation status ● Related booking, student, tutor or payment
    Tutors should be able to view admin changes affecting their accounts.
    Users should be able to view relevant access and amendment history for sensitive records.
37. Permission Design Principles
    One identity, several roles
    Users should avoid creating separate accounts for each role.
    Role separation
    Each role workspace should show only relevant functions and data.
    Parent financial control
    Dependent students should never control family payments.
    Student participation
    Students should be able to contribute homework, dates and goals without controlling sensitive records.
    Tutor authorship
    Tutor-created learning records should remain attributable and protected from silent overwriting.
    Overall learning continuity
    A student’s learning history should remain connected across tutors and time.
    Admin capability with accountability
    Admin should have broad correction and support powers, supported by audit logs and visible amendments.
    Minimum necessary access

<!-- page 20 -->

Users should see the information needed for their role and relationship.
Configurable permissions
Student, supporter and tutor-sharing permissions should be configurable where appropriate.
Historical preservation
Archiving, merging, transferring and removing relationships should preserve relevant history.
