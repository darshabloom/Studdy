# Information Architecture and Screen Map

> **Source document 02 of the Studdy planning pack.**
> Extracted verbatim from `02Information Architecture and Screen Map.pdf` on 7 August 2026.
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

Studdy Information Architecture and
Screen

Map

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
   This document defines Studdy’s information architecture, navigation model, workspace
   structure,

page

hierarchy

and

principal

screens.

It should guide:
● UX and interface design ● Fable redesign work ● Route and page planning ● Desktop and mobile navigation ● Role-based screen access ● Dashboard composition ● Design-system requirements ● Front-end development ● Product delivery sequencing
This document describes where capabilities should appear and how users should move
through

Studdy.

Detailed

business

rules

remain

governed

by

the

approved

product

principles,

permissions,

journeys

and

capability

documents.

Part One: Navigation Principles 2. One Account, Multiple Workspaces
A user may hold several roles under one Studdy account.
Possible workspaces include:
● Parent ● Tutor ● Dependent student ● Independent student ● Organisation ● Platform Manager ● Platform Owner
After login, the user should return to their last-used workspace.
A workspace switcher should remain accessible throughout the authenticated product.

<!-- page 2 -->

Users should operate within one workspace context at a time. 3. Two Navigation Layers
Studdy should use two coordinated navigation layers.
Universal navigation
Universal navigation remains broadly consistent across workspaces.
It should include:
● Workspace switcher ● Search ● Create ● Notifications ● Messages ● Help ● Account menu ● Sign out
Workspace navigation
Workspace navigation changes according to the active role.
It should expose only pages relevant to that workspace and the user’s permissions. 4. Desktop Navigation
Desktop should use:
● Persistent left sidebar for workspace navigation ● Compact top bar for universal controls ● Main content area ● Optional contextual right panel where useful
The left sidebar should:
● Use icons and clear text labels ● Highlight the active section ● Support collapse ● Include personal shortcuts ● Show permission-dependent sections ● Preserve the user’s navigation state where practical 5. Mobile Navigation
Mobile navigation should be designed separately for each workspace rather than directly reproducing the desktop sidebar.
A typical mobile structure should use:
● Workspace-aware bottom navigation ● Top bar for notifications, search and account controls

<!-- page 3 -->

● More menu for secondary areas ● Contextual quick actions ● Mobile-specific Home widget layouts
Users may customise their bottom navigation within platform limits.
Essential destinations should not be removable. 6. Workspace-Aware Search
Search should default to the active workspace.
The interface should clearly state the current search scope.
Users with several roles may deliberately expand search to:
● Current workspace ● All accessible workspaces ● A selected workspace
Search results must always respect permissions and role boundaries. 7. Universal Messages
Messages should be a universal area, but content should be filtered by the active workspace.
Examples:
● Parent workspace: family, tutor and support messages ● Tutor workspace: family, organisation and tutor-support messages ● Manager workspace: operational and case-related communications
Switching workspaces should change the visible message context. 8. Universal Create Menu
The universal top bar should include a prominent Create action.
Available options should change according to the active workspace.
The menu should show a concise, relevant selection rather than every possible action.
A future version may show recently used actions. 9. Notifications
The universal Notifications area should group items into:
● Action required ● Updates ● System
Notifications should support filters by:

<!-- page 4 -->

● Workspace ● Student ● Tutor ● Case ● Organisation ● Date ● Status

Part Two: Personalisation 10. Personal Shortcuts
Users should be able to pin frequently used pages and records.
Examples include:
● Student profile ● Tutor calendar ● Earnings overview ● Favourite resource subject ● Organisation programme ● Manager case queue ● Platform Health
Shortcuts should disappear automatically when the user loses access. 11. Configurable Home Widgets
Each workspace Home screen should support widgets that users can:
● Show ● Hide ● Reorder ● Resize where practical ● Pin ● Restore to default
The Platform Owner may define mandatory widgets that users cannot hide. 12. Resetting Widgets
Home customisation should provide:
● Reset widgets ● Confirmation dialogue ● Clear explanation of what will change ● Confirm reset ● Cancel ● Optional immediate undo ● Restoration of the recommended workspace default

<!-- page 5 -->

