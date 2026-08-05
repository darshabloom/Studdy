# ADR-0001: Use Supabase Auth for authentication

Status: Accepted · Date: 2026-08-05 · Required by Blueprint §19.3

## Decision

Supabase Auth owns credentials, email verification, password reset, sessions, factors and
provider identities — and nothing else. The permanent business identity is
`identity.users`; the two link through `identity.auth_identity_links`
(`auth.uid() → auth_identity_links → users`). Business tables reference Studdy User IDs
only, never `auth.users`.

## Consequences

- Authentication provider is swappable without touching business identity.
- RLS policies resolve the Studdy User via `identity.current_studdy_user_id()`.
- MFA (mandatory for Platform Owner and privileged managers from launch) and step-up
  authentication build on Supabase factors; `MFA_REQUIRED` is a first-class error code.
- Local/Development/Staging/Production never share auth users or credentials.
