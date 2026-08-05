# ADR-0004: Use a transactional outbox

Status: Accepted · Date: 2026-08-05 · Required by Blueprint §19.3

## Decision

Consequential operations write, in ONE database transaction: the business change, audit
event(s), status transition(s), a Domain Event (`audit.domain_events`) and an Outbox Entry
(`audit.outbox_entries`, unique idempotency key). Asynchronous delivery reads the outbox;
processing is idempotent and duplicate-safe.

## Consequences

- No dual-write inconsistency between the database and notifications/webhooks/emails.
- Duplicate commands or webhook retries never duplicate Bookings, payments, ledger
  entries or notifications (Statuses doc §86).
- Selection close-out in the multi-tutor model (one Booking confirms, competitors close,
  holds release, notifications fan out) rides on this mechanism.
