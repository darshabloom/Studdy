# Product Design System and UX Standards

> **Source document 01 of the Studdy planning pack.**
> Extracted verbatim from `01Product Design System and UX Standards.pdf` on 7 August 2026.
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
Product Design System
and

UX

Standards

Version 1.0
Status: Approved Product: Studdy Tagline: The platform for better tutoring. Date: 31 July 2026
A warm, accessible and governed design foundation for the public website and every Studdy
workspace.

<!-- page 2 -->

1. Purpose
   This document defines the approved product design system and user experience standards for Studdy. It translates the product vision, public website direction, information architecture, permissions model, status rules, technical architecture and implementation blueprint into a consistent visual, interaction and content framework. ● Visual identity, colour, typography, spacing and layout ● Responsive behaviour for public and authenticated experiences ● Core components, cards, forms, tables, calendars and dashboards ● Status, alerts, loading, empty, error and restricted states ● Parent, tutor, student, organisation, manager and Owner workspace differences ● Accessibility and content design standards ● Design-system governance, testing and Fable implementation rules
2. Approved design principles
   Principle Approved direction Professional educational warmth Studdy should feel credible, modern, calm and human without becoming childish, clinical or generically corporate. Purple and green identity Purple anchors the platform and primary actions. Green represents learning growth and positive momentum while remaining distinct from semantic success. Role-aware density Public and student experiences remain spacious. Tutor, manager and Owner workspaces become progressively more operationally dense. Accessible by default WCAG 2.2 AA is the minimum design and implementation standard across the full product. Meaning before decoration Components, colour, charts and illustrations must improve comprehension, trust or action rather than merely decorate the interface. One governed design system Fable and implementation teams must use Studdy tokens, components and patterns rather than creating disconnected page-specific styles.
3. Visual personality
   Approved direction Professional educational warmth with modern product polish. The interface should communicate trust, calm competence, educational care, clear organisation, positive momentum and individual attention. It should avoid looking childish, gimmicky, excessively corporate, visually noisy or like one tutor's personal website. ● Generous but controlled spacing ● Softly rounded components ● Clear typographic hierarchy ● Warm neutral surfaces ● Strong but not aggressive calls to action ● Subtle depth rather than heavy shadows ● Gentle transitions and consistent status communication
   3.1 Workspace density
   Area Default density and character Public website Spacious, expressive and visual, with large headings, tutor imagery and product previews.

<!-- page 3 -->

Parent workspace Clear and moderately spacious, centred on students, progress and next actions. Tutor workspace Efficient and moderately compact for regular operational use. Dependent student workspace Simple, visual and low density, with age-appropriate next actions. Independent student workspace Clear and capable, combining student simplicity with self-management. Manager and Owner workspaces Denser tables, queues, split views and controls without compromising readability or risk visibility. 4. Colour system
Purple remains the primary Studdy brand colour. Green is a genuine secondary brand colour associated with learning growth, progress and positive momentum. Warm neutrals provide the main surfaces and text foundation.
4.1 Purple roles
● Deep purple for high-contrast brand moments and dark feature surfaces ● Primary purple for main actions and selected navigation ● Mid purple for interactive emphasis ● Pale lavender for selected states, highlighted cards and branded surfaces
4.2 Green roles
● Deep green for supporting brand moments ● Mid green for secondary emphasis and progress-oriented interactions ● Pale green for learning growth, achievements and supportive feature surfaces
4.3 Semantic colours
Brand green must not be the only success treatment. Studdy requires separate semantic tokens for information, success, warning, risk, critical danger, neutral status and restricted access. Every semantic state must also use text, icons or patterns rather than colour alone. 5. Typography
Studdy should use a restrained two-font system: a highly readable modern sans serif for the application and body text, plus a slightly more distinctive display typeface for selected public headings and brand moments. Role Use Display 1 Large public hero heading Display 2 Major public section heading Heading 1 Workspace page title Heading 2 Major section title Heading 3 Card or panel heading Body large Introductions and important explanations Body Default application text Body small Supporting metadata Label Form, table and control labels Caption Timestamps, references and secondary details Finance, time, statistics and progress views should use tabular numerals where supported. Long-form public and policy text should remain in readable columns rather than stretching across large screens.