Resetting should never affect underlying records or data. 13. Multiple Home Layouts
Users may optionally save more than one Home layout.
Examples include:
● Daily work ● Finance focus ● Lesson preparation ● Student overview ● Support queue ● Platform health
This can remain a later or power-user capability. 14. Device-Specific Preferences
Studdy should remember preferences separately for desktop and mobile.
This includes:
● Widget order ● Widget visibility ● Widget sizing ● Mobile bottom navigation ● Saved layouts ● Last-used views ● Sidebar state

Part Three: Public Website 15. Public Navigation
Recommended public navigation:
● Find a Tutor ● How It Works ● Resources ● For Tutors ● For Organisations ● Trust and Safety ● Help ● Log In ● Join Studdy
The primary call to action is:
Find a Tutor

<!-- page 6 -->

The secondary call to action is:
Join as a Tutor 16. Public Website Screen Map
Homepage
Should include:
● Hero section ● Tutor discovery entry ● Tutoring value proposition ● Progress and continuity explanation ● How Studdy works ● Tutor trust indicators ● Pricing explanation ● Tutor examples ● Resource marketplace introduction ● Parent and tutor calls to action
Tutor matching questionnaire
Should support:
● Year level ● Subject selection ● Learning needs ● Goals ● Availability ● Format ● Budget ● Preferences ● Exclusions ● Priority ranking
Matching summary
Should show:
● What Studdy understood ● Selected priorities ● Important constraints ● Option to amend answers
Tutor shortlist
Should show:
● Several ranked matches ● Why each tutor matched ● Pricing ● General availability ● Trial information

<!-- page 7 -->

● Verification indicators ● Favourites ● Comparison options
Public tutor profile
Should contain limited information until sign-in.
Full tutor profile
After sign-in, should show:
● Full biography ● Subjects and services ● Exact or requestable availability ● Prices ● Trial options ● Ratings ● Verification ● Organisation affiliation ● Introductory video ● What a lesson is like ● Booking actions
Tutor joining pages
Should include:
● Benefits ● How approval works ● Fees ● Tutor responsibilities ● Application entry ● FAQs
Organisation pages
Should include:
● Organisation benefits ● Tutor and programme management ● Resource libraries ● Reporting ● Contact or onboarding enquiry
Trust and Safety
Should include:
● Verification approach ● Communication protections ● Recording and data handling ● Incident support ● Parent and student safeguards

<!-- page 8 -->

Part Four: Parent Workspace 17. Parent Sidebar
Recommended parent navigation:

1. Home 2. Students 3. Bookings 4. Progress 5. Tutors 6. Payments 7. Resources 8. Support
   Universal Messages, Notifications, Search and Account controls remain in the top bar.
2. Parent Home
   The Parent Home screen should open with all students together.
   Recommended widgets:
   ● Next Required Action ● Student cards ● Upcoming lessons ● Homework due ● Important dates ● Recent progress ● Payments requiring attention ● Active support case ● Tutor updates
   Student cards
   Each card may show:
   ● Student name ● Next lesson ● Next Required Action ● Homework due ● Important upcoming date ● Recent progress ● Current tutors ● Urgent concern where applicable
   Parents may manually reorder cards.
   Automatic ordering options may include:
   ● Next action

<!-- page 9 -->

● Next lesson ● Urgency ● Alphabetical 19. Parent Students Section
Students list
Should show:
● Active students ● Archived students ● Add student ● Student status ● Current tutors ● Upcoming lesson ● Required action
Student Profile
Each profile should use a sticky student header and a shared tab structure.
Recommended tabs:
● Overview ● Timeline ● Progress ● Homework ● Assessments ● Goals ● Resources ● Tutors ● Concerns, once applicable ● Tutor Workspace, only for authorised tutors
Sticky student header
Should show:
● Student name ● Photo ● Active subject filter ● Tutor filter ● Next lesson ● Next Required Action ● Quick actions ● Urgent status ● Optional compact progress indicator
The compact progress indicator should be configurable by the Platform Owner.
Student Overview
Should combine learning and operational information:

<!-- page 10 -->

● Next lesson ● Next Required Action ● Current tutors ● Recent progress ● Active goals ● Homework due ● Important dates ● Latest lesson summary ● Important concerns ● Assigned resources
Timeline
Should combine activity across tutors and subjects.
Filters should include:
● Subject ● Tutor ● Record type ● Date ● Open or resolved ● Upcoming or completed
Progress
Should show:
● Overall progress ● Subject progress ● Skills ● Curriculum standards ● Tutor-created skills ● Evidence ● Goals ● Recent changes ● Tutor attribution
Homework
Should show:
● Assigned ● Submitted ● Reviewed ● Overdue ● Completed ● Tutor feedback
Assessments
Should show:
● Upcoming ● In progress

