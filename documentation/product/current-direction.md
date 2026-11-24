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

SC-42: Google primary sign-in, retain email/password and recovery. Provider enablement is separately gated.

SC-62: progressive six-section tutor application with draft saving; exact approved questions and options are recorded in story comments. Retrieve those before building; preserve independent review and safeguarding gates.

## Approved pre-launch environment decision (25 November 2026)

Use the existing Studdy database for pre-launch development; no additional database subscription now. Preserve existing accounts and records. Shared database is permitted only while there are no real customers or live transactions; use fictional test data, restricted access and sandbox payments. Separate production database and verified isolation are mandatory before public launch. This supersedes earlier plans for immediate separate development and production databases.

## Open decisions

Historical booking, payment and instant-booking specifications conflict; reconcile against current code and approved decisions when relevant. Earnings eligibility and lesson completion semantics need confirmation before adopting older earnings logic. Remaining Tutor screen designs and mobile navigation need verification.

## Decision recording

For each material decision record ID, date, status (proposed/approved/superseded), exact decision, evidence, superseded IDs and affected specifications/tests. Update the current specification in the same change. Never silently resolve conflicting product requirements. Initial approved decisions are the bullets above and cited SC stories.

References: https://app.shortcut.com/studdy/story/60 ; https://app.shortcut.com/studdy/story/42 ; https://app.shortcut.com/studdy/story/62
