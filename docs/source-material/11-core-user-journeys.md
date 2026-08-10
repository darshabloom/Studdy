# Core User Journeys

> **Source document 11 of the Studdy planning pack.**
> Extracted verbatim from `11Core User Journeys.pdf` on 7 August 2026.
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

Studdy Core User Journeys
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
   This document defines Studdy’s core user journeys across parent discovery, tutor selection,
   booking,

payments,

lessons,

progress,

follow-up

activities

and

platform

administration.

It should guide:
● Product design ● Page and dashboard structure ● User-flow mapping ● Functional requirements ● Notification design ● Payment implementation ● Tutor operating workflows ● Parent and student experiences ● Admin tools ● Future mobile-app development
The journeys should minimise manual administration while preserving appropriate human
review

for

tutoring

quality,

safeguarding,

disputes

and

exceptional

circumstances.

Part One: Parent Discovery and Tutor
Matching

2. Public Entry Journey
   The principal public journey should serve parents and independent students looking for
   tutoring.

The primary call to action is:
Find a Tutor
The secondary call to action is:
Join as a Tutor
Visitors should be able to begin tutor matching without creating an account.
Studdy should provide useful value before requesting registration.

<!-- page 2 -->

3. Tutor-Matching Questionnaire
   The visitor begins with a short matching questionnaire.
   The questionnaire may collect:
   ● Student year level ● Subject or subjects ● Learning needs ● Goals ● Preferred lesson format ● General availability ● Budget ● Tutor experience preferences ● Teaching-style preferences ● Language or cultural preferences ● Relevant exclusions ● Ranked matching priorities
   Visitors may select multiple subjects.
   The student’s name and full account details should be requested only after the initial useful matching questions.
4. Matching Results
   After completing the questionnaire, the visitor should first see a concise matching summary explaining what Studdy understood.
   The visitor then sees a ranked shortlist of several tutors.
   The shortlist should include:
   ● Tutor name ● Profile photo ● Subjects and year levels ● Starting price ● General availability indication ● Rating ● Verification indicators ● Short profile summary ● Why the tutor matched ● Trial availability ● Online or in-person formats
   Studdy should not claim that one tutor is objectively the single best option.
   New tutors should receive fair exposure where they meet the relevant criteria.
5. Account-Creation Point
   Visitors can view limited tutor information without registering.
   Account creation should be required before:

<!-- page 3 -->

● Viewing full tutor profiles ● Viewing exact availability ● Saving private favourite notes ● Requesting a lesson ● Booking a trial ● Viewing tutor locations or detailed service information
The visitor’s questionnaire responses should carry into account creation so they do not need to repeat the process. 6. Tutor Profile Decision
When a parent opens a full tutor profile, they may:
● Request a standard lesson ● Request or book a trial lesson ● Save the tutor to favourites ● Compare the tutor with shortlisted alternatives ● Review services, packages and prices ● Review general availability ● Review tutor verification and ratings
The difference between a trial and a standard lesson should be clearly explained.

Part Two: Trial Lessons and Initial Bookings 7. Tutor-Controlled Trials
Tutors control whether they offer trial lessons.
They may configure:
● Trial length ● Trial price ● Whether the trial is free ● Eligible subjects ● Eligible services ● Online or in-person availability ● Whether tutor acceptance is required ● Whether each family may book more than one trial
Trial terms should be visible before the parent submits the request. 8. Paid Lesson Requests
For Stripe-paid bookings, the parent commits to payment when submitting the request.
The preferred process is:

<!-- page 4 -->

1. Parent selects the student, service and time. 2. Parent confirms the price and applicable policies. 3. Parent provides or confirms a payment method. 4. Stripe authorises the payment amount. 5. The selected time becomes temporarily reserved. 6. The tutor receives the request. 7. The tutor accepts or declines. 8. If accepted, the booking becomes confirmed and payment proceeds. 9. If declined, withdrawn or expired, the payment authorisation is released. 10. Studdy suggests alternative tutors after the original request ends.
   The interface should clearly state:
   You will only be charged if the tutor accepts your request.
   Where payment authorisation is not technically available, Studdy may charge and automatically refund declined or expired requests, but authorisation is preferred.