<!-- page 4 -->

6. Shape, depth and iconography
   6.1 Corner style
   Studdy uses moderate rounding. Buttons and inputs use gentle rounding, primary cards and dialogues use a medium radius, and pill shapes are reserved for compact statuses, filters and segmented controls. Tables remain restrained and should not use rounded individual cells.
   6.2 Borders and shadows
   Borders, spacing and surface contrast provide the main depth system. Standard cards and tables generally use no shadow. Light shadows may support raised summaries, while medium shadows are reserved for menus, popovers, date pickers, drawers and dialogues. Focus must be visually stronger than hover.
   6.3 Icons
   Studdy uses one consistent outline icon family. Filled or coloured variants are reserved for active navigation and important states. Important actions pair icons with text. Icon-only controls require accessible labels, adequate target size and tooltips where helpful.
7. Surfaces, spacing and layout
   7.1 Surface hierarchy
   Surface Approved role Page background Warm off-white Primary card White Secondary card Very light neutral tint Brand feature Pale lavender Progress feature Pale green Warning or restricted Soft amber or muted neutral warning tint Critical Very pale red
   7.2 Four-pixel spacing system
   Value Typical use 4 px Very tight internal spacing 8 px Closely related items 12 px Compact controls 16 px Standard component spacing 24 px Cards and grouped content 32 px Major component separation 48 px Large section spacing 64 px Public page sections 96 px Major marketing separation The design system should expose semantic spacing tokens rather than scattered raw values. Dense operational views may use smaller approved spacing but should preserve readable text and adequate targets.
   7.3 Containment
   ● Public pages may use full-width backgrounds with wide visual containers and narrower reading columns. ● Authenticated workspaces use a persistent desktop sidebar, compact top bar, flexible main canvas and optional contextual right panel. ● Forms use deliberate maximum widths based on task complexity.

<!-- page 5 -->

● Calendars, tables and assessment builders may use the full available workspace width. ● Contextual panels become drawers, bottom sheets or separate pages on smaller screens.
7.4 Responsive philosophy
Breakpoints should be content driven. The product may still expose compact, medium, wide and extra-wide tokens, but components should change when their content stops working well rather than relying only on generic device labels. ● Tutor cards move from horizontal to vertical as space reduces. ● Persistent filters collapse into drawers. ● Tables become record cards or horizontally scroll where precision requires it. ● Desktop sidebars become workspace-aware bottom navigation. ● Context panels become drawers. ● Dashboard grids reduce columns deliberately. ● Mobile experiences are designed separately rather than shrinking desktop screens. 8. Photography, product previews and illustration
8.1 Real tutor photography
● Tutor profiles use the actual tutor, good lighting and a clear face. ● Heavy filters, misleading backgrounds and inconsistent crops should be avoided. ● Photography never replaces verification, subject, price, availability or match information. ● Example profiles must be clearly labelled and never presented as real tutors.
8.2 Product previews
Public pages should show realistic synthetic product previews of tutor recommendations, student progress, upcoming lessons, homework, goals, approved summaries, tutor scheduling and lesson preparation. No real student information may appear in marketing previews.
8.3 Illustration
A limited purple-and-green editorial illustration system may support onboarding, empty states, achievements and public storytelling. Studdy should avoid generic cartoon children, school-supply clutter, fake tutor portraits, overused stock imagery and AI-generated people presented as real. 9. Actions, forms and navigation
9.1 Button hierarchy
Level Use and treatment Primary Main local action. Purple fill. Normally one dominant action per decision region. Secondary Meaningful supporting action. Neutral surface with border. Tertiary Lower-emphasis visible action. Quiet or text Low-priority actions such as Skip for now or Clear filters. Destructive Critical semantic styling with consequence explanation and confirmation. Icon-only Only for familiar compact controls and always with accessible naming. Action labels should describe the outcome, such as “Pay and confirm booking” rather than “Proceed”. High-risk controls should remain separated from routine actions.

