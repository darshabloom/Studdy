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

## Inngest is the production scheduler

**There is exactly one production scheduling mechanism, and it is Inngest.**

`apps/web/src/inngest/functions/expire-requests.ts` runs `expireOverdueRequests` on the cron
`* * * * *` — once a minute. Inngest reaches the app at `POST /api/inngest`, signed with
`INNGEST_SIGNING_KEY` and verified by the SDK's own `serve` handler.

| Property         | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Function id      | `expire-overdue-requests` (slug `studdy-expire-overdue-requests`)     |
| Trigger          | `cron: * * * * *`                                                     |
| Endpoint         | `apps/web/src/app/api/inngest/route.ts`, Node runtime                 |
| `maxDuration`    | 300s — Inngest's documented Vercel value, and Hobby's default and max |
| Concurrency      | 1 — one run at a time                                                 |
| Business command | `expireOverdueRequests`, unchanged and scheduler-agnostic             |

### Why once a minute

The payment window is sixty minutes and the tutor is told when their hold ends, so the
sweep's period is the error bar on that promise. At five minutes a family could be told 5:00
and the slot stay held until 5:05 — a small lie told to a tutor about their own calendar. The
sweep is a single batched transaction that finds nothing to do on almost every run.

Inngest's documentation states no minimum interval for cron triggers and no plan-tier limit
on cron frequency. **Note one free-plan behaviour that matters at this cadence:** a function
that fails twenty times consecutively is paused automatically — twenty minutes of failures,
here. Alerting on `expiry run failed` matters more than it would at an hourly cadence.

### Why not Vercel Cron

A `vercel.json` on `feat/intended-lesson-request` previously declared:

```json
{ "crons": [{ "path": "/api/jobs/expire-requests", "schedule": "*/15 * * * *" }] }
```

The Vercel **Hobby** plan permits cron schedules **once per day only**. Any more frequent
expression fails the deployment, which is what broke the checks on
[PR #14](https://github.com/darshabloom/Studdy/pull/14).

**The schedule was removed rather than slowed down**, and it has not been reinstated.
Studdy's request deadlines are measured in hours and its payment windows in minutes; a
once-daily sweep would leave a one-hour deadline unexpired for most of a day, holding a
tutor's slot against a lesson nobody can book and showing the family a request that is
already dead. Reducing the frequency to satisfy a deployment constraint would have silently
changed the product's behaviour.

**Do not add a Vercel cron back.** Two schedulers invoking the same sweep would double the
load for no benefit and make "did it run?" a question with two places to look.

### The manual route stays

`POST /api/jobs/expire-requests` is retained for operations: forcing a sweep after an
incident, while the Inngest function is paused, or to reproduce a report. It is **not** a
second scheduler — nothing invokes it on a timer.

Both doors call `runExpirySweep` (`apps/web/src/lib/jobs/expire-requests.ts`), which owns the
correlation id, the batch size and the log shape, so neither can report something different
about the same sweep. Neither owns an expiry rule.

### Overlapping runs and retries are safe

Inngest retries a failed run and can in principle overlap a slow run with its successor.
Neither double-releases a hold nor writes a second close event, and the guarantee lives in
the repository rather than in a scheduler-side lock: `expireOverdueRequests` selects due rows
`FOR UPDATE SKIP LOCKED` inside one transaction and every UPDATE is status-guarded, so a
second run finds nothing left to do. Integration tests cover a repeated sweep and two sweeps
running at the same instant.

### Deployment prerequisites

1. Create the app in the Inngest dashboard and point it at
   `https://<host>/api/inngest`.
2. Set `INNGEST_SIGNING_KEY` in Vercel for every deployed environment. Server-only — never
   `NEXT_PUBLIC_`.
3. `INNGEST_EVENT_KEY` is **optional**. The SDK requires it only inside `inngest.send()`,
   which throws in cloud mode when it is missing; Studdy runs a cron function and sends no
   events, so nothing reads it and a deployment must not fail for its absence. The official
   Vercel integration sets it anyway, which is harmless.
4. **Neither is declared in `turbo.json`, deliberately.** Turborepo's strict env mode governs
   what a BUILD or TEST task sees, and nothing reads these at build time — the route is
   `force-dynamic` and the SDK reads the environment per request. Vercel supplies them to the
   deployed function directly, not through Turborepo. Declaring them would only add churn to
   the build cache key. If something ever does read one at build time it must be declared
   then, or strict mode will strip it silently.

Locally, no keys are needed: `npx inngest-cli@latest dev -u http://localhost:3200/api/inngest`
runs an unsigned dev server, and the SDK reports `"mode":"dev"` at the endpoint.

### Running a sweep by hand

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/jobs/expire-requests
```

---

## What still needs a person

Inngest is now implemented and running the sweep every minute (see above). It calls the
business command directly in the Next.js app rather than issuing an authenticated `POST` at
`/api/jobs/expire-requests` — one fewer network hop into the same command, and the manual
route keeps its own shared-secret check for the humans who use it.

Before any deployed environment expires anything automatically:

1. **Create the Inngest app** and point it at `https://<host>/api/inngest`.
2. **Set `INNGEST_SIGNING_KEY`** in Vercel for that environment. Without it the SDK refuses
   unsigned invocations and expiry silently never happens — the failure mode most worth
   alerting on.
3. **Keep `CRON_SECRET` set** so the manual route still works when someone needs it.
4. **Alert on `expiry run failed`.** At a one-minute cadence, Inngest's free plan pauses a
   function after twenty consecutive failures — twenty minutes. A scheduler that stops
   quietly is indistinguishable from one with nothing to do.

**Vercel Cron is no longer a candidate and must not be added back.** There is one production
scheduler.