2. Free Trial Requests
   A free trial should not require an immediate lesson charge.
   Studdy may still require a payment method where cancellation or no-show charges could apply.
   Any potential charge should be clearly disclosed.
3. Withdrawing a Pending Request
   Parents may withdraw a pending request without a cancellation fee.
   Withdrawing should:
   ● Release the reserved tutor time ● Release the payment authorisation ● Notify the tutor ● Update the booking history
   Once the tutor accepts, the normal cancellation policy applies.
4. One Active Request Per Intended Lesson
   Parents should not send competing requests to multiple tutors for the same intended lesson time.
   Studdy may offer alternative tutors only after the current request is:
   ● Declined ● Withdrawn ● Expired
   This avoids unnecessary calendar blocking and conflicting acceptances.

<!-- page 5 -->

Part Three: Tutor Response and Calendar Protection 12. Minimum Booking Notice
Tutors can set their minimum notice for new bookings.
Minimum notice may differ by:
● Subject ● Service ● Trial or standard lesson ● Online or in-person format ● New or existing student
Studdy may impose platform limits to prevent unreasonable settings. 13. Tutor Response Windows
Tutor response deadlines may vary according to how soon the proposed lesson is.
Tutors may also configure different response windows for different booking types, within platform limits.
A potential model is:
● More than 48 hours before the lesson: up to 24 hours to respond ● Between 24 and 48 hours: shorter response period ● Short-notice request: accelerated response period ● Request inside tutor’s minimum-notice setting: unavailable unless explicitly supported
The exact response rules should remain admin-configurable. 14. Pending Calendar Reservation
A pending request temporarily blocks the selected time in the tutor’s calendar.
The time remains reserved until the request is:
● Accepted ● Declined ● Withdrawn ● Automatically expired
Tutors should not silently release the time while leaving the parent’s request active. 15. Tutor Decline
Tutors may decline a request without providing a parent-visible reason.
A decline reason is optional.

<!-- page 6 -->

Suggested quick reasons include:
● Time no longer available ● Not the right subject match ● Capacity reached ● Travel or location issue ● Service unavailable ● Other
Tutors may provide a private admin-only reason where necessary. 16. Tutor Responsiveness
Repeatedly ignoring or allowing requests to expire may affect recommendation visibility.
The process should include:

1. Reliability tracking 2. Warning to the tutor 3. Opportunity to correct availability 4. Consideration of legitimate exceptions 5. Reduced recommendation visibility where repeated 6. Admin review where appropriate
   One missed request should not create a severe penalty.
2. Parent Withdrawal Patterns
   Parents should not be penalised for ordinary withdrawal of pending requests.
   Studdy may detect repeated behaviour that unnecessarily blocks tutor availability.
   The process may include:
   ● Warning ● Education about calendar impact ● Temporary limits on pending requests ● Admin review
   Legitimate circumstances should be considered.

Part Four: Confirmed and Recurring Lessons 18. Confirmation
When the tutor accepts:
● The booking becomes confirmed.

<!-- page 7 -->

● Payment proceeds where applicable. ● The normal cancellation and rescheduling policy begins. ● The time remains reserved. ● The booking appears on relevant dashboards and calendars. 19. Recurring Booking Requests
Parents can request a recurring arrangement during the first booking.
The request should show:
● Frequency ● Day and time ● Proposed start date ● Number of lessons or ongoing status ● Price per lesson ● Payment arrangement ● Package terms where applicable ● Online or in-person format ● Location
The tutor may:
● Accept the full series ● Propose changes ● Accept only the first lesson ● Decline 20. Reserving Recurring Slots
When a recurring series is accepted, all included future slots should be reserved in the tutor’s calendar.
For an ongoing series, Studdy should reserve an appropriate rolling period rather than creating unlimited bookings indefinitely.
The rolling period should be admin-configurable. 21. Managing One Lesson or the Series
Parents and tutors should be able to choose:
● This lesson only ● This and future lessons
A single lesson may be:
● Rescheduled ● Cancelled ● Moved online ● Moved in person ● Assigned a different approved location ● Adjusted by mutual agreement

