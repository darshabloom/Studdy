# Vercel

Preview deployments for every meaningful pull request (brief §16): Development or
isolated preview resources only — never Production services; environment clearly
displayed; synthetic data only; no uncontrolled emails; no live payments.

Setup (ACTION REQUIRED FROM DARSHA — before PR1 completion):

1. Create/sign in to Vercel, import `darshabloom/Studdy`.
2. Framework preset: Next.js. Root directory: `apps/web`.
3. Environment variables for Preview (values supplied when due — do not commit):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_STUDDY_ENVIRONMENT=development`, `STUDDY_ENVIRONMENT=development`.
4. Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to Preview until a server-side need exists.

## No cron schedule here

There is deliberately no `vercel.json` and no Vercel Cron entry. The Hobby plan allows a
cron schedule only once per day, and Studdy's request deadlines are hour-based, so a
once-daily expiry sweep would weaken the product rather than merely slow it. The schedule
was removed instead of reduced.

`/api/jobs/expire-requests` is retained, protected and scheduler-independent; Inngest is
the required production invocation mechanism. Full reasoning and the pending action:
[`documentation/operations/scheduled-jobs.md`](../../documentation/operations/scheduled-jobs.md).
