# Database migrations

The repository is the source of truth for database structure. No undocumented manual
schema changes through the Supabase dashboard.

Layout (Blueprint §16; Database spec):

```
migrations/
  generated/       Drizzle-generated schema migrations (journalled; do not hand-edit)
  reviewed-sql/
    pre/           Extensions, named schemas, global reference sequence (runs first)
    rls/           Row Level Security policies and helper functions
    functions/     Reviewed database functions
    triggers/      Reviewed triggers
    constraints/   Exclusion / range constraints beyond Drizzle's coverage
    transformations/  Complex transactional data operations
```

Ordering (enforced by `src/migrate.ts`): `pre` → `generated` → `rls` → `functions` →
`triggers` → `constraints` → `transformations`. Reviewed files are tracked in
`drizzle.reviewed_sql_migrations` and are **immutable once applied to a shared
environment** — corrections are new files (Technical Architecture §14.3).

Every new exposed table requires an entry in `../rls-classification.json` — CI fails
otherwise (`pnpm check:rls`).