<!-- page 8 -->

The series may be:
● Paused ● Resumed ● Ended ● Moved to a new regular time ● Changed in frequency ● Changed in format 22. Pausing a Recurring Series
A paused series preserves:
● Tutor relationship ● Student relationship ● Series settings ● Historical bookings
The regular slot may remain reserved for a limited period.
A suggested default is two weeks, with admin-configurable limits.
After the protected pause period, the tutor may release the slot unless both sides agree otherwise. 23. Ending a Recurring Series
Either the parent or tutor may end an ongoing recurring arrangement.
A reason should be optional.
Already confirmed lessons remain subject to the normal cancellation policy unless both sides agree otherwise.
Studdy should not automatically recommend replacement tutors merely because a series ends.
The parent may choose to begin a new tutor search. 24. Recurring Price Changes
Tutors may propose a new price for future recurring lessons.
The parent must approve the new price before it takes effect.
Existing confirmed lessons retain their previously agreed price unless both parties agree to change them.

Part Five: Tutor Cancellations and Replacements

<!-- page 9 -->

25. Tutor Cancels One Lesson
    When a tutor cancels, they may offer one or more replacement times.
    The parent may:
    ● Accept a replacement time ● Decline and receive Studdy credit ● Decline and request a refund
    Tutor cancellations should not count against the parent.
    Repeated tutor cancellations may affect reliability metrics and recommendation visibility.
26. Tutor Unavailability
    Where a tutor becomes temporarily unavailable:
    ● Existing packages normally remain associated with that tutor. ● The series may be paused. ● Alternative arrangements may be made by mutual agreement.
    Where a tutor becomes permanently unavailable or leaves Studdy:
    ● Future lessons are cancelled or reassigned. ● Families receive automatic notice. ● Unused package value is identified. ● Refund, credit and transfer options are presented. ● Admin can assist with reassignment.
27. Package Transfer Value
    Where package transfer is permitted, the unused monetary value should transfer rather than the same number of lessons.
    This avoids mismatches when tutors charge different rates.
    Transferred value may be used across multiple tutors only where:
    ● The original tutor left Studdy ● The tutor became permanently unavailable ● Studdy disrupted the service ● Admin approved an exception
    Ordinary tutor-specific packages do not automatically become general marketplace credit.

Part Six: Payment Options 28. Pay Per Lesson and Packages

<!-- page 10 -->

Tutors may offer:
● Pay per lesson ● Upfront packages ● Both options
A tutor may make a package optional or required for a particular service.
Package terms should clearly show:
● Number of lessons ● Total price ● Effective price per lesson ● Expiry ● Refund rules ● Transfer rules ● Whether tutor-specific ● Eligible lesson types ● Any discount 29. Tutor-Brought Relationships
For a tutor-brought family, available payment methods may include:
● Stripe ● Bank transfer ● Cash
The tutor remains responsible for paying Studdy commission on chargeable direct-payment bookings.
The family may switch between permitted payment methods during the relationship.
Changes apply prospectively and should be recorded. 30. Marketplace Relationships
Marketplace-sourced relationships should use Stripe by default.
Studdy’s fee should be deducted automatically.
Admin may approve an exception where required. 31. Stripe Payment Journey
For Stripe payments:
● Parent payment is collected through Studdy. ● Stripe fees and Studdy fees are handled automatically. ● The tutor sees estimated take-home earnings. ● Refunds, credits and disputes adjust the payout. ● No separate tutor commission collection is required.

<!-- page 11 -->

