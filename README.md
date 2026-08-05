# Studdy

**The platform for better tutoring.**

Studdy is a public multi-tutor platform combining a trusted tutor marketplace, a tutor
operating system, booking and payment management, and a continuous student learning record.

## Repository layout

Lightweight monorepo (pnpm + Turborepo), modular monolith — one deployable Next.js
application with strict module boundaries.

```
apps/web            The Studdy Next.js application (App Router)
packages/
  configuration     Typed environment validation, feature flags, platform config
  database          Drizzle schemas, migrations, reviewed SQL (RLS), seeds
  design-system     Studdy-owned tokens, primitives, components, layouts
  domain            Pure domain modules — no framework or provider imports
  integrations      Provider adapters (Stripe, email, …) behind domain interfaces
  observability     Logging and correlation
  permissions       Capability model, workspace codes, permission evaluation
  testing           Builders, fixtures, scenarios, assertions
infrastructure/     Supabase, Inngest, Vercel, operational scripts
migration/          DarshaTutor data-migration tooling (distinct from schema migrations)
documentation/      Architecture, ADRs, implementation notes, operations, product
claude/             Build brief, implementation plan and planning digest (authority docs)
```

## Getting started

Prerequisites: Node 24 (see `.nvmrc`), pnpm 10, Docker Desktop, Supabase CLI.

```
pnpm install
pnpm supabase:start   # local Supabase (requires Docker)
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Commands

| Command                        | Purpose                                           |
| ------------------------------ | ------------------------------------------------- |
| `pnpm dev`                     | Run the app locally                               |
| `pnpm build`                   | Production build                                  |
| `pnpm typecheck`               | TypeScript strict checks                          |
| `pnpm lint`                    | ESLint incl. package-boundary rules               |
| `pnpm test`                    | Unit tests (Vitest)                               |
| `pnpm test:integration`        | Integration tests (require local database)        |
| `pnpm test:e2e`                | Playwright end-to-end tests                       |
| `pnpm db:generate`             | Generate migrations from Drizzle schema           |
| `pnpm db:migrate`              | Apply migrations                                  |
| `pnpm db:seed`                 | Load synthetic seed scenarios                     |
| `pnpm db:reset`                | Reset the local database (fails safely off-local) |
| `pnpm supabase:start` / `stop` | Local Supabase stack                              |

## Environments

Local → Studdy Development → Studdy Staging → Studdy Production. Credentials, auth users,
storage buckets and databases are never shared between environments. Destructive commands
fail safely when the target environment is unclear.

## Rules of the road

- The repository is the source of truth for database structure.
- Every exposed table has RLS enabled with an intentional, classified policy — CI fails otherwise.
- Business rules live server-side in the domain layer, never in React components.
- Financial history is append-only. Approved snapshots are immutable.
- Synthetic data only in development. Example tutors are always clearly labelled.
- See `claude/studdy-fable-handoff-brief.md` for the full build rules and authority order.
