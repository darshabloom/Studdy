# MVP Scope and Delivery Plan

> **Source document 04 of the Studdy planning pack.**
> Extracted verbatim from `04MVP Scope and Delivery Plan.pdf` on 7 August 2026.
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

Studdy MVP Scope and Delivery Plan
Version: Draft 0.1
Product:

Studdy

Status:

Ready

for

review

1. Purpose
   This document defines the scope, sequencing and launch requirements for rebuilding
   DarshaTutor

as

Studdy.

It establishes:
● What the first public Studdy release must support ● What should be architecturally supported but enabled later ● How the current DarshaTutor system should be replaced ● The main launch journey ● Tutor onboarding and publication controls ● Tutor discovery ● Booking and payment rules ● First-lesson workflows ● Recurring tutoring ● Overdue-payment restrictions ● Backup availability ● Data migration ● Delivery phases ● Launch criteria
The intention is not to build a temporary or disposable first version.
Studdy should be built on the intended multi-tutor product foundation from the beginning,
even

where

some

advanced

modules

are

enabled

after

launch.

Part One: Product Delivery Approach 2. Full rebuild
Studdy should replace the existing DarshaTutor system.
The current platform should be treated as:
● A source of existing requirements ● A reference for working tutor workflows ● A source of reusable code ● A source of existing student and booking data ● A migration source ● A practical test environment

<!-- page 2 -->

The new product should not be forced to preserve weak technical or product decisions simply because they exist in the current implementation.
Every existing feature should receive one of four decisions:
● Reuse ● Adapt ● Rebuild ● Retire 3. No permanent parallel system
Studdy and DarshaTutor may operate in parallel during testing and migration, but they should not remain separate long-term products.
The delivery plan should include:
● Codebase audit ● Data audit ● Migration mapping ● Trial migration ● User acceptance testing ● Cutover ● Rollback procedure ● Final retirement of the old system 4. Build the real foundation once
Studdy should distinguish between:
Architecturally supported
The data model, permissions and system boundaries already allow the capability.
Available at public launch
The capability is complete enough for real users.
Enabled after launch
The architecture exists, but the interface or operational process is introduced later.
This approach should avoid unnecessary rebuilding while preventing launch scope from becoming unmanageable.

Part Two: Launch Positioning 5. Public multi-tutor platform
Studdy should launch as a public multi-tutor platform.

<!-- page 3 -->

It should support both:
● Families discovering tutors through Studdy ● Tutors inviting their existing families
The public website should present:
● Find a Tutor ● Tutor profiles ● Matching ● Student progress ● Tutor operating tools ● Trust and verification ● Pricing transparency ● Join as a Tutor
Public tutor discovery is therefore a launch requirement, not a later redesign. This follows the approved public website direction. 6. Primary launch journey
The central launch journey should be:

1. Visitor begins Find a Tutor. 2. Visitor completes a matching questionnaire. 3. Studdy presents several suitable tutors. 4. Visitor reviews results. 5. Visitor creates an account when ready to request or book. 6. Student profile is created or selected. 7. Parent sends one or more controlled tutor requests. 8. Tutor accepts or declines. 9. Parent chooses an accepted tutor. 10. Parent pays or confirms an approved direct-payment arrangement. 11. Booking becomes confirmed. 12. Lesson occurs. 13. Tutor records outcomes. 14. Tutor approves the lesson summary. 15. Homework and progress are updated. 16. Parent and tutor decide whether to continue. 17. Tutor is paid and Studdy receives the applicable fee.

Part Three: Launch Scope 7. Required launch modules
The following modules are required for public launch.
Public website
● Homepage

<!-- page 4 -->

● Find a Tutor entry ● Tutor joining pages ● Trust and safety pages ● Pricing explanation ● Help content ● Sign-in and account creation
Tutor discovery
● Matching questionnaire ● Matching summary ● Tutor recommendations ● Public tutor profiles ● Filters ● Comparison ● Favourites ● Direct booking or request actions
Identity and accounts
● Unified User identity ● Parent workspace ● Tutor workspace ● Dependent-student profile ● Independent-student account ● Role switching ● Authentication ● Session management ● Permissions
Tutor onboarding
● Tutor application ● Verification workflow ● Interview records ● Approval ● Conditional approval ● Guided tutor setup ● Profile publication ● Service publication
Student and family records
● Family account ● Student profiles ● Subject sections ● Tutor relationships ● Parent permissions ● Student permissions ● Important dates ● Learning history
Tutor profiles and services