Part Seven: Direct Bank Transfer and Cash 32. Direct-Payment Status
Lesson completion and payment confirmation are separate.
After a direct-payment lesson:

1. Lesson completes automatically under the normal completion rules. 2. Payment status becomes Payment due . 3. Parent sees amount, instructions and deadline. 4. Parent may mark I’ve paid . 5. Tutor confirms whether payment was received. 6. Studdy updates the payment ledger. 7. Commission is added to the tutor’s billing cycle.
   The parent saying they paid does not count as bank verification.
2. Standard Direct-Payment Deadline
   The standard payment deadline should be 48 hours after the lesson .
   Admin may approve a different deadline, such as three days, for particular tutors, families or circumstances.
   Suggested progression:
   ● Lesson ends: Payment due ● After 24 hours: Reminder displayed ● After 48 hours: Overdue ● Repeated non-payment: Direct payment may be restricted or Stripe required
3. Tutor Payment Confirmation
   The tutor should select:
   ● Paid in full ● Partially paid ● Not received ● Payment waived ● Payment disputed
   For a confirmed payment, the tutor may record:
   ● Payment method ● Date received ● Amount received ● Optional reference ● Optional note

<!-- page 12 -->

35. Bulk Reconciliation
    Tutors should be able to confirm several direct payments at once.
    A weekly reconciliation screen should show:
    ● Parent ● Student ● Lesson date ● Amount ● Parent-reported status ● Payment reference ● Commission amount ● Current payment status
    Tutors may bulk-mark ordinary full payments.
    Partial payments, disputes, waivers and corrections should be processed individually.
36. Direct-Payment Statuses
    Possible statuses include:
    ● Payment due ● Parent says paid ● Confirmed by tutor ● Partially paid ● Overdue ● Disputed ● Waived ● Refunded ● Admin corrected
37. Commission Calculation Timing
    Commission should be calculated from the booking price when the booking is created.
    It should then move through stages:
38. Estimated — request created 2. Reserved — tutor accepts 3. Chargeable — lesson completed under policy 4. Adjusted — cancellation, refund, dispute or amendment 5. Owed — included in tutor commission statement 6. Paid — collected from tutor
    A declined or withdrawn request should not result in commission owed.
    Tutors cannot avoid commission by failing to confirm that a direct payment was received.

Part Eight: Tutor Commission Collection

<!-- page 13 -->

38. Collection Frequency
    Tutors using direct payments may choose:
    ● Weekly commission collection ● Fortnightly commission collection
    Tutors can change the frequency.
    The new frequency applies from the next billing cycle.
    Stripe-paid bookings are excluded because commission is deducted automatically.
39. Payment Method on File
    Tutors who use direct payments must keep a valid payment method on file.
    Studdy should automatically collect commission according to the selected billing frequency.
40. Failed Collection
    When automatic collection fails:
41. Studdy records the failed attempt. 2. The tutor is notified. 3. The unpaid balance becomes their Next Required Action. 4. The tutor may update the payment method. 5. Studdy retries automatically. 6. The tutor may pay manually before the next retry. 7. After two failed attempts, new direct-payment bookings may be restricted.
    Existing confirmed lessons should not automatically be cancelled after one failed payment.
42. Restriction Sequence
    The recommended enforcement sequence is:
43. Reminder 2. First retry 3. Second retry 4. Restrict new bank-transfer and cash bookings 5. Continue allowing Stripe bookings 6. Admin review 7. Potential restriction of all new bookings 8. Potential suspension where unresolved
    Parents should not be told that a tutor has an overdue Studdy balance.
    Where direct payment is unavailable, parents should simply be offered Stripe.
44. Payment Plans
    Admin can create a payment plan for an overdue tutor balance.

<!-- page 14 -->

The plan may define:
● Instalment amount ● Frequency ● Start date ● End date ● Automatic payment method ● Booking restrictions ● Consequences of missed instalments
Admin may pause or amend enforcement while an agreed plan is being followed. 43. Commission Adjustments
Admin may waive or reduce commission for a booking.
The record should preserve:
● Original commission ● Adjusted commission ● Reason ● Admin user ● Date ● Related booking
Tutors should see commission adjustments in their finance history.