<!-- page 11 -->

● Completed ● Reports ● Results ● Recommended next steps
Goals
Should show:
● Active ● Completed ● Student-created ● Tutor-created ● Parent comments ● Linked goals
Resources
Should show:
● Assigned resources ● Purchased resources ● Subject filtering ● Completed or in-progress activity
Tutors
Should show:
● Current tutors ● Subject relationships ● Tutor access ● Tutor history ● Remove or re-invite actions
Concerns
The Concerns tab should appear only once a current or historical concern exists.
After appearing, it should remain available for history. 20. Parent Bookings
Recommended views:
● List ● Calendar ● Requests ● Recurring ● Trials ● Past ● Cancelled
The system should remember the last-used view.

<!-- page 12 -->

Booking details should include:
● Student ● Tutor ● Service ● Subject ● Date and time ● Location or video method ● Payment status ● Lesson status ● Cancellation options ● Recurring-series context 21. Parent Progress
The top-level Progress page should provide a family-level overview.
It should show all students by default.
Filters should include:
● Student ● Subject ● Tutor ● Skill ● Goal ● Date range ● Status
It should surface:
● Recent improvements ● Areas needing attention ● Current goals ● Upcoming assessments ● Significant changes ● Tutor contributions 22. Parent Tutors
Recommended tabs:
● Current ● Favourites ● Shortlist ● Past
Filters may include:
● Student ● Subject ● Format ● Price ● Availability ● Organisation affiliation

<!-- page 13 -->

Unlisted tutors should display an Unlisted label. 23. Parent Payments
Recommended tabs:
● Upcoming ● Completed ● Credits ● Refunds ● Payment Methods
Filters should include:
● Student ● Tutor ● Date ● Payment method ● Status ● Booking ● Package 24. Parent Resources
Resources should use a subject-first structure.
The entry screen should show:
● Subject cards ● Recently used subjects ● Assigned resources requiring action ● Purchased resources ● Search
Within a subject, filters should include:
● Resource type ● Year level ● Curriculum ● Tutor ● Assigned or self-selected ● Free or paid 25. Parent Support
Recommended tabs:
● Get Help ● My Cases ● FAQs ● Policies ● Contact Support
My Cases should show:

<!-- page 14 -->

● Case reference ● Status ● Latest update ● Required action ● Messages ● Uploaded evidence

Part Five: Tutor Workspace 26. Tutor Sidebar
Recommended tutor navigation:

1. Home 2. Bookings 3. Students 4. Services 5. Lessons 6. Resources 7. Earnings 8. Profile
2. Tutor Home
   Recommended widgets:
   ● Next Required Action ● Upcoming lessons ● Booking requests ● Overdue lesson summaries ● Homework awaiting review ● Parent or student questions ● Earnings snapshot ● Direct payments awaiting confirmation ● Commission due ● Student alerts
   Tutors may hide the earnings widget unless it is mandatory for an unresolved action.
3. Tutor Bookings
   Bookings should be one top-level section containing:
   ● List ● Calendar ● Requests ● Recurring ● Waiting lists ● Past bookings

<!-- page 15 -->

Calendar should be a view within Bookings rather than a separate sidebar item.
The system should remember the tutor’s last-used booking view. 29. Tutor Students
Recommended tabs:
● Active ● Waiting list ● Past ● All
Filters may include:
● Subject ● Year level ● Next lesson ● Action required ● Payment status ● Format
The tutor student profile should share the same core structure as the parent view.
Tutor-only areas should appear according to permission. 30. Tutor Workspace Tab Within Student Profile
Rather than adding many tutor-only tabs, the student profile should contain one protected Tutor Workspace tab.
It may contain:
● Internal Notes ● Lesson Planning ● Handover ● Tutor reminders ● Private files ● Shared-with-tutors controls
Internal Notes should be the first section. 31. Tutor Services
Recommended views:
● Published ● Draft ● Paused ● Archived
Available actions should include:
● Create service

<!-- page 16 -->