<!-- page 5 -->

● Tutor profile ● Subjects ● Year levels ● Teaching approach ● Pricing ● Services ● Trial settings ● Online and in-person formats ● Availability ● Capacity ● Travel settings ● Public visibility
Booking
● Tutor requests ● Multi-tutor request grouping ● Tutor acceptance ● Parent selection ● Payment confirmation ● Instant booking ● Recurring booking ● Rescheduling ● Cancellation ● Calendar protection ● Waiting and backup lists
Payments
● Stripe ● Tutor payout ● Studdy fee deduction ● Direct bank transfer ● Cash ● Parent payment status ● Tutor payment confirmation ● Commission calculation ● Commission collection ● Refunds ● Credits ● Payment disputes ● Overdue-payment controls
Lesson delivery records
● Scheduled lessons ● Attendance ● Completion ● Lesson notes ● AI draft summary ● Tutor approval ● Homework ● Progress updates ● Goals

<!-- page 6 -->

● Concerns ● Lesson history
Messaging and notifications
● Parent–tutor communication ● Booking-related messages ● Lesson comments ● Support messages ● Email notifications ● In-platform notifications ● Payment reminders ● Booking reminders
Administration
● Tutor review ● Service review ● User management ● Booking correction ● Payment support ● Cases ● Restrictions ● Audit ● Impersonation ● Rules and settings 8. Architecturally supported but not necessarily fully enabled at launch
The architecture should support:
● Organisations ● Group lessons ● Fixed cohorts ● Drop-in sessions ● Resource marketplace ● Assessment marketplace ● Contributor royalties ● International regions ● Advanced reporting ● Mobile applications ● Embedded lesson room ● In-platform video ● Advanced AI recommendations ● Multiple guardians ● Advanced supporter workflows
These capabilities may be introduced after launch without redesigning the core identity, relationship, permission, service, booking or financial models.

<!-- page 7 -->

Part Four: Tutor Discovery 9. Matching before registration
Visitors should be able to complete the tutor-matching questionnaire before creating an account.
The questionnaire should support:
● Student year level ● Several subjects ● Learning needs ● Goals ● Budget ● General availability ● Online or in-person preference ● Tutor experience preference ● Teaching style ● Language or cultural preference ● Exclusions ● Ranked priorities
The visitor should receive:
● Matching summary ● Several tutor recommendations ● Reasons for each match ● Public tutor information ● General pricing ● General availability ● Verification indicators
Account creation should be required only for personal or consequential actions such as:
● Viewing exact availability ● Requesting a lesson ● Booking a trial ● Saving private notes ● Viewing private location details ● Beginning a tutor relationship
Questionnaire answers should carry into account creation. This is consistent with the approved public journey. 10. Direct request from recommendation results
Parents and independent students may request a lesson directly from tutor recommendation cards.
They should not be forced to open the full tutor profile first.
Recommendation cards should support:
● View profile

<!-- page 8 -->

● Request lesson ● Request trial ● Save tutor ● Compare
Before submission, Studdy must show the important booking terms:
● Tutor ● Service ● Subject ● Year level ● Price ● Duration ● Format ● Cancellation terms ● Payment method ● Trial terms ● Whether tutor acceptance is required

Part Five: Tutor Application and Approval 11. Tutor application
Tutor applicants should complete:
● Personal identity information ● Subjects ● Year levels ● Experience ● Qualifications where claimed ● References ● Trial lesson or equivalent review ● Interview ● Required declarations ● Legal agreements ● Safeguarding requirements 12. Approval outcomes
Tutor review should support:
● Approved ● Conditionally approved ● Changes requested ● Rejected 13. Conditional approval

<!-- page 9 -->

Conditional approval may be used where the tutor is suitable but has outstanding non-critical requirements.
Examples include:
● Profile improvements ● Service corrections ● Additional platform training ● Final availability setup ● Payment setup ● Missing non-critical supporting information
Conditional approval must not defer:
● Identity verification ● Required safeguarding checks ● Serious reference concerns ● Minimum legal requirements ● Unresolved conduct concerns ● Materially misleading qualification claims
A conditionally approved tutor should not become publicly bookable until required launch conditions are complete. 14. Guided tutor setup
Approved tutors should complete a guided setup checklist before taking bookings.
The checklist should cover:

1. Public profile 2. Subjects and year levels 3. Teaching approach 4. Services 5. Prices 6. Trial settings 7. Availability 8. Capacity 9. Travel rules 10. Payment and payout setup 11. Commission payment method 12. Cancellation and rescheduling policies 13. Recording and privacy settings 14. Tutor profile preview 15. Booking-flow preview 16. Final launch review
   Studdy should display:
   ● Percentage complete ● Mandatory tasks ● Optional improvements ● Blocked items ● Next required action ● Reviewer status

<!-- page 10 -->

15. Service review at launch
    All new tutor services should initially require Studdy review before public publication.
    Review should cover:
    ● Subject ● Year level ● Description ● Duration ● Price ● Format ● Location ● Travel ● Booking notice ● Cancellation ● Payment methods ● Trial terms ● Package terms ● Qualification claims ● Recording settings ● Student eligibility
    Review outcomes should include:
    ● Approve ● Approve with conditions ● Request changes ● Reject
16. Trusted publishing
    The system should later allow delegated or automatic publication for eligible tutors.
    Eligibility may consider:
    ● Time active ● Completed lessons ● Low complaint rate ● Reliable booking behaviour ● Accurate service information ● Completed training ● No active restrictions ● Successful previous reviews
    Trusted publishing may be limited by:
    ● Subject ● Year level ● Service type ● Organisation ● Country or region
    Material service changes may still require renewed review.

<!-- page 11 -->

17. Service quantity
    Tutors should not have a universal hard service limit.
    Studdy should instead use:
    ● Service templates ● Duplication warnings ● Overlap detection ● Consolidation suggestions ● Admin review ● Public-display controls
    Tutors should be encouraged to maintain a clear, understandable service catalogue.

Part Six: Tutor Requests 18. Intended Lesson Request
Studdy should distinguish between a tutor request and the underlying Intended Lesson Request.
The Intended Lesson Request should include:
● Student ● Subject ● Service need ● Preferred date and time ● Format ● Duration ● Trial status ● Budget ● Parent preferences
Several Tutor Requests may be linked to one Intended Lesson Request. 19. Several tutor requests
Parents may request several tutors for the same intended lesson through a controlled multi-tutor flow.
Studdy should limit the number of tutors requested at once.
A recommended initial maximum is three, configurable by admin.
Different subjects, services or lesson times should be treated as separate intended lesson needs. 20. Payment method before multi-tutor request

<!-- page 12 -->

A valid payment method should normally be required before a new family sends one intended lesson request to several tutors.
No charge should occur at this point.
The interface should explain:
Your card will not be charged when these requests are sent. Payment occurs only when you choose a tutor and confirm the booking.
Exceptions may include:
● Free trials with no possible charge ● Organisation-funded lessons ● Approved direct-payment relationships ● Admin-approved cases 21. Tutor response
Tutors may:
● Accept ● Decline ● Propose another time ● Ask an allowed booking-related question
Every request should have an automatic response deadline.
The deadline may depend on:
● Time until lesson ● Tutor minimum notice ● Single or multi-tutor request ● Trial or standard lesson ● Online or in-person format ● New or existing student
Expired requests should release calendar holds automatically. 22. Parent chooses the tutor
The first tutor to accept does not automatically win.
The parent chooses among accepted tutors.
As soon as one tutor accepts, the parent may:
● Choose that tutor immediately ● Wait for other tutors ● Withdraw other requests ● Continue until the response deadline
The parent should not be forced to wait for all tutors.
When the parent selects one tutor:

<!-- page 13 -->

● They proceed to payment or confirmation. ● Remaining linked requests close. ● Other tutor holds are released. ● Other tutors are notified.

