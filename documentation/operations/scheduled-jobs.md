# Scheduled jobs

How Studdy's recurring server-side work is invoked, and why automated invocation is
currently switched off rather than reduced in frequency.

---

## `POST /api/jobs/expire-requests`

Expires overdue Tutor Requests, closes the Intended Lesson Requests that have no live
request left, and releases the calendar holds those requests were occupying.

| Property         | Value                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| Method           | `POST` only. `GET` returns 405 because expiry mutates state                          |
| Authentication   | `Authorization: Bearer <CRON_SECRET>`, timing-safe comparison, fails closed          |
| Business command | `expireOverdueRequests` in `packages/database`                                       |
| Batching         | 200 requests per run                                                                 |
| Idempotency      | Status-guarded updates; a second run over the same rows changes nothing              |
| Logging          | Counts, correlation id and timing only — never a reference, tutor, student or family |
| Tests            | Integration coverage of the command; four endpoint e2e cases on the route            |

The route does two things: authenticate the caller and invoke the command. All expiry
logic lives in `expireOverdueRequests`, which knows nothing about HTTP or about any
particular scheduler. **Any** scheduler that can issue an authenticated `POST` on a
recurring basis is sufficient; swapping one for another needs no domain change.

See [SP-010](../../docs/decisions/security-and-privacy-decisions.md) for the authentication
decision.

---

## Automated invocation is intentionally not enabled

**There is no Vercel Cron schedule in this repository, and this is deliberate.**

A `vercel.json` on `feat/intended-lesson-request` previously declared:

```json
{ "crons": [{ "path": "/api/jobs/expire-requests", "schedule": "*/15 * * * *" }] }
```

The Vercel **Hobby** plan permits cron schedules **once per day only**. Any more frequent
expression fails the deployment, which is what broke the checks on
[PR #14](https://github.com/darshabloom/Studdy/pull/14).

**The schedule was removed rather than slowed down.** Studdy's request deadlines are
measured in hours, not days — the provisional response tiers under
[PD-012](../../docs/decisions/approved-product-decisions.md) are 24h, 12h, 4h and 1h. A
once-daily sweep would leave a request whose deadline was one hour long sitting unexpired
for up to a day, holding a tutor's calendar slot against a lesson that can no longer be
booked and showing the family a request that is in truth already dead. Reducing the
frequency to satisfy a deployment constraint would have silently changed the product's
behaviour, so it was not done.

Deployments therefore succeed and nothing calls the route automatically. Expiry is correct
whenever it runs; it simply does not yet run on its own.

### Consequences while this stands

- Overdue requests expire only when the route is invoked by hand.
- Holds for overdue requests stay `active` until then. The GiST exclusion constraint keeps
  them honest — the slot is genuinely still held, not merely displayed as held.
- Local and preview environments are unaffected in substance: neither had a working
  scheduled run before, because preview has no database.

To run it by hand against a deployed environment:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/jobs/expire-requests
```

---

## Required production invocation mechanism

**Inngest** (ADR-0003) is the intended production scheduler, and is the mechanism this
route is waiting on. A scheduled Inngest function under `infrastructure/inngest/` issues
the authenticated `POST` on a short interval — **15 minutes or better**, matching the
schedule that was removed.

Inngest is the right answer rather than a workaround: it is already the approved home for
durable background work, it gives retries, run history and observability that a plain cron
ping does not, and it removes the platform-plan dependency entirely.

**Vercel Cron on a paid plan** is the alternative. The Pro plan allows minute-level
schedules, so restoring the deleted `vercel.json` verbatim would be sufficient on its own.

Either path is acceptable. Whichever is chosen must satisfy:

1. Invocation at least every 15 minutes.
2. `CRON_SECRET` present in the target environment. Without it the route fails closed and
   expiry silently never happens — this is the failure mode most worth alerting on.
3. Failures surfaced somewhere a person looks. A scheduler that stops quietly is
   indistinguishable from one with nothing to do.

**ACTION REQUIRED FROM DARSHA — REQUIRED BEFORE STAGING.** Choose Inngest or a paid Vercel
plan. Expiry does not run automatically in any deployed environment until one is in place.
Not required now: nothing beyond local development depends on it yet.
