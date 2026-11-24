# T01 — Tutor Home and Navigation handover

Prepared 25 November 2026 from the current development code, SC-60 and the recovery checkpoint.
T01 execution remains gated on T00 security closure.

## Objective and scope

Deliver the approved light Tutor Home and usable navigation with real, authorised tutor
data. Preserve existing working booking-request, availability, services, setup and payout
flows. Start with a manageable T01a shell and dashboard slice; use follow-on slices for
data that needs additional backend verification.

## Approved reference

- SC-60: https://app.shortcut.com/studdy/story/60
- Light Tutor Home v3 two-column desktop composition; responsive cards with mobile stacking.
- Restrained v0.6 decorative motifs; no gradients or decoration overlapping content.
- Nunito and Inter; navy #0B2D5C, yellow #F6B61C, orange #F36F2B and pale blue #DDEBFF.
- Target navigation: Home, Calendar, Students, Lessons, Earnings, Resources.
- Original home_v3.png and motif_v6.png exports and precise Figma node reference remain
  unverified; preserve the existing released design as the initial implementation.

## Verified implementation starting point

- Tutor Home: apps/web/src/app/tutor/page.tsx.
- Tutor shell/navigation: apps/web/src/app/tutor/layout.tsx and
  apps/web/src/components/workspace/chrome.tsx.
- Shared workspace header: apps/web/src/components/layout/workspace-top-bar.tsx.
- Live existing routes: /tutor, /tutor/requests, /tutor/availability,
  /tutor/services, /tutor/profile and /tutor/payments.
- Current navigation: Home, Booking requests, Availability, Services, Getting paid.
- Tutor Home reads actual request counts, request holds, tutor availability,
  bookable slots and setup facts. Bookable openings must never appear as confirmed lessons.
- Next lesson and earnings are presently honest placeholders, pending verified queries.
- Historical PR #50 contains alternative tutor projections and route work, but conflicts
  with main. Review and selectively reuse code only after current specifications and
  access rules have been checked.

## T01a: first independently testable slice

1. Preserve the approved light layout and working tutor functionality.
2. Introduce clear desktop/mobile Tutor navigation toward the six target sections,
   keeping existing requests, availability, services and payouts accessible.
3. Link every interactive item to a real authorised route; label unimplemented
   destinations as coming soon without dead-end navigation.
4. Show real available home information and accurate loading, empty and error states.
5. Ensure role checks and record scoping from SC-117 apply to page reads and actions.
6. Verify a tutor and a pending applicant cannot reach one another's private functions.
7. Run required CI and verify branch/commit-matched development preview before user review.

## Subsequent slices / dependencies

- T01b: identify the authoritative confirmed-booking and lesson schedule sources,
  then show genuine next/upcoming lessons and introduce a real calendar route.
- T02: fuller Calendar and availability workflows as specified in development-workflow.md.
- T03: Students routes, record access and tutor/student associations.
- T05: Earnings only after confirming payable/completed lesson rules and Stripe state.
- T06: Resources and relevant empty states.
- T07: onboarding/applicant navigation and legacy branding.

## Carry-forward decisions and safeguards

- SC-109 workspace selection loading UX is deferred; reopen only if navigation
  reliability or permissions fail.
- SC-112 split-and-slide workspace transition is a proposal awaiting design review.
- SC-111 canonical school directory belongs to later Parent/Student phases.
- Development uses the existing shared Supabase database and controlled fictional
  accounts. No real student data, live payments, external email or safeguarding
  approvals are authorised.
- Separate production infrastructure, shared test fixture exclusion and public search
  view security review remain launch gates.
- Follow AGENTS.md for PR isolation, CI, preview identity, approval and release.