Part Nine: Lesson Completion and Disputes 44. Automatic Completion
Lessons should be marked complete automatically after the scheduled end time unless changed or disputed.
Parents should not receive a separate notification every time a lesson automatically completes.
Completion remains visible in:
● Student timeline ● Parent dashboard ● Tutor records ● Finance history 45. Early Lesson Ending
Tutors should not finalise a lesson before its scheduled end time.

<!-- page 15 -->

They may record that it ended early and provide a reason.
Possible outcomes include:
● Full charge where the student arrived late or chose to end early ● Partial adjustment where the tutor ended early ● Agreed shortened duration ● Technical disruption review ● Dispute process 46. Dispute Window
The dispute window is 48 hours after the scheduled lesson end time .
Either party may report:
● Lesson did not occur ● Incorrect duration ● Significant lateness ● Payment issue ● Attendance issue ● Technical failure ● Incorrect completion status
After 48 hours, the lesson becomes final unless admin reopens it. 47. Commission During Dispute
A disputed lesson should be temporarily excluded from chargeable tutor commission.
After resolution, commission may be:
● Restored in full ● Recalculated ● Waived ● Credited back ● Added to a later statement
The original and corrected records must be preserved.

Part Ten: Online Lesson Follow-Up 48. Recording and Transcription
Online lessons should be recorded and transcribed automatically by default.
Recording may be disabled only where an approved exception applies, including:
● Consent constraints ● Safeguarding requirements ● Technical limitations

<!-- page 16 -->

● Inappropriate lesson type ● Admin-approved exception
The system should clearly show whether recording is active. 49. AI Lesson Summary
Studdy may generate an AI draft containing:
● Lesson overview ● Topics covered ● Observed progress ● Challenges ● Homework suggestions ● Follow-up items
The AI draft must not be shown to the parent or student until the tutor reviews and approves it. 50. Tutor Review
Before publication, the tutor may:
● Correct inaccuracies ● Remove irrelevant details ● Add professional context ● Add homework ● Add goals ● Mark content parent-only ● Exclude sensitive content from the student view 51. Follow-Up Deadline
The approved summary and homework should normally be available within 24 hours .
If delayed:
● The dashboard displays Summary being prepared . ● The parent does not receive a separate late-summary notification. ● The tutor sees an overdue task. ● Repeated lateness may affect reliability indicators. 52. Extended Preparation Time
Tutors may request more time for:
● Complex assessments ● Detailed progress reports ● Safeguarding review ● Accuracy checks ● Lessons requiring substantial analysis
The revised expected completion time should be visible to the parent.

<!-- page 17 -->

Part Eleven: Lesson Discussions 53. Comments
Parents and authorised students may comment under an approved lesson summary.
Comments should remain attached to that lesson.
Tutors can reply in the same thread.
Admin may access the discussion for:
● Support ● Moderation ● Safeguarding ● Dispute resolution 54. Student Visibility
Dependent students should only see and comment on student-visible content.
Parent-only or sensitive sections remain hidden. 55. Editing Published Summaries
Tutors may edit an approved summary after publication.
Material changes should preserve:
● Previous version ● New version ● Author ● Time ● Change indication
Parents and students should see that the summary was updated. 56. Actionable Questions
A parent or student question may be converted into a tutor task.
The task should link back to the original lesson comment.
Users may mark a comment as:
● Open question ● Action required ● Resolved ● Reopened ● Admin locked

<!-- page 18 -->

57. Resolving and Reopening
    Tutors may mark questions resolved.
    Parents may reopen a question where:
    ● The answer was incomplete ● Further clarification is needed ● The issue returns
    Full history should remain available.
58. Thread Duration
    Lesson-summary discussions should remain open indefinitely.
    Older threads may be collapsed or archived from the default view.
    Admin may lock a thread for moderation, safeguarding or abuse.