Part Seven: First Booking Payment 23. No payment before tutor acceptance
For a first booking, the parent should normally send the request without making payment.
After the tutor accepts:
● Booking status becomes Awaiting parent payment. ● The slot receives a temporary hold. ● The parent receives a Pay and confirm booking action. ● The parent selects the tutor where several tutors accepted. ● Payment confirms the booking.
This avoids several authorisations for competing tutor requests. 24. Calculated payment deadline
The parent payment window should depend on how soon the lesson begins.
Suggested defaults:
● More than 72 hours away: 24-hour payment window ● 24–72 hours away: 8-hour payment window ● 6–24 hours away: 2-hour payment window ● Less than 6 hours away: immediate payment
Rules should remain admin configurable.
Studdy should show:
● Amount ● Deadline ● Time remaining ● Consequence of non-payment 25. Temporary hold
While awaiting payment:
● The tutor’s slot is temporarily protected. ● No other family may confirm the same time. ● Backup interest may be collected. ● The hold has a visible expiry. ● The tutor may withdraw acceptance before payment.

<!-- page 14 -->

● The parent may withdraw freely before payment.
Once payment succeeds, normal cancellation rules begin. 26. Tutor withdrawal before payment
A tutor may withdraw acceptance before the parent pays.
The tutor must:
● Select a reason ● Confirm withdrawal ● Understand that repeated withdrawals may affect reliability
When withdrawn:
● Parent is notified. ● Payment action closes. ● Calendar hold releases. ● Other tutor requests remain available.
After payment, the tutor must use the normal cancellation process. 27. Parent withdrawal before payment
The parent may withdraw freely before the booking is confirmed.
Repeated late or unpaid withdrawals may be tracked.
Studdy may later respond by:
● Warning the family ● Limiting multi-tutor requests ● Requiring prepayment ● Allowing only one active request ● Requiring admin review

Part Eight: First Lesson and Ongoing Relationship 28. First lesson as a fit check
The first lesson should normally be a standard paid lesson that also serves as a mutual fit check.
It should not imply:
● A discount ● A guaranteed ongoing place ● A permanent tutoring commitment

<!-- page 15 -->

Both sides may decide whether to continue afterward. 29. Tutor–Student Relationship stages
The Tutor–Student Relationship should support:
Prospective
Request exists. Tutor sees limited decision-making information.
Pending confirmation
Tutor accepted, but parent has not paid or confirmed.
Active
Parent has confirmed the first booking.
Paused
Relationship remains but ordinary activity is temporarily stopped.
Ended
No future tutoring is planned.
Historical
Limited past-record access remains.
This uses the permanent relationship approach already established in the approved data model. 30. Recurring suggestion before first lesson
A tutor may suggest a possible recurring time when accepting the first booking.
Example:
I may also be able to offer this time weekly if the first lesson goes well.
This is not a recurring booking commitment.
A recurring arrangement should normally be confirmed after the first lesson unless both parties deliberately choose earlier. 31. Prompt after first lesson
After the tutor publishes the first approved lesson summary, Studdy should ask both parties whether they want to continue.
Parent options may include:
● Book another one-off lesson

<!-- page 16 -->

● Request weekly lessons ● Request another frequency ● Buy a package ● Continue later ● End the relationship
Tutor options may include:
● Happy to continue ● Offer recurring time ● Continue one-off only ● Suggest a different service ● Cannot offer ongoing capacity ● Recommend another tutor 32. Recurring arrangement
Where both agree, Studdy should configure:
● Frequency ● Day and time ● Start date ● Service ● Price ● Payment method ● Location ● Cancellation rules ● Rolling booking window

Part Nine: Instant Booking 33. Instant booking at launch
Studdy should support instant booking at launch.
Instant booking should be configured per service.
It may differ by:
● New or existing student ● Subject ● Year level ● Format ● Availability segment ● Notice period ● Location ● Payment method 34. Eligibility for instant booking

<!-- page 17 -->

New tutors should not automatically receive instant-booking capability.
Eligibility should be unlocked after demonstrated reliability.
A possible initial threshold is:
● Five successfully completed lessons ● Accurate availability ● Acceptable cancellation record ● Completed onboarding ● Valid payment setup ● No unresolved serious concerns ● No active restrictions
The exact threshold should remain configurable.
Eligibility does not automatically enable instant booking. The tutor must choose to activate it.
Admin may grant earlier access to a known and trusted tutor.

Part Ten: Payment Models 35. Stripe
Stripe should be available to tutors who want automated payments.
For marketplace-discovered relationships, Stripe should normally be the default.
Stripe should support:
● Parent payment ● Payment authorisation ● Tutor payout ● Studdy fee deduction ● Refunds ● Credits ● Failed payments ● Disputes ● Chargebacks ● Payout status 36. Tutor-brought families
Tutor-brought families may use:
● Stripe ● Bank transfer ● Cash
The tutor controls which approved methods are available.