<!-- page 6 -->

9.2 Form anatomy
● Visible label above every control ● Clear required or optional state ● Helper text explaining format, purpose or visibility ● Error text beside the affected field ● Strong focus state ● Distinct disabled and read-only states ● Accessible validation summary for larger forms ● Server-authoritative validation for business rules Long forms such as tutor applications should use staged sections, visible progress, last-saved state, review screens and return-to-section links. Placeholder-only forms are prohibited.
9.3 Navigation
Workspace navigation should remain visually calm. A neutral sidebar uses outline icons and dark labels, while the active destination receives a pale lavender background, purple icon and stronger label weight. Notification counts are reserved for meaningful action items. ● Desktop: persistent workspace sidebar and compact universal top bar ● Universal controls: workspace switcher, search, create, notifications, messages, help and account ● Mobile: workspace-specific bottom navigation with More for secondary destinations ● Navigation is permission aware and must not expose inaccessible areas unnecessarily 10. Cards, status and communication patterns
10.1 Card families
Card family Purpose Summary card Concise overview of a person, record or area Action card Unresolved task with reason, deadline and action Person card Tutor, student, family member, supporter or manager identity Record card Booking, lesson, homework, payment, goal, assessment or case Metric card Quantitative summary with context and date range Promotional card Public or onboarding call to action Sensitive information card Restricted, safeguarding, identity, payout or permission content Empty-state card Explains why no records appear and what to do next
10.2 Status system
Every important status uses a plain-language label, icon, semantic treatment and optional explanation. Status must never rely on colour alone. Status family Meaning Active Available or operating normally Pending Waiting for processing or another person Awaiting action A named person must act, often before a deadline Complete Expected process finished successfully Paused or held Temporarily stopped while preserving relevant context Restricted Some capabilities remain while others are blocked Overdue Required action missed its deadline Failed Attempt did not complete Cancelled Process intentionally ended before completion Archived Preserved but removed from ordinary active use Important statuses should explain what the status means, why it applies, what remains allowed, what is blocked, who must act and what happens next.

<!-- page 7 -->

10.3 Alerts and notiﬁcations
Pattern Use Inline alert Contextual information inside a page or form Action banner Prominent unresolved issue requiring action Toast Brief confirmation of a completed low-risk action Notification-centre item Persistent cross-platform update with deep link Critical interruption Rare blocking issue involving safety, security, payment conflict or unavailable continuation Studdy should use the least disruptive pattern that safely communicates the issue. Important outcomes such as payments, refunds, permission changes or suspensions require persistent confirmation rather than a toast alone. 11. Data presentation and system feedback
11.1 Tables and record lists
Dense operational information should use responsive data tables. Human-centred parent and student content should use structured lists or cards. Some modules may offer several views and remember the last-used choice. ● Tables support headings, sorting, filters, selection, bulk actions, sticky headers and accessible row actions. ● Parent upcoming lessons and student homework use cards or structured lists. ● Tutor bookings may offer calendar, list and compact table views. ● Mobile uses record cards where hierarchy matters and horizontal scroll where precise column comparison matters.
11.2 Dashboard widgets
Every workspace Home screen should use a shared widget framework. Each widget defines its eligible roles, priority, size, permissions, refresh behaviour, mandatory status, customisation rules and mobile treatment. ● States: loading, ready, empty, error, restricted, action required, stale and provider unavailable ● Priorities: critical, action required, high value, informational and optional ● Users may reorder, hide optional widgets, resize supported widgets and restore defaults ● Desktop and mobile layouts are stored separately ● One widget failure should not normally break the entire dashboard
11.3 Loading and processing
Pattern Use Skeleton Initial page, card or list loading Button progress Short server command with duplicate submission blocked Inline processing Upload, scan, payment, transcript or export state Progress indicator Long multi-stage workflow with genuine stages Background task Work continues after the user leaves and later notifies them Delayed-provider state External service is slow but has not yet failed The interface must not claim success before the authoritative server result returns. Long tasks should explain whether the user can leave, how progress is tracked and what recovery is available.

