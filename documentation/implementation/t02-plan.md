# T02 — Tutor Calendar and Availability Management

Status: scoped for development, 27 November 2026. T01 closed for protected development; **not released to main**. Scope classification: large phase divided into small/medium independently testable PRs. Begin T02a first; this document is planning, not proof of implementation.

## Source inspection

Read current development versions of AGENTS.md, documentation/product/current-direction.md, development-workflow.md and recovery-checkpoint.md. Reviewed apps/web/src/lib/availability/actions.ts, apps/web/src/app/tutor/availability/page.tsx, packages/database/src/repositories/availability.ts, packages/database/src/repositories/lesson-requests.ts, reservation schema, decisions PD-010, PD-012, PD-017, PD-019 and PD-020; searched Shortcut SC-60, SC-62 and related tickets.

Existing implementation already provides recurrence create/update/archive, weekly drag interaction, one-off add/remove exceptions, private family-safe projection, minimum-gap control, active-tutor repository scoping and the established week/calendar view. Preserve these; do not rebuild the editor. T01 accepted all seven days on mobile; name-first/subject-second label refinement remains deferred.

### Specific defect risk identified

bookableSlotsForTutors currently selects reservations by status_code='active' and interval overlap without checking expires_at. listTutorReservations does likewise. Thus an expired request_hold left active can hide bookable time. A display-only expiry filter would be insufficient: the database's active-reservation GiST exclusion constraint could still reject a new reservation. Existing expireOverdueRequests and payment-selection expiry workflows must be audited before changing release semantics; in-flight payments and confirmed bookings must not be released. Standalone synthetic hold created in T01 is useful for observing this risk; never delete or repurpose it indiscriminately.

## Slices and acceptance

### T02a — Hold expiry and booking conflict integrity (SC-149; small/medium)
1. Map creation, acceptance, selection, payment pending, timeout, withdraw and booking-confirmed paths, cron scheduling and reconciliation ownership.
2. Make expired temporary-hold reconciliation server-authoritative and idempotent, at a transactional booking boundary, with appropriate sweep/retry integration. Keep reservation history and audit semantics; confirmed bookings remain reserved. Review null expiry and old records.
3. Ensure both tutor calendar and family-facing bookable slots reflect the reconciled state. Protect active holds and payment processing; include race-safe expiry-vs-confirmation ordering.
4. Tests: expired active hold vs live hold vs confirmed booking, overlapping concurrent requests, gap snapshot, cross-tutor isolation, clock boundaries/Asia? use Pacific/Auckland incl DST, retry/re-entry and malformed/legacy states. Four mandatory CI checks, SHA-matched protected preview, owner verification. Do not mutate shared hosted DB until safety rechecked.

### T02b — Recurring availability editing (small/medium)
Review existing drag, resize, create and archive controls against domain validators and server-side ownership. Verify effective dates, repeat schedule, format, overlap, empty/error/loading and keyboard/mobile behaviour. Tests for other-tutor IDs and stale updates. Preserve existing editor.

### T02c — One-off availability and blocked periods (small/medium)
Verify additions, removals, private notes and format scope; protect existing booked periods, show truthful state on conflicts and preserve history. Test cross-midnight, timezone, archived exceptions and privacy of family preview.

### T02d — Connected calendar projections (small)
Keep Tutor Calendar, Home, availability editor and family-derived slots consistent after change, with cache revalidation as required. Preserve seven simultaneous mobile days and read-only booking geometry; avoid broad styling changes.

### T02e — Regression and close-out (medium)
Validate all affected roles, current hosted synthetic tutor fixtures, empty/full states, permissions and concurrency; mandatory CI, protected verified development deployment and owner desktop/mobile acceptance. Document exact branch, PR, SHA, tests and evidence. Main release remains subject to AGENTS.md gates.

## Risk controls and scope boundaries

Shared Studdy Supabase is pre-launch development only. Preserve all existing accounts, lessons, reservations and fixtures. No reset, live payments, provider messaging, real student data, production config, or public publication. Validate current runtime environment before any hosted stateful test. Existing security/RLS and tutor ownership are mandatory. Confirm historic payment/request state-machine rules before modifying transactions. T01 branch/OAuth cleanup remains housekeeping, independent of T02 feature work.

## Tracking and next action

Shortcut https://app.shortcut.com/studdy/story/149 is T02a. Next: perform focused lifecycle trace and select minimal fix; create isolated T02a code branch and PR targeting development, with test coverage and verified CI/preview before integration. This document is an initial scoping checkpoint; no code tests have been executed and no new preview verified by this activity.