<!-- page 18 -->

37. Direct-payment flow
    For direct payment:
1. Lesson occurs. 2. Payment becomes due. 3. Parent receives instructions. 4. Parent may mark payment as sent. 5. Tutor confirms receipt. 6. Studdy updates the payment ledger. 7. Commission becomes chargeable. 8. Studdy collects commission weekly or fortnightly.
   Studdy must not represent a parent’s payment declaration as bank verification.
1. Payment method after relationship establishment
   After the first confirmed lesson, future bookings may support:
   ● Payment when booking ● Saved card ● Automatic recurring payment ● Package balance ● Approved postpaid bank transfer ● Approved cash payment
   Tutors may require stricter prepayment rules.

Part Eleven: Overdue Payments 39. General rule
Families should not continue receiving ordinary lessons indefinitely while earlier undisputed amounts remain overdue. 40. Overdue-payment sequence
Recommended sequence:

1. Payment due 2. Reminder 3. Overdue 4. Block new booking requests 5. Future unpaid bookings move to Payment hold 6. Final deadline to keep the next lesson 7. Release or cancel next lesson 8. Restrict future payment methods 9. Admin review where repeated

<!-- page 19 -->

41. Recurring booking Payment hold
    Where an earlier lesson becomes overdue:
    ● The next recurring booking remains visible. ● It moves to Payment hold. ● Tutor’s slot remains protected until the final deadline. ● Parent sees the amount and deadline. ● Payment restores Confirmed status automatically. ● Failure to pay releases the slot.
    The booking should not disappear without warning.
42. Payment-hold slot protection
    The tutor’s recurring slot remains reserved until the final payment deadline.
    Backup families may register interest but cannot take the slot yet.
    If the deadline passes:
    ● Slot is released. ● Backup invitation sequence begins. ● Tutor and family are notified.
43. Trusted-family exception
    Eligible tutors may permit a trusted family to continue temporarily despite an overdue amount.
    The exception should define:
    ● Maximum overdue amount ● Maximum additional lessons ● New deadline ● Reason ● Expiry ● Tutor acknowledgement of risk
    The parent must explicitly accept the revised deadline before the next lesson proceeds.
    Studdy should show the tutor:
    ● Current unpaid balance ● Additional exposure ● Commission consequences ● Automatic restriction point
44. Tutor eligibility for trusted-family exceptions
    The capability should be available only to eligible tutors.
    Eligibility may require:

<!-- page 20 -->

● Completed onboarding ● Reliable reconciliation history ● No unpaid Studdy commission ● Minimum completed lessons ● No active financial restriction
Admin may grant or remove the capability. 45. Repeated unpaid requests
After repeated tutor acceptances expire unpaid, Studdy may:
● Disable multi-tutor requests ● Require prepayment ● Allow one request at a time ● Require overdue balances to be settled ● Require admin review

Part Twelve: Payment Disputes 46. Disputes do not equal non-payment
A formally disputed lesson should be treated differently from an undisputed overdue bill.
While under review:
● Disputed amount is held. ● Related commission is paused. ● Existing recurring lessons may continue. ● Future bookings remain active by default. ● Tutor may decline additional one-off work. ● Both parties see required actions.
Admin may impose a narrower restriction where abuse or serious risk is suspected. 47. Dispute outcomes
Dispute outcomes may include:
● Family decision upheld ● Tutor decision upheld ● Partial adjustment ● Credit ● Refund ● Payment still due ● Booking correction
If the tutor’s position is upheld and payment remains unpaid, the normal overdue-payment sequence begins from the resolution date.

<!-- page 21 -->

48. Repeated disputes
    Repeated or suspicious disputes may result in:
    ● Stripe-only payments ● Prepayment ● No bank transfer ● No cash ● No postpaid lessons ● One active booking at a time ● Additional verification ● Admin review
    Restrictions should be based on patterns and outcomes, not merely on a family making a legitimate complaint.

Part Thirteen: Backup Availability 49. Backup interest
Families may register backup interest in:
● A temporarily held exact slot ● A tutor’s general availability ● A recurring time ● A waiting-list position 50. Exact released slot
When an exact held slot becomes available, eligible backup families should be contacted sequentially.
Process:

1. Recheck eligibility. 2. Notify first eligible family. 3. Give a short exclusive response window. 4. If declined or expired, notify the next family. 5. Continue until booked or list exhausted.
   Eligibility should include:
   ● Subject ● Year level ● Service ● Format ● Location ● Payment eligibility ● Tutor rules ● Family availability

<!-- page 22 -->

51. General availability
    For general newly opened availability, Studdy may notify several suitable families simultaneously.
    The first completed valid booking may secure the time.
    The interface must distinguish clearly between:
    ● Exclusive exact-slot invitation ● General availability alert

Part Fourteen: Notifications 52. Booking notifications
Studdy should notify users about:
● New tutor request ● Tutor acceptance ● Tutor decline ● Payment required ● Payment reminder ● Hold expiry ● Tutor withdrawal ● Booking confirmation ● Booking cancellation ● Recurring proposal ● Released slot ● Backup invitation 53. Payment reminders
For ordinary first-booking payment windows:
● Immediate acceptance notification ● One reminder during the window ● Final reminder shortly before expiry where useful
Very short windows may use one reminder. 54. Notification restraint
Studdy should avoid excessive messaging.
The notification system should consolidate related events and respect:
● Urgency ● Deadline ● Channel

<!-- page 23 -->

● User preferences ● Mandatory status ● Quiet hours

Part Fifteen: Data Migration 55. Migration sources
Migration should assess existing:
● Users ● Students ● Families ● Tutors ● Bookings ● Lessons ● Homework ● Progress records ● Payments ● Availability ● Services ● Calendar events ● Files ● Notes 56. Migration mapping
Every existing record should map to:
● New entity ● Archived entity ● Historical note ● Unsupported legacy record ● Manual review queue 57. Identity matching
Migration must avoid duplicate users and students.
Matching may use:
● Email ● Phone ● Existing internal ID ● Parent–student relationship ● Tutor relationship ● Manual review 58. Historical preservation

<!-- page 24 -->

Historical records should preserve:
● Original date ● Original creator ● Original source ● Migration date ● Migration version ● Any missing fields ● Any transformed values 59. Migration rehearsal
Before cutover:

1. Export current data. 2. Run a test migration. 3. Check counts. 4. Validate representative users. 5. Validate financial totals. 6. Validate student timelines. 7. Validate tutor relationships. 8. Correct mapping issues. 9. Repeat migration. 10. Obtain final approval.

Part Sixteen: Delivery Phases 60. Phase One: Technical foundation
Deliver:
● Repository structure ● Environments ● Authentication ● User identity ● Roles ● Workspaces ● Permission engine ● Audit ● Core design system ● Shared entities ● Notification foundation ● File storage ● Error monitoring 61. Phase Two: Family and student foundation
Deliver:

<!-- page 25 -->

● Family Account ● Parent workspace ● Student Profile ● Student Subject Sections ● Dependent-student permissions ● Independent-student structure ● Tutor–Student Relationship ● Timeline foundation 62. Phase Three: Tutor onboarding
Deliver:
● Tutor application ● Verification ● Interviews ● Approval workflow ● Conditional approval ● Guided setup ● Tutor profile ● Services ● Availability ● Service review 63. Phase Four: Public discovery
Deliver:
● Public website ● Matching questionnaire ● Matching summary ● Tutor shortlist ● Public profiles ● Search and filters ● Account conversion ● Tutor invitation links 64. Phase Five: Booking
Deliver:
● Intended Lesson Request ● Tutor Requests ● Multi-tutor requests ● Acceptance ● Parent selection ● Temporary holds ● Response deadlines ● Instant booking eligibility ● Recurring series ● Calendar protection ● Backup interest

<!-- page 26 -->

65. Phase Six: Payments
    Deliver:
    ● Stripe onboarding ● Parent payments ● Tutor payouts ● Studdy fee ● Direct-payment ledger ● Cash and bank-transfer status ● Commission collection ● Refunds ● Credits ● Overdue restrictions ● Disputes
66. Phase Seven: Lessons and progress
    Deliver:
    ● Lesson records ● Attendance ● Completion ● Tutor notes ● AI draft summaries ● Tutor approval ● Homework ● Goals ● Progress ● Concerns ● Parent comments ● First-lesson continuation prompt
