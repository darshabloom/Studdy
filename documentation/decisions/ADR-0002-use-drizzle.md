# ADR-0002: Use Drizzle ORM

Status: Accepted · Date: 2026-08-05 · Required by Blueprint §19.3

## Decision

Drizzle provides typed schemas, generated migrations and standard typed queries.
Reviewed handwritten SQL covers RLS, functions, triggers, exclusion constraints, complex
transactional operations, views and performance-sensitive behaviour
(`packages/database/migrations/reviewed-sql/`).

## Consequences

- The repository is the source of truth for database structure; no dashboard schema edits.
- Migration order: `reviewed-sql/pre` → generated → `rls/functions/triggers/constraints/transformations`,
  enforced by `packages/database/src/migrate.ts`.
- Migrations are immutable once applied to a shared environment; corrections are new
  migrations (expand-and-contract for breaking changes).
