# ADR-0006: Packages monorepo over in-app modules layout

Status: Accepted · Date: 2026-08-05 · Resolves SOURCE CONFLICT #2

## Conflict

Technical Architecture §3.2 (Approved v1.0) describes `src/modules/` and `src/platform/`
inside a single application with no packages layer. The Implementation Blueprint §4/§31
(also Approved v1.0, same date, more specific) defines the packages monorepo. The
Database Schema spec §2.2 (approved later, 2 Aug 2026) presumes
`packages/database/src/schema/` with twenty module directories.

## Decision

The Blueprint's packages monorepo governs, with the Database spec's twenty schema
directories superseding the Blueprint's own list of twelve. The Technical Architecture
document remains authoritative for everything except this layout section.

## Consequences

- Boundary enforcement happens at package level (export maps + lint), which is stronger
  than folder conventions inside one app.
- Twenty schema directories exist from day one; tables land as slices land.
