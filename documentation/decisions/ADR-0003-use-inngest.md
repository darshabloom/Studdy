# ADR-0003: Use Inngest for durable background work

Status: Accepted · Date: 2026-08-05 · Required by Blueprint §19.3

## Decision

Inngest executes durable background work (outbox delivery, deadline expiry, notification
fan-out) with retries and idempotency. Configuration lives under `infrastructure/inngest/`.
The Inngest SDK never appears in the domain layer — domain code emits Domain Events plus
Outbox Entries; delivery adapters subscribe.

## Consequences

- Background execution is replayable and observable.
- First concrete functions land with the booking slices (request deadlines, hold expiry,
  notification delivery). No Inngest code ships in PR1 beyond the reserved directory.
