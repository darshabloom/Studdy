# Studdy current product direction

Confirmed with product owner, 25 November 2026. This is the current baseline; detailed historical specifications are reference material and may be superseded.

- Product: Studdy, a public multi-tutor platform.
- Build order: Tutor workspace, Parent workspace, Student workspace, public website, Admin workspace, integrated launch testing. Necessary security and administrative foundations may precede their full interfaces.
- Product owner focuses on using the product, feedback and product decisions. ChatGPT is the sole AI development partner.
- Preserve latest approved designs as the starting point; reconsider organically through testing.
- Challenge unnecessary complexity and raise genuine uncertainties before implementation. Routine reversible engineering choices are delegated.
- Preserve existing working code and architecture unless evidence warrants a change.

## Recovered design decisions

SC-60 (23 November): light Tutor Home v3 layout with restrained v0.6 motifs, Nunito and Inter, navy #0B2D5C, yellow #F6B61C, orange #F36F2B, pale blue #DDEBFF. No gradients or overlapping decoration. Target desktop navigation: Home, Calendar, Students, Lessons, Earnings, Resources. Original exports home_v3.png and motif_v6.png and Figma URL remain unverified. Do not assert approval for other screen layouts or exact mobile navigation without evidence.

SC-42: Google primary sign-in, retain email/password and recovery. Product owner reaffirmed 25 November 2026: configure and verify Google sign-in during T00, before T01 and from the beginning of hosted development testing. Provider activation must follow callback, account-linking and access safety checks; the earlier assistant choice to defer activation is superseded. Production activation remains subject to release gates.

SC-62: progressive six-section tutor application with draft saving; exact approved questions and options are recorded in story comments. Retrieve those before building; preserve independent review and safeguarding gates.

## Approved pre-launch environment decision (25 November 2026)

Use the existing Studdy database for pre-launch development; no additional database subscription now. Preserve existing accounts and records. Shared database is permitted only while there are no real customers or live transactions; use fictional test data, restricted access and sandbox payments. Separate production database and verified isolation are mandatory before public launch. This supersedes earlier plans for immediate separate development and production databases.

## Pre-launch registration decision (25 November 2026)

Owner explicitly chose to keep new user sign-up enabled in the shared Supabase project to test first-time Google and other onboarding journeys. Supersedes the proposed temporary sign-up disablement. This is a testing requirement, not authorisation for public customer acquisition. Preview access remains protected. Direct Auth/API registration and the main host are outside preview protection; monitor unexpected accounts, use controlled test identities, and review shared exposure before public launch. Do not disable registration without discussing the testing impact with the owner.

## School directory requirement (25 November 2026)

Owner approved searchable database-backed school selection wherever student school names are entered, to prevent duplicate spelling/abbreviation variants. Store a canonical school identifier rather than treating each free-text variation as a distinct school. Shared Parent and Student onboarding/profile requirement; track in SC-111. Proposed implementation: authoritative NZ school directory, official name and location, maintained aliases, optional/fallback selection for missing schools and other education settings, preserve existing free-text records until reviewed; verify source and licensing before implementation. School affiliation remains private student data. Schedule in Parent/Student phases, not T00.

## Open decisions

Historical booking, payment and instant-booking specifications conflict; reconcile against current code and approved decisions when relevant. Earnings eligibility and lesson completion semantics need confirmation before adopting older earnings logic. Remaining Tutor screen designs and mobile navigation need verification.

## Decision recording

For each material decision record ID, date, status (proposed/approved/superseded), exact decision, evidence, superseded IDs and affected specifications/tests. Update the current specification in the same change. Never silently resolve conflicting product requirements. Initial approved decisions are the bullets above and cited SC stories.

References: https://app.shortcut.com/studdy/story/60 ; https://app.shortcut.com/studdy/story/42 ; https://app.shortcut.com/studdy/story/62