● Duplicate service ● Edit ● Publish ● Unpublish ● Pause ● Archive ● Reorder ● View linked bookings
Filters should include:
● Subject ● Year level ● Format ● Service type 32. Tutor Lessons
Recommended views:
● Upcoming ● Awaiting follow-up ● Completed ● All
Filters should include:
● Student ● Subject ● Date ● Summary status ● Homework status ● Recording status ● Action required
Lesson workspace
Should include:
● Student context ● Booking details ● Lesson plan ● Materials ● Important dates ● Current goals ● Previous summary ● Recording status ● Transcript ● AI summary draft ● Homework assignment ● Follow-up questions ● Completion records 33. Tutor Resources

<!-- page 17 -->

Recommended tabs:
● My Resources ● Marketplace ● Purchased ● Assigned
Subject should be the primary organisational structure.
Additional views may include:
● Draft ● Published ● Private ● Organisation ● Under Review ● Archived 34. Tutor Earnings
This should be a major tutor section.
Recommended tabs:
● Overview ● Payouts ● Direct Payments ● Commission ● Credits ● Statements
Earnings Overview
Should show:
● Estimated take-home earnings ● Gross lesson value as secondary information ● Upcoming confirmed earnings ● Pending Stripe payouts ● Direct payments awaiting confirmation ● Commission owed ● Commission credits ● Failed collection issues ● Recent adjustments
Payouts
Should show:
● Pending ● In transit ● Paid ● Failed ● Adjusted

<!-- page 18 -->

Direct Payments
Should show:
● Payment due ● Parent says paid ● Confirmed ● Partial ● Overdue ● Disputed ● Waived
It should support bulk reconciliation.
Commission
Should show:
● Estimated ● Reserved ● Chargeable ● Owed ● Paid ● Adjusted
Credits
Should show:
● Referral credits ● Commission credits ● Expiry ● Applied credits ● Revoked credits
Statements
Should provide:
● Weekly statements ● Fortnightly statements ● Downloadable records ● Payment history ● Adjustments 35. Tutor Profile
Public profile and private business settings should live together but remain clearly separated.
Recommended sections:
● Public Profile ● Services and Subjects ● Verification ● Availability Summary

<!-- page 19 -->

● Business Settings ● Payment Preferences ● Referral Codes ● Visibility ● Account Settings
Every field should display its visibility:
● Public ● Matched families ● Active families ● Private ● Admin only
A Preview public profile action should remain available.

Part Six: Student Workspace 36. Dependent Student Mobile Navigation
Recommended primary mobile items:
● Home ● Homework ● Lessons ● Progress ● More 37. Student Home
Recommended content:
● Do next ● Coming up ● Keep working on ● Next lesson ● Homework ● Upcoming test ● Recent feedback ● Assigned resources 38. Student Lessons
Should show:
● Upcoming lessons ● Approved summaries ● Student-visible comments ● Join lesson action ● Lesson resources

<!-- page 20 -->

39. Student Homework
    Should show:
    ● To do ● Submitted ● Reviewed ● Completed ● Overdue
40. Student Progress
    Should show:
    ● Student-friendly progress ● Current goals ● Recent achievements ● Skills being developed ● Tutor-approved feedback
41. Student Resources
    Should use subject-first navigation.
    It should show:
    ● Assigned ● In progress ● Completed ● Saved where allowed
42. Independent Student Workspace
    Independent students should receive an expanded version of the parent and student experience.
    Recommended navigation:
43. Home 2. Bookings 3. Progress 4. Tutors 5. Payments 6. Resources 7. Support
    They should control their own profile, payments and supporter access.

Part Seven: Organisation Workspace

<!-- page 21 -->

43. Organisation Sidebar
    Recommended organisation navigation:
1. Home 2. Tutors 3. Students 4. Programmes 5. Bookings 6. Resources 7. Finance 8. Reports 9. Settings
   Additional permission-based items may include:
   ● Cases ● Approvals
1. Organisation Home
   Recommended widgets:
   ● Next Required Action ● Active tutor count ● Active student count ● Upcoming programmes ● Approval requests ● Booking activity ● Financial summary ● Tutor issues ● Programme capacity ● Important alerts
1. Organisation Tutors
   Recommended tabs:
   ● Active ● Invited ● Applicants ● Paused ● Former
   Filters may include:
   ● Subject ● Programme ● Location ● Verification ● Availability ● Organisation role ● Action required

<!-- page 22 -->

