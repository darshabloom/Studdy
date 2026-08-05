# Supabase infrastructure

Environments (brief §11): **Local** → **Studdy Development** → **Studdy Staging** →
**Studdy Production**. Credentials, auth users, storage buckets and databases are never
shared between environments.

- **Local** — `config.toml` here; `pnpm supabase:start` (requires Docker Desktop and the
  Supabase CLI). Database on `127.0.0.1:14322`, API on `14321`, Studio on `14323`,
  email inbox on `14324`.
- **Development** — the `studdy` Development cloud project. Connection values live in
  `apps/web/.env.local` / Vercel environment settings, never in the repository. The
  service-role key is server-only and must never reach browser code.
- **Staging / Production** — configured later; schema changes arrive only via reviewed
  migrations in `packages/database/migrations/`.

Schema migrations are owned by `packages/database` (the repository is the source of
truth). The Supabase dashboard is never used for schema changes.
