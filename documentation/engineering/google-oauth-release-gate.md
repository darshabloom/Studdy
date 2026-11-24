# Google sign-in activation gate

Status: foundation implemented, **disabled by default**. The current email/password route remains the production fallback.

Originating implementation: GitHub PR #55 (SC-42). This new slice contains only the OAuth-specific code, with a server-side release gate; it does not merge the old feature branch wholesale.

## Pre-release verification (Studdy project)

- Supabase project: `klocfukykunxiggwpohg` (verify the environment uses this intended project before making changes).
- Create Studdy-owned Google Cloud Web OAuth credentials. Configure Google Auth branding/audience and use only openid/email/profile scopes.
- In Supabase Authentication → Providers → Google, set the matching OAuth client ID and secret. Add the Supabase callback `https://klocfukykunxiggwpohg.supabase.co/auth/v1/callback` as a Google Cloud authorised redirect URI.
- In Supabase Authentication → URL Configuration, explicitly allow `https://studdy-one.vercel.app/auth/callback` and the intended stable test-preview callback. Verify SITE_URL.
- Confirm production Vercel `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` point to the same intended production Supabase project; do not introduce production database changes as part of this release.
- Test a new Google user and an existing verified email/password user. Confirm the same permanent Studdy user and unchanged roles, family/student links, bookings, payments and tutor approvals.
- Test cancel/deny/failed callback, safe next path, session, sign-out, and email/password sign-in and reset on both desktop and mobile.
- Confirm staff MFA and permission checks. No automatic escalation of roles or merging by client-side email comparisons.

**Only after these checks**, explicitly set Vercel's server-side `STUDDY_GOOGLE_AUTH_ENABLED=true` for the verified environment and redeploy. Keep it unset otherwise. Never enter Google client secrets in the repository or ChatGPT.

Source: Supabase Google Sign-In and Identity Linking documentation (reviewed 24 Nov 2026).
