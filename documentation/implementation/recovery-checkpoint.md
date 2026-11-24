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


## T00 development hub checkpoint (25 November 2026)

Status: **IN PROGRESS — read-only verification, no testing mutations**. The product owner opened the Studdy Development Hub for T00 before T01.

- GitHub initially showed `development` at f3206331e39227b21e6e7853607a068d7f75dabd, one fast-forward commit behind `main` at a3eb917f33e832946f5d08124dcd0d28c8eb86d5. Fast-forwarded `development` to a3eb917 using an expected-head lease and no force; confirm the resulting deployment separately.
- Vercel queried by aliases: development READY at f320633 before synchronisation, main READY at a3eb917. Both aliases resolve to deployments of project `studdy`, ID `prj_6gWvDVplpom60TPrRlguEgz0ssX2`. READY is deployment state only; site behaviour and development protection have not been browser-tested.
- **Access protection discrepancy / blocker:** current Vercel project metadata reports `passwordProtection.enabled=false`, `ssoProtection.enabled=false`, and `trustedIps.enabled=false`. The R04 historical checkpoint states password protection was configured. Verify protection on the actual development alias and provider/team scope before allowing fictional sign-in or stateful tests; do not assume it is private.
- Vercel project contains preview-scoped `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` variable names, plus environment-labelled variables spanning preview and production. Their decrypted values, effective branch overrides, and actual database targets have **not** been verified. Avoid exposing any secret in documentation.
- Studdy Supabase connector lists project `klocfukykunxiggwpohg` as ACTIVE_HEALTHY. No database writes made. Previously reported existing records must remain untouched.
- Shortcut SC-60 corroborates approved Tutor Home v3 UI and release history. SC-74 records cross-host OAuth preview redirect with strong evidence pointing to disallowed Supabase redirect URLs / Site URL fallback; fix and browser-test using stable development alias without copying OAuth codes. SC-42 maintains Google-primary plus email/password alternative.
- Searches for literal Shortcut story names `T00` and `T01` returned no matching stories as of this review; task IDs can remain internal until tracked appropriately.
- Existing branches include `feat/tutor-workspace`, `sc-42/google-primary-email-password-alternative`, `sc-62/tutor-application-v2-foundation`, `development`, and `main`. Full PR status/heads, current CI and Figma exports still need review before T01.
- **T00 remaining gates:** verify branch deployment after synchronisation; protect development access; verify effective DB project URL and server connection target without exposing credentials; confirm authentication callback and return URLs end-to-end; check Stripe test mode, email provider suppression/sandbox and registration restrictions; create clearly fictional role-based accounts only after those gates pass.
- **T01 gate:** confirm actual live approved design reference and account/role access, then implement Tutor Home/navigation in small testable PR slices. No merge to main and no live payments/registration authorised by this checkpoint.
