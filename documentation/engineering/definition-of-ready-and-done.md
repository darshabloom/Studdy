# Studdy — Definition of Ready and Definition of Done

These are lightweight delivery rules for the existing [Studdy monorepo](../../README.md).
Work is tracked in [Shortcut](https://app.shortcut.com/studdy) and implemented through linked
GitHub pull requests. Historical approved product decisions and existing code remain
authoritative; this document does not change the product's behaviour.

## Definition of Ready

A Story is ready for development when:

1. It describes one verifiable user or engineering outcome and has an owner.
2. Acceptance criteria are specific enough to test, and out-of-scope work is explicit.
3. Dependencies and any unresolved product decisions are identified.
4. Relevant design, business, privacy or permission rules are linked.
5. Risks involving money, child information, account access or migrations are flagged
   for additional review before changes begin.

Small investigations can start in the Backlog if their explicit deliverable is a decision,
reproduction or evidence report.

## Development workflow

1. Create a short-lived `sc-<id>/<short-description>` branch from `main`.
2. Link the Story using `[sc-<id>]` in the PR title or description.
3. Keep one focused deliverable per Story/PR; explain any unavoidable related fixes.
4. Follow the repository's existing package boundaries, database migration process,
   design system, security rules and automated CI. Do not disable or weaken tests
   to make a PR pass.
5. Run the relevant checks, inspect the diff, and review visible changes in a preview.
6. Squash merge when the required CI checks are green and no material unresolved
   issue exists. Changes affecting access, children's data, money, production
   secrets or migrations need explicit risk review before merge.
7. Verify the resulting `main` revision and deployment as appropriate, then
   move the Story to Done and note meaningful follow-ups.

## Definition of Done

A Story is Done when all applicable conditions are satisfied:

- The linked PR is merged, or documented configuration work is verified with evidence.
- Its acceptance criteria have been demonstrated.
- The relevant unit, integration and Playwright tests pass; any intentionally omitted
  checks are explained. The existing GitHub Actions workflow is green.
- Cross-family and cross-tutor access rules and financial invariants are tested where
  changed; data access is server-authoritative and respects existing RLS boundaries.
- New migrations are reviewed, compatible with rollout and covered by a recovery
  plan. No merged migration is silently edited.
- UI changes have an appropriate visual and accessibility review.
- Privacy-sensitive data and secrets are absent from logs, test fixtures and PRs.
- New operational behaviour has appropriate documentation and verification.
- The merge to `main` and relevant deployment/smoke checks are confirmed.
- The Shortcut Story links its PR and reflects the verified outcome.

## Guardrails for AI-assisted changes

AI tooling must work from the relevant Story and current repository state.
It should report actual test results, flag unexpected files and migration/config
changes, and distinguish verified behaviour from assumptions. Keep real student
or family records and production credentials out of prompts and fixtures.

## CI already in the repository

See [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). It runs
typecheck, lint, Prettier, unit tests, RLS classification, build, a fresh
local Supabase migration/seed/integration suite, Playwright E2E and
Gitleaks. This document does not duplicate or replace those checks.

## Shortcut statuses

Backlog → To Do → In Progress → In Review → Done.

Automatic GitHub transitions may cover only some statuses. Verify link
and transition behaviour before relying on it. **Done** requires release
verification where the Story changes a deployed feature.
