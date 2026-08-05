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
