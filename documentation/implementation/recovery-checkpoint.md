# Studdy recovery checkpoint

Snapshot: 25 November 2026. Refresh live facts before acting. This file supersedes older audit snapshots for the facts explicitly verified below; older launch-status.md is historical until revalidated.

## Verified baseline (R01/R02)

Repository darshabloom/Studdy, main d8a78b889ec72d0a3bfa935f475009bd31227240 at inspection. Repository public; visibility change is a recommendation only, not authorised. Vercel production READY at matching SHA; canonical verified domain studdy-one.vercel.app. No interactive browser tests performed in recovery.

Main releases: Tutor Home v3 c55fee0, six-stage setup b66f3fa, sign-in branding b11d63f, public homepage branding f8eeb6b, gated Google OAuth d8a78b8. A deployment READY does not prove interactive behaviour or provider readiness.

Tutor Home source uses real availability and requests, but confirmed lessons and earnings are not connected. Main navigation: Home, Booking requests, Availability, Services, Getting paid. Dedicated calendar/students/lessons/earnings/resources routes not found at inspected main. SC-60 records approved target navigation and design; original exports missing.

PR #50 (feat/tutor-workspace, head 45c6876) conflicts with main. Contains tutor-scoped booking projection, calendar, students, lessons, earnings, placeholder resources and tests. Reuse selectively after review. Booking records are not lesson-delivery records; elapsed-time earnings semantics require confirmation.

PR #55 (Google auth, main base, head 9f9814a) conflicts; gated foundation separately released. PR #61 (setup, base #55, head ada1fec) overlaps separately released setup. PR #62 (application v2, base #61, head ca7e347) contains unreleased foundation; preserve approved requirements in SC-62. Do not merge stacks wholesale. Refresh all refs and CI before changes.

SC-74 records preview sign-in redirect problem; root cause unconfirmed. October launch-status.md contains historical claims on Stripe, email, webhook protection and role functionality; revalidate before treating as current. No live provider or database changes made during recovery.

## Next

R03: establish current direction and workflow; document release status of this documentation PR separately after verification. R04: inspect actual development/preview environment isolation and stable domain, resolve sign-in testing blocker, establish synthetic test access without live data. R05: provide exact project instructions, first-chat prompt, source list and working plan; tell owner when to move. T01 starts after baseline and safe testing path are established.

Open blockers: original Figma exports/URL, unverified remaining designs/mobile navigation, no confirmed stable isolated development environment, no interactive validation of current production, overlapping PRs and historical business-rule conflicts. No application code changed during R01/R02.

## R04 pre-launch environment update (25 November 2026)

R03 PR #69 merged at f3206331e39227b21e6e7853607a068d7f75dabd; all four CI jobs passed and matching Vercel main deployment READY. Product owner approved single existing Supabase database for pre-launch development, with separate production required before public launch. Read-only exact aggregate checks found no family, student, booking, request, payment or service records; existing account/tutor/application records must be preserved. This does not establish the ownership or sensitivity of all existing data. Vercel reports password protection configured, but browser access and protection scope have not been independently tested. Stable development preview, auth redirects, synthetic test accounts and sandbox payment/email isolation remain unverified. No database writes or paid infrastructure changes made. Next: verify protection, provider configuration and stable preview, then seed only approved fictional scenarios; hand off with these blockers if needed.