Part Twelve: Parent Dashboard 59. Family-Level Home Page
The parent dashboard should open with all students together.
Each student card may show:
● Next lesson ● Next Required Action ● Homework due ● Upcoming test or deadline ● Recent progress ● Urgent concern ● Current tutors
Parents can reorder student cards manually.
Automatic ordering options may include:
● Next action ● Next lesson ● Urgency ● Alphabetical 60. Next Required Action
The parent dashboard should prominently display the most urgent required action.
Examples include:

<!-- page 19 -->

● Approve a booking change ● Complete payment ● Review a tutor price change ● Respond to a tutor ● Choose refund or credit ● Confirm recurring schedule ● Resolve an account issue
Where several actions exist, Studdy should rank them rather than present an unstructured list. 61. Combined Student Timeline
Each student should have a combined timeline across all tutors.
The timeline may include:
● Bookings ● Completed lessons ● Lesson summaries ● Homework ● Goals ● Progress updates ● Assessments ● Important dates ● Tutor concerns ● Parent comments ● Resources ● Relevant payments
Each item should remain attributable to its tutor or creator. 62. Timeline Filters
Parents can filter by:
● Subject ● Tutor ● Record type ● Date range ● Open or resolved status ● Upcoming or completed activity
The default remains one clear overall timeline. 63. Parent Reminders
Overdue parent actions may trigger:
● Email reminders ● App notifications later ● Optional SMS later for selected urgent cases
Users can manage ordinary reminder preferences.

<!-- page 20 -->

Critical payment, booking and safeguarding notices may remain mandatory.

Part Thirteen: Tutor Dashboard 64. Tutor Next Required Action
The tutor dashboard should show one prominent Next Required Action.
Possible actions include:
● Respond to booking request ● Approve lesson summary ● Review homework ● Answer parent question ● Complete assessment report ● Resolve payment issue ● Prepare for lesson
Actions should be ranked by urgency, deadline and impact. 65. Consolidated Action Dashboard
Tutors should have one place showing:
● Booking requests ● Overdue summaries ● Homework awaiting review ● Parent and student questions ● Assessment reports ● Correction requests ● Upcoming lesson preparation ● Payment issues ● Commission actions
The default grouping should be by urgency.
Tutors may change the view to:
● Student ● Subject ● Due date ● Task type 66. Tutor Earnings Snapshot
The tutor home page should show estimated take-home earnings.
The primary figure should be the amount the tutor is expected to retain after:
● Studdy fees

<!-- page 21 -->

● Stripe fees where applicable ● Credits ● Refunds ● Adjustments
Gross lesson value should remain visible as a secondary figure.
For direct payments, the dashboard should distinguish between money paid directly to the tutor and commission still owed to Studdy.
The snapshot may show:
● Estimated take-home earnings ● Earnings this week ● Confirmed upcoming earnings ● Pending Stripe payouts ● Direct payments awaiting confirmation ● Studdy commission owed ● Commission credits ● Failed collection issues
Tutors may hide the earnings card from the home dashboard.
The detailed finance area remains available.

Part Fourteen: Student Dashboard 67. Student-Friendly Next Action
Students should have a lighter action experience than parents and tutors.
The dashboard may show:
● Do next ● Coming up ● Keep working on
Examples include:
● Submit homework ● Prepare for a test ● Review feedback ● Join a lesson ● Answer a tutor question ● Bring a workbook 68. Action Creation
A student action may be created by:
● Tutor

<!-- page 22 -->

● Parent ● System ● Student
Each action should show who created it.
Parent-created actions should remain relevant to tutoring and learning. 69. Due Dates
Parent-created student actions may be:
● Due on a date ● Due before the next lesson ● Ongoing ● Open-ended
Due dates are optional.
Open-ended tasks should not become overdue automatically. 70. Student Completion
Students can mark their own actions complete.
The creator may:
● Confirm completion ● Reopen the action ● Comment ● Change due date ● Archive it
The activity history should preserve who completed or reopened the action. 71. Future Student-to-Tutor Tasks
Students directly assigning tasks to tutors should remain a future capability.
For now, a student may:
● Ask a question ● Add a requested topic ● Comment under a lesson ● Add a personal goal
The tutor may convert the request into a task.