67. Phase Eight: Administration and launch readiness
    Deliver:
    ● Manager workspace ● Cases ● Payment support ● Restrictions ● Impersonation ● Audit review ● Platform rules ● Launch reports ● Content management ● Support workflows ● Migration tools
68. Phase Nine: Migration and public launch
    Complete:

<!-- page 27 -->

● Test migration ● User acceptance testing ● Tutor onboarding pilot ● Payment tests ● Booking tests ● Security review ● Privacy review ● Production migration ● Public launch ● Early support monitoring

Part Seventeen: Launch Acceptance Criteria 69. Parent journey
A parent must be able to:
● Find tutors publicly ● Complete matching without registration ● Create an account ● Create a student profile ● Request several tutors ● Choose an accepted tutor ● Pay ● Receive confirmation ● Attend lesson ● Receive approved summary ● View homework and progress ● Continue with recurring or one-off lessons 70. Tutor journey
A tutor must be able to:
● Apply ● Complete review ● Receive approval or conditions ● Complete setup ● Publish approved services ● Set availability ● Receive requests ● Accept or decline ● Receive confirmed bookings ● Deliver lessons ● Publish summaries ● Assign homework ● Update progress ● Receive payments

<!-- page 28 -->

● View fees and earnings 71. Payment journey
The system must correctly handle:
● Stripe payment ● Tutor payout ● Studdy fee ● Direct-payment status ● Tutor confirmation ● Commission collection ● Refund ● Credit ● Failed payment ● Overdue restriction ● Payment dispute 72. Security and access
The system must enforce:
● Role separation ● Relationship scope ● Parent permissions ● Tutor subject limits ● Manager scopes ● Sensitive-data restrictions ● Audit ● Strong authentication for sensitive actions ● Server-side permissions 73. Operational readiness
Before launch:
● Support cases work. ● Admin can correct bookings. ● Admin can correct payments. ● Tutor suspension works. ● Payment restrictions work. ● Notifications work. ● Failed jobs are visible. ● Audit records are accessible. ● Migration has been validated. ● Legal and privacy pages are complete. ● Real tutor profiles are approved.

Part Eighteen: Post-Launch Priorities

<!-- page 29 -->

74. Immediate post-launch priorities
    After the core launch stabilises, likely priorities include:
    ● Improved tutor recommendations ● Group lessons ● Organisations ● Resource marketplace ● Assessments ● Advanced reports ● Multiple guardians ● More student-login methods ● Mobile optimisation ● Progressive web application ● Embedded lesson room ● Advanced automation
75. Scope-control principle
    A capability should be included before launch where it is essential to:
    ● Public tutor discovery ● Tutor trust ● Booking ● Payment ● Lesson delivery ● Student continuity ● Parent clarity ● Tutor operations ● Legal or safeguarding requirements ● Platform administration
    A capability should be enabled later where it adds scale or breadth but is not required for a complete first tutoring relationship.

Part Nineteen: Approved MVP Decisions
Studdy will:
● Fully replace DarshaTutor. ● Launch as a public multi-tutor platform. ● Support public discovery and tutor invitation links. ● Allow matching before registration. ● Allow direct requests from recommendation cards. ● Require guided tutor setup. ● Review services centrally at launch. ● Support trusted publishing later. ● Avoid a hard service limit. ● Allow several controlled tutor requests for one intended lesson. ● Require a payment method for multi-tutor requests.

<!-- page 30 -->

● Let the parent choose among accepted tutors. ● Allow the parent to select the first acceptable tutor immediately. ● Take payment after tutor acceptance for first bookings. ● Use temporary calendar holds. ● Use calculated payment deadlines. ● Allow tutor and parent withdrawal before payment. ● Treat the first lesson as a paid fit check. ● Prompt for recurring tutoring after the first approved summary. ● Support instant booking at launch for eligible tutors. ● Unlock instant booking after demonstrated reliability. ● Support Stripe, bank transfer and cash according to relationship rules. ● Block future activity for undisputed overdue payments. ● Protect recurring slots until the final payment deadline. ● Allow controlled trusted-family payment exceptions. ● Require parent acceptance of revised payment deadlines. ● Allow lessons to continue during genuine disputes. ● Restrict repeated disputers to Stripe or prepayment. ● Notify backup families sequentially for exact released slots. ● Support simultaneous alerts for general availability. ● Migrate existing DarshaTutor data into the new system. ● Build future modules on the same permanent architecture.