<!-- page 8 -->

12. Empty states, conﬁrmation and search
    12.1 Empty states
    Empty states should be practical and encouraging. They explain what the area contains, why nothing appears, whether filters or access are involved, and one clear next step. They should avoid forced cheerfulness, jokes in serious areas and large decorative artwork in operational screens.
    12.2 Impact previews
    Consequential actions should show actual impact rather than a generic “Are you sure?” dialogue. Confirmation strength increases with consequence. Level Examples and response 1 - easily reversible Unpin shortcut or hide optional widget. Complete immediately with safe Undo. 2 - meaningful but recoverable Pause service or archive draft. Short impact dialogue. 3 - significant Cancel lesson, end recurring series, remove tutor access or issue refund. Full impact preview. 4 - high risk Suspend tutor, change payout destination, export sensitive data or transfer ownership. Strong authentication, reason, acknowledgement and possible second approval.
    12.3 Search and ﬁlters
    ● Search always displays its current workspace and record scope. ● Active filters appear as removable chips with a clear-all control. ● Result counts and sort controls remain visible. ● Mobile filters use a drawer or full-screen sheet. ● URL-backed state should preserve safe search, filters, sorting and selected view where suitable. ● Saved operational views may later preserve filters, columns, density and view type. ● Results must be permission filtered before presentation.
13. Form workﬂows and scheduling
    13.1 Autosave
    Long-form drafts should autosave to the server and display a visible last-saved state. Autosaving must remain clearly separate from submission, publication, approval or external communication. Short consequential forms save only after deliberate submission. ● Suitable autosave: tutor application, profile, service setup, assessment, resource, programme and long support submissions ● No implicit autosave submission: payment confirmation, refund, cancellation, approval, publication or permission change ● Version conflicts must be detected rather than silently overwriting newer work ● Unsaved-change warnings appear only where meaningful work would be lost
    13.2 Tabs, steps and accordions
    Pattern Correct use Tabs Peer views such as Upcoming, Past and Cancelled Steps Ordered workflows such as tutor application, matching and booking confirmation Accordions Optional supporting detail such as Why we ask or advanced options

<!-- page 9 -->

Core content, required fields, critical warnings and primary actions should not be hidden in accordions.
13.3 Calendar language
Studdy should use one shared scheduling language across tutor availability, parent booking, recurring lessons, students and manager corrections. Calendar state Meaning Available Tutor may receive an eligible booking Temporary hold Time protected while request or payment is unresolved Requested Booking request exists but is not confirmed Awaiting payment Tutor accepted and parent action is outstanding Confirmed Booking is final and active Unavailable Tutor cannot be booked Travel buffer Protected time for an in-person lesson Personal blocked time Private tutor unavailability Recurring slot Time reserved for an ongoing arrangement Calendar views must respect privacy. Families see unavailable time without other student identities or private tutor reasons. Every scheduling interface shows the relevant time zone and handles daylight-saving changes clearly. Accessible list and direct-entry alternatives are required. 14. Learning progress, charts and identity
14.1 Layered progress
Studdy must not reduce a student to one simplistic score. Progress should use connected layers: simple overview, subject progress, skill or curriculum detail, supporting evidence and movement over time. Audience Default presentation Parent Simple summary of strengths, improvements, support needs, goals and next actions Tutor Detailed skill, evidence, attribution, confidence and history Dependent student Encouraging age-appropriate wording without fixed-ability labels Independent student Accessible summary plus full personal detail Manager or organisation Aggregated reporting by default, identifiable detail only when authorised Progress scales should be configurable. A possible default is Not yet assessed, Beginning, Developing, Secure and Extending. The interface should show confidence and evidence quality where judgements are preliminary or well supported.
14.2 Data visualisation
● Charts answer a clear question and show time range and measurement. ● Direct labels are preferred over distant legends. ● Tables or text alternatives provide precise values. ● No 3D charts, decorative gauges, rainbow palettes, unexplained gradients or student leaderboards. ● Educational timelines may be more appropriate than continuous charts. ● Financial charts never replace exact financial records. ● Charts must not imply causation or precision unsupported by the data.

