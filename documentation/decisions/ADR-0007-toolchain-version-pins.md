# ADR-0007: Toolchain version pins

Status: Accepted · Date: 2026-08-05

No planning document pins any version (identified cross-pack gap). Pinned here; upgrades
arrive via Dependabot PRs that must pass the full CI gate.

| Tool              | Version policy          | Pinned via              |
| ----------------- | ----------------------- | ----------------------- |
| Node              | 24.x (current LTS line) | `.nvmrc`, `engines`     |
| pnpm              | 10.x                    | `packageManager` field  |
| Turborepo         | ^2.5                    | root devDependencies    |
| TypeScript        | ^5.9, strict            | package devDependencies |
| Next.js           | ^15.5 (App Router)      | apps/web                |
| React             | ^19.1                   | apps/web                |
| Tailwind CSS      | ^4.1 (CSS-first tokens) | apps/web                |
| Radix primitives  | ^1/^2 per package       | design-system           |
| Drizzle ORM / Kit | ^0.44 / ^0.31           | database                |
| Supabase JS / SSR | ^2.50 / ^0.6            | web, database           |
| Vitest            | ^3.2                    | all packages            |
| Playwright        | ^1.55                   | apps/web                |
| Zod               | ^4.0                    | configuration           |

The pnpm lockfile is the authoritative resolution record; CI installs with
`--frozen-lockfile`.
