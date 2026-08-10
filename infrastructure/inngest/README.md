# Inngest

Durable background work (ADR-0003). First functions land with the booking slices; the directory is reserved so enabling them needs no restructuring.

## Required: scheduled expiry

Inngest is the **required production invocation mechanism** for
`POST /api/jobs/expire-requests`, which expires overdue Tutor Requests and releases their
calendar holds. The route, its shared-secret authentication, batching and idempotency all
exist and are tested; nothing invokes it on a schedule.

Vercel Cron is not used — the Hobby plan permits a once-daily schedule only, and Studdy's
deadlines are hour-based. The needed interval is **15 minutes or better**. A paid Vercel
plan is the alternative.

See [`documentation/operations/scheduled-jobs.md`](../../documentation/operations/scheduled-jobs.md).