<!-- page 10 -->

14.3 Identity presentation
A shared identity pattern should present photo or avatar, preferred display name, role or relationship, relevant context and verification or status where appropriate. The active workspace must remain obvious when one person holds several roles. ● Tutor verification labels are specific: identity verified, qualification verified, references completed and Studdy interviewed. ● Student photos remain private and never appear in the public marketplace. ● Fallback avatars use stable initials and accessible neutral or brand-tinted backgrounds. ● Records identify the creator, role and date to support trust and traceability. ● Manager identities may show scope, temporary access and approval authority. 15. Accessibility standard
Minimum standard Studdy targets WCAG 2.2 AA across the public website and every authenticated workspace. Accessibility is part of component and interaction design from the beginning, not a final review step. ● Keyboard-only operation and no keyboard traps ● Visible focus and deliberate focus management ● Accessible colour contrast and non-colour communication ● Screen-reader support and logical heading structure ● Text resizing, zoom and content reflow ● Reduced motion support ● Accessible labels, errors, tables, dialogues, calendars and charts ● Adequate touch targets and predictable navigation ● Captions and transcripts for tutor videos and educational media
15.1 Special interaction requirements
● Drag-and-drop always has keyboard alternatives. ● Dialogues trap focus and return it to the triggering control. ● Form failure moves focus to an accessible error summary where appropriate. ● Calendars provide keyboard navigation, list alternatives and direct entry. ● Charts provide text summaries and data tables where useful. ● Student interfaces reduce cognitive load and avoid assuming every learner benefits from gamification.
15.2 Testing
Testing should include automated checks, keyboard review, screen-reader review, contrast testing, zoom and reflow testing, reduced-motion testing, accessible-name review and manual review of forms, calendars, charts and focus management. Automated checks alone are insufficient. 16. Content and microcopy
Studdy should use plain language, direct action wording, respectful status explanations, calm error handling, honest uncertainty and clear consequences. The words in the interface are part of the product design. Prefer Avoid Pay and confirm booking Proceed Tutor response required by 5:00 pm Pending We could not confirm the payment yet Transaction error You do not have access to family payment information Forbidden End recurring lessons Delete Choose at least one subject Invalid input

<!-- page 11 -->