46. Organisation Students
    Should support:
    ● Active students ● Cohort membership ● Tutor assignment ● Programme filters ● Progress summaries ● Organisation-limited access
47. Organisation Programmes
    Should contain:
    ● Services ● Fixed cohorts ● Drop-in sessions ● Draft ● Active ● Completed ● Archived
    Programme detail should include:
    ● Tutors ● Students ● Schedule ● Capacity ● Pricing ● Resources ● Progress ● Finance ● Approvals
48. Organisation Bookings
    Should include:
    ● Calendar ● List ● Programme bookings ● Tutor bookings ● Requests ● Recurring ● Attendance
49. Organisation Resources
    Should provide:
    ● Private organisation library ● Marketplace

<!-- page 23 -->

● Shared tutor resources ● Student resources ● Subject categories ● Approval workflow ● Contributor ownership 50. Organisation Finance
Should include:
● Revenue ● Payouts ● Tutor allocation ● Organisation commission ● Refunds ● Credits ● Statements ● Exceptions 51. Organisation Reports
Should support:
● Programme activity ● Tutor activity ● Student engagement ● Financial performance ● Capacity ● Progress ● Resource use 52. Organisation Settings
Should include:
● Organisation profile ● Branding ● Tutor permissions ● Pricing rules ● Commission rules ● Programme defaults ● Payment settings ● Resource permissions ● Managers and roles

Part Eight: Platform Manager Workspace 53. Shared Manager Navigation

<!-- page 24 -->

Recommended navigation:

1. Home 2. Cases 3. Tasks 4. Users 5. Tutors 6. Organisations 7. Marketplace 8. Payments 9. Reports 10. Rules 11. Integrations 12. Audit 13. Settings
   Sections should appear only when permitted by role and scope.
2. Manager Home
   Should prioritise:
   ● Next Required Action ● High-risk alerts ● Overdue tasks ● Cases awaiting review ● Approval requests ● Workload summary ● Escalations ● Important recent activity
   The content should adapt to the manager’s role.
3. Cases
   Recommended views:
   ● My Cases ● Unassigned ● Waiting for User ● Waiting for Another Party ● High Risk ● Incidents ● Resolved ● All Cases
   Case detail should contain:
   ● User-visible status ● Internal status ● Linked users ● Linked bookings ● Linked payments ● Messages

<!-- page 25 -->

● Evidence ● Internal notes ● Restricted sections ● Tasks ● Approvals ● Decision ● Audit trail 56. Technical Incidents
Technical incidents should remain a specialised case type inside Cases.
The Incidents view should filter by:
● Severity ● Module ● Integration ● Status ● Affected users ● Detection time ● Resolution time ● Assigned manager ● Root cause ● Recurrence
A separate top-level Incidents section may be introduced later if operational scale requires it. 57. Tasks
Recommended views:
● My Tasks ● Team Tasks ● Overdue ● High Priority ● Awaiting Approval ● Completed
Task detail should show:
● Assignee ● Due date ● Priority ● Linked case or record ● Checklist ● Internal notes ● Escalation ● History 58. Users
Should support permission-aware search and management of:
● Parents

<!-- page 26 -->

● Students ● Independent students ● Supporters ● Tutors ● Organisation users 59. Tutors
Should include:
● Applicants ● Under Review ● Active ● Restricted ● Suspended ● Departed ● Verification ● Visibility controls ● Reliability ● Profile moderation 60. Organisations
Should include:
● Applicants ● Active ● Restricted ● Suspended ● Programmes ● Tutors ● Finance ● Support cases 61. Marketplace
Should include:
● Resources awaiting review ● Assessments awaiting review ● Published content ● Reported content ● Contributor disputes ● Royalty issues ● Categories ● Quality controls 62. Payments
Should include:
● Stripe activity

<!-- page 27 -->

● Direct-payment commission ● Failed collections ● Refunds ● Chargebacks ● Payment plans ● Adjustments ● Payout issues 63. Reports
Should include:
● Saved dashboards ● Standard operational reports ● Scheduled reports ● Custom reports ● Alerts ● Export management 64. Rules
Rules should remain separate from Settings.
The Rules area should be organised by module:
● Bookings ● Payments ● Commission ● Cancellations ● Matching ● Tutor visibility ● Safeguarding ● Recording ● Notifications ● Referrals ● Marketplace ● Organisations ● Support ● Data retention
Each module should show:
● Active ● Draft ● Scheduled ● Expired ● Conflicting ● Approval status 65. Integrations
Should show:

<!-- page 28 -->

● Stripe ● Calendars ● Video lessons ● Email ● Notifications ● File storage ● Future accounting integrations ● Connection status ● Errors ● Retries ● Health ● Logs 66. Audit
Audit should be a top-level item for authorised managers.
It should include:
● User actions ● Manager actions ● Impersonation ● Permission changes ● Financial adjustments ● Rule changes ● Data access ● Exports ● Sensitive downloads ● Overrides 67. Manager Settings
Should include only configuration permitted by the manager’s role and scope.

Part Nine: Platform Owner Workspace 68. Platform Owner Navigation
The Platform Owner should use the same core manager navigation, with additional owner-only sections:
● Managers ● Platform Health ● Countries and Regions ● Global Configuration ● Financial Rules ● Legal and Safeguarding ● Data Retention ● Emergency Controls

<!-- page 29 -->

● Platform Security ● Ownership 69. Managers
Recommended views:
● Active ● Invited ● Suspended ● Former ● Roles ● Temporary Access ● Approvals ● Workload ● Performance
Manager profile
Should show:
● Assigned roles ● Assigned scopes ● Temporary permissions ● Approval authority ● Impersonation rights ● Export permissions ● Current tasks ● Recent actions ● Audit history ● Scheduled reports ● Alerts
Permissions matrix
The Managers section should include a visual matrix comparing:
● Roles ● Capabilities ● Scopes ● Sensitive-data access ● Approval rights ● Impersonation rights ● Export rights ● Owner-only actions ● Temporary permissions 70. Platform Health
Should show:
● Integration status ● Failed webhooks ● Failed jobs

<!-- page 30 -->

● Payment errors ● Email-delivery issues ● Notification failures ● Recording and transcript failures ● Calendar-sync issues ● Storage warnings ● Security alerts ● Recent incidents ● Configuration warnings
Each issue should include:
● Severity ● Affected module ● Affected users ● Detected time ● Current owner ● Recovery actions ● Related logs ● Create incident case 71. Countries and Regions
Should manage:
● Active countries ● Currency ● Time zones ● Tax treatment ● Legal wording ● Payment methods ● Curriculum frameworks ● School-year naming ● Safeguarding requirements ● Notification rules ● Address formats ● Distance units 72. Global Configuration
Should manage structural platform settings such as:
● Branding ● Navigation defaults ● Default widgets ● File limits ● Role templates ● Search behaviour ● Platform-wide preferences 73. Financial Rules
Should include:

<!-- page 31 -->

● Commission ● Stripe treatment ● Direct-payment collection ● Refunds ● Credits ● Payment plans ● Financial thresholds ● Approval requirements 74. Legal and Safeguarding
Should include:
● Consent rules ● Recording rules ● Age thresholds ● Student access ● Safeguarding workflows ● Incident requirements ● Mandatory notifications ● Locked rules 75. Data Retention
Should include:
● Retention by data type ● Country rules ● Case rules ● Recording retention ● Transcript retention ● Account deletion ● Legal holds 76. Emergency Controls
Should include tightly controlled actions such as:
● Emergency platform notice ● Regional booking pause ● Integration shutdown ● Payment restriction ● Tutor suspension controls ● Temporary safeguarding rule ● Emergency manager access 77. Platform Security
Should include:
● Manager authentication ● Multi-factor requirements

<!-- page 32 -->

● Session controls ● Suspicious access ● Credential health ● Audit alerts ● Export controls ● Sensitive-data protections

Part Ten: Shared Record Patterns 78. Sticky Context Headers
Major entity pages should use sticky headers where useful.
Examples:
● Student ● Tutor ● Booking ● Case ● Organisation ● Programme ● Resource
A sticky header may include:
● Name ● Status ● Key relationship ● Next action ● Filters ● Quick actions ● Urgent alerts 79. Shared Timeline Pattern
Major records should contain a traceable timeline.
Examples include:
● Student ● Tutor ● Booking ● Payment ● Case ● Resource ● Organisation
The timeline should show:
● Event ● Creator

<!-- page 33 -->