Part Fifteen: Admin Journeys

<!-- page 23 -->

72. Admin Intervention
    Admin may assist with:
    ● Tutor matching ● Manual tutor assignment ● Booking creation ● Booking corrections ● Payment exceptions ● Refunds ● Credits ● Package transfers ● Commission adjustments ● Payment plans ● Disputes ● Account restrictions ● Recommendation visibility ● Tutor suspension
    All material interventions should be logged.
73. Manual Tutor Assignment
    Admin can assign a tutor to a student.
    The tutor should normally accept the assignment.
    Admin may override acceptance only for a legitimate correction, emergency or approved operational reason.
74. Creating Bookings on Behalf of Users
    Admin may create a booking on behalf of a parent or tutor.
    The booking should record:
    ● Admin creator ● Reason ● Date ● Represented user ● Any overridden rules ● Payment treatment
    Normal acceptance and payment rules apply unless explicitly overridden.
75. Payment Exceptions
    Admin may:
    ● Permit direct payment for a marketplace relationship ● Require Stripe for a tutor-brought relationship ● Change payment deadlines ● Adjust commission

<!-- page 24 -->

● Waive commission ● Create credits ● Approve refunds ● Transfer package value ● Correct payment status 76. Account Restrictions
Admin may restrict:
● Direct-payment bookings ● All new bookings ● Recommendation visibility ● Public tutor profile ● Tutor account access
Restrictions should be proportionate and preserve existing lessons where appropriate. 77. Suspension for Unpaid Balance
Initially, suspension for a prolonged unpaid tutor balance should require admin review.
A future automated enforcement system may use admin-configured:
● Balance thresholds ● Age of debt ● Number of failed collections ● Missed payment-plan instalments ● Warning stages ● Restriction stages ● Suspension rules
Admin should always be able to pause, override or reverse automated enforcement.

Part Sixteen: Journey Design Principles 78. Useful Before Registration
Visitors should receive meaningful matching value before being asked to create an account. 79. One Clear Next Action
Dashboards should prioritise the next important action rather than overwhelming users. 80. Automation With Human Oversight
Routine processes should be automatic.
Human review should remain available for:

<!-- page 25 -->

● Tutor acceptance ● Lesson-summary approval ● Disputes ● Safeguarding ● Payment exceptions ● Suspensions ● Complex corrections 81. Transparent Statuses
Bookings, payments, summaries and disputes should always have understandable statuses. 82. Separate Lesson and Payment Status
A lesson can be complete while direct payment remains unconfirmed.
The system should not merge these distinct concepts. 83. Preserve Trust
Internal tutor billing problems should not be unnecessarily exposed to parents.
Where possible, the user journey should present an available payment option rather than disclose internal enforcement. 84. Preserve History
Cancellations, corrections, payment adjustments, summary edits and admin actions should remain traceable. 85. Tutor-Controlled Business Settings
Tutors should control:
● Prices ● Trial structure ● Packages ● Availability ● Minimum booking notice ● Response settings ● Direct-payment billing frequency ● Earnings-card visibility
These controls remain subject to reasonable platform limits and admin intervention. 86. Parent Financial Control
Parents retain financial control for dependent students. 87. Student Participation

<!-- page 26 -->

Students should participate meaningfully in homework, goals, questions and learning actions without being burdened by operational or payment administration. 88. Admin Configurability
Operational values should be configurable through the admin interface where practical, including:
● Response windows ● Payment deadlines ● Reminder schedules ● Commission collection rules ● Retry limits ● Restriction thresholds ● Package transfer eligibility ● Dispute handling ● Suspension rules
