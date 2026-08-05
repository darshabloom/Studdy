# ADR-0005: Use a lightweight pnpm/Turborepo monorepo

Status: Accepted · Date: 2026-08-05 · Required by Blueprint §19.3

## Decision

One repository: `apps/web` (single deployable Next.js modular monolith) plus
`packages/{configuration,database,design-system,domain,integrations,observability,permissions,testing}`,
managed with pnpm workspaces and Turborepo. Package scope is `@studdy/*`
(the Blueprint's `@Studdy` casing is invalid on npm).

## Consequences

- Strict module boundaries enforced by export maps, TypeScript project structure and
  ESLint restricted-import rules (domain imports no framework or provider SDK).
- One deployable keeps operational surface small while modules stay isolated.
- See ADR-0006 for why this layout wins over the in-app `src/modules` alternative.