● Date ● Status change ● Related record ● Visibility ● Amendment history 80. Shared Status Pattern
Statuses should be:
● Plain-language ● Visually consistent ● Filterable ● Supported by definitions ● Traceable through history 81. Shared Filter Pattern
Filters should:
● Persist during a session ● Be easy to clear ● Show active-filter count ● Support saved views where useful ● Respect permissions ● Avoid exposing unavailable data 82. Shared Detail-Page Pattern
Major detail pages should generally contain:
● Sticky context header ● Summary or Overview ● Tabs ● Activity timeline ● Actions ● Permissions-aware content ● Related records ● Audit access where authorised

Part Eleven: Quick-Create Menus 83. Parent Create Menu
Possible actions:
● Add student ● Request booking ● Add test date

<!-- page 34 -->

● Create student action ● Open support case 84. Tutor Create Menu
Possible actions:
● Create service ● Add availability ● Assign homework ● Add progress update ● Create resource ● Create assessment ● Invite family 85. Student Create Menu
Possible actions:
● Add goal ● Add test date ● Submit work ● Ask a question 86. Organisation Create Menu
Possible actions:
● Invite tutor ● Add programme ● Create cohort ● Create service ● Add resource ● Create report 87. Manager Create Menu
Possible actions:
● Create case ● Create task ● Draft rule ● Create report ● Invite manager, where authorised ● Create incident from alert

Part Twelve: Mobile Priorities

<!-- page 35 -->

88. Parent Mobile
    Recommended bottom navigation:
    ● Home ● Students ● Bookings ● Progress ● More
89. Tutor Mobile
    Recommended bottom navigation:
    ● Home ● Bookings ● Students ● Lessons ● More
90. Student Mobile
    Recommended bottom navigation:
    ● Home ● Homework ● Lessons ● Progress ● More
91. Organisation Mobile
    Recommended bottom navigation:
    ● Home ● Tutors ● Programmes ● Bookings ● More
92. Manager Mobile
    Recommended bottom navigation:
    ● Home ● Cases ● Tasks ● Alerts ● More
    Users may customise items within platform-defined boundaries.

<!-- page 36 -->

Part Thirteen: Visibility and Permission Behaviour 93. Conditional Navigation
Navigation items should appear only when:
● The user has the relevant role ● The role has the capability ● The user has the required scope ● The feature is active in that country or organisation ● The record relationship permits access 94. Empty States
Empty states should explain:
● What the section is for ● Why it is empty ● What the user can do next ● Whether access or configuration is required 95. Hidden Versus Unavailable
Studdy should distinguish between:
● Hidden because irrelevant ● Unavailable because of permission ● Disabled because of configuration ● Not yet available ● Restricted because of account status
The user should receive an appropriate explanation without exposing sensitive internal details. 96. Public and Private Indicators
Tutor-profile and business-setting fields should clearly indicate visibility.
Private operational areas should use clear visual boundaries and labels.
Internal manager notes must never appear visually similar to user-visible messages.

Part Fourteen: Information Architecture Principles

<!-- page 37 -->

97. Student-centred continuity
    Student information should be accessible through one coherent profile rather than fragmented modules.
98. Role-specific simplicity
    Each workspace should emphasise what that user needs to do, while universal controls remain consistent.
99. One clear next action
    Home screens should prioritise the most important current action.
100.  Context before depth
      Overview screens should surface essential information before requiring users to open detailed tabs.
101.  Subject-first learning content
      Resources, progress and learning content should be organised clearly by subject.
102.  Finance deserves first-class navigation
      Tutor earnings and parent payments should be prominent, trustworthy and easy to understand.
103.  Separate scheduling from teaching work
      Bookings should manage time and status.
      Lessons should manage preparation, delivery and follow-up.
104.  Separate rules from settings
      Rules control operational behaviour.
      Settings control structural configuration.
105.  Consistency across workspaces
      Similar record types should use shared patterns while preserving role-specific actions and visibility.
106.  Mobile should be intentionally designed
      Mobile navigation and layouts should reflect the highest-frequency actions of each workspace.

<!-- page 38 -->

107. Personalisation with safe defaults
     Users may customise navigation and dashboards, but essential actions and mandatory widgets must remain visible.
108. Administration should scale
     Manager and Platform Owner architecture should support future staffing, delegated access, operational queues and specialist teams.
109. Audit must remain accessible
     Audit and platform health are operational functions and should not be buried inside general settings.
110. Progressive complexity
     Advanced features such as multiple saved layouts, large technical-incident workspaces and extensive personalisation may be introduced as Studdy scales without redesigning the underlying structure.
