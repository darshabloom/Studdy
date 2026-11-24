# Google sign-in configuration — [sc-42](https://app.shortcut.com/studdy/story/42)

Google is the primary sign-in/sign-up choice. **Email and password must remain
available**, including password reset. The code does not require any new
public client secrets. All role assignments remain server-authoritative.

## Required owner configuration (per environment)

1. In **Google Cloud Console → Google Auth Platform**, create or choose a
   Studdy-owned project, configure branding/audience and a **Web application**
   OAuth client. Use only the standard `openid`, `email` and `profile`
   scopes. Keep client secrets in Google Cloud/Supabase only.
2. In **Studdy's Supabase dashboard → Authentication → Providers → Google**,
   copy the project-specific Supabase callback URL and enter it as an
   authorised redirect URI in the Google OAuth web client. Enable the Google
   provider with the matching Client ID and Secret.
3. In **Supabase → Authentication → URL Configuration**, allow the precise
   Studdy site origins and the callback path `/auth/callback` for each
   environment. For Vercel previews prefer a stable preview hostname rather
   than a broad wildcard. Keep production and development database/provider
   credentials isolated.
4. For localhost, the project's `infrastructure/supabase/config.toml`
   is a local-only fixture; configure a test Google OAuth client if testing
   real provider redirects locally. Do not use production credentials.
5. Check the canonical `NEXT_PUBLIC_SITE_URL` and the environment's actual
   deployment origin. The Google start route uses the current request origin
   for its callback, so that origin must be in Supabase's redirect allow-list.

## Validation before enabling for families

- Google first-time sign-in enters the existing Studdy onboarding and age
  declaration; returning accounts restore their original workspace.
- Password sign-in, new email/password registration and password recovery
  continue working without changes.
- Test signing into an **existing verified email/password account** with
  Google, confirm the same permanent Studdy User, students, lessons, bookings,
  payment records and role permissions. Provider/email linking behaviour
  depends on the Supabase Auth configuration; confirm before rollout.
- Verify cancellation, denied consent, callback failure, safe internal
  redirects and sign-out.
- Test parent, tutor, independent student, dependent student and admin.
  MFA-required staff must retain their existing second-factor checks.
- Check both mobile and desktop; use synthetic records in previews.
- Keep deployment protection enabled. Do not store OAuth secrets or test
  account credentials in the repo, PRs or screenshots.

**Current implementation caveat:** CI tests the UI and existing
email/password paths. Live Google provider authentication and identity linking
must be demonstrated using a properly configured Studdy Supabase project
before treating this Story as done.