16.1 Role-aware wording
The same event may use different wording for parents, tutors and managers while preserving the same underlying meaning. Student wording should be concrete, shorter and encouraging without becoming patronising.
16.2 Dates, times and money
● Dates should be unambiguous, such as Friday, 31 July 2026 at 4:00 pm. ● Time zones should be shown where users may view a different zone. ● Money should show currency, exact amount, fee breakdown and whether figures are estimated or final. ● Generic internal terminology should be translated into plain user language unless technical detail is genuinely required.
16.3 Terminology governance
The design-system documentation should maintain an approved vocabulary for core concepts such as Tutor, Parent or guardian, Dependent student, Independent student, Booking request, Confirmed booking, Lesson, Service, Recurring series, Homework assignment, Progress update, Concern, Support case, Restriction and Suspension. 17. Design-system governance
The design system should live in packages/design-system and serve the public site and every workspace. Area Examples Tokens Colour, typography, spacing, radius, shadow, border, breakpoints, motion and z-index Primitives Button, input, label, checkbox, radio, switch, select, dialog, popover, tooltip, tabs and accordion Components Status badge, alerts, cards, tables, filters, forms, stepper, calendar, workspace switcher and impact preview Layouts Public, workspace, form, dashboard grid, split view, detail panel and reading layout Patterns Loading, errors, restricted access, confirmation, autosave, navigation, upload and progress visualisation
17.1 Token-ﬁrst rule
Shared components should use semantic tokens rather than arbitrary local colours, spacing or radii. Raw values require deliberate review and documentation. Semantic tokens describe purpose, such as colour.action.primary or colour.status.warning, rather than appearance alone.
17.2 Component governance
● Every shared component has an owner, purpose, variants, responsive behaviour, accessibility guidance, tests and examples. ● A pattern becomes shared when it appears repeatedly, has important accessibility requirements or benefits from central consistency. ● Feature pages must not create local replacements for existing shared components. ● New shared components are reviewed for overlap, reuse need, naming, API simplicity, tokens, accessibility and test coverage.

<!-- page 12 -->

17.3 Storybook and visual testing
Storybook or an equivalent isolated environment should document every shared component using realistic synthetic data. Stories should cover default, variants, focus, disabled, loading, error, empty, long text, compact width, wide width and keyboard interaction. Visual regression tests should cover desktop, medium and mobile widths and should be deliberately reviewed. 18. Fable implementation handoff
18.1 Fable may generate
● Page layouts and component compositions ● Responsive variants ● Public marketing sections ● Dashboard arrangements ● Storybook drafts ● Empty-state illustrations ● Product preview layouts ● Initial design-token implementation
18.2 Fable must use
● Approved Studdy tokens and shared components ● Approved card families, button hierarchy and status patterns ● Approved form anatomy, navigation and responsive rules ● Approved accessibility and content standards
18.3 Fable must not
● Create a second visual system or unrelated fonts and colours ● Create page-specific button variants where shared components already exist ● Use inaccessible custom controls or colour-only statuses ● Use placeholder-only labels ● Present fake or AI-generated tutor identities as real ● Copy production student data ● Bypass impact previews or permission-sensitive states ● Treat a desktop screenshot as the mobile design
18.4 Page-generation checklist
● Page purpose and primary user ● Active workspace and required permissions ● Primary and secondary actions ● Main status states ● Loading, empty, error and restricted states ● Mobile behaviour and accessibility considerations ● Shared components used 19. Design implementation deﬁnition of done
● Shared tokens are used and existing components are reused. ● Any new component is documented and tested. ● Responsive states are implemented deliberately. ● Keyboard operation works and focus is visible. ● Contrast meets WCAG 2.2 AA. ● Loading, empty, error and restricted states exist. ● Long content and realistic synthetic data have been tested.

<!-- page 13 -->

● Visual regression and automated accessibility checks pass. ● Manual review is complete for complex interactions. ● Content follows the approved microcopy standard. ● Consequential actions use impact previews. ● Permission-sensitive information is handled correctly. ● The page works within its approved workspace structure. 20. Relationship to other approved Studdy documents
This document should be applied together with the following approved or governing Studdy documents: ● Studdy Vision and Product Principles ● Studdy Tutor Discovery and Public Website Direction ● Studdy Information Architecture and Screen Map ● Studdy User Roles and Permissions ● Studdy Permissions, Roles and Access Control ● Studdy Statuses, State Transitions and Business Rules ● Studdy Data Model and Entity Relationships ● Studdy MVP Scope and Delivery Plan ● Studdy Technical Architecture and Security Design Version 1.0 ● Studdy Implementation Blueprint and Repository Plan Version 1.0 Document status This document is complete at the decision level and approved as Studdy Product Design System and UX Standards Version 1.0.
