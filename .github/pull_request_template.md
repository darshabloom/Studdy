## Shortcut Story

<!-- Link the Story. Use [sc-123] in the PR title or body to enable Shortcut tracking. -->

Story: <!-- Paste Shortcut Story URL here -->

## What and why

<!-- Briefly describe the user or engineering outcome and the scoped change. -->

## Acceptance criteria

- [ ] The Story's acceptance criteria are met.
- [ ] Out-of-scope behaviour remains unchanged.

## How tested

<!-- List commands actually run and their outcomes. Do not mark checks passed before they run. -->

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format`
- [ ] `pnpm test`
- [ ] `pnpm check:rls`
- [ ] `pnpm build`
- [ ] Integration / Playwright tests when relevant (describe):
- [ ] Relevant UI inspected at desktop and mobile widths (or N/A):
- [ ] Full GitHub Actions CI green before merge.

## Risk and release

- **Children's data, roles, privacy or permissions:** None / describe and link tests.
- **Payments, booking state or payouts:** None / describe and link tests.
- **Schema or migrations:** None / describe migration order, compatibility and checks.
- **Configuration or dependencies:** None / list changes and intended effects.
- **Rollback:** How to reverse the change safely; data migrations may need forward fixes.
- **Deployment / smoke checks:** What must be verified after merge.

## Reviewer notes

<!-- Call out non-obvious behaviour, edge cases, and questions requiring a decision. -->

## AI-assisted work

<!-- State what tools generated or changed, which files were manually reviewed, and any limitations. -->

## Definition of Done

- [ ] Changes are scoped to the linked Story and reviewed.
- [ ] Required checks, security/privacy verification and applicable tests passed.
- [ ] Relevant documentation and operational runbooks updated.
- [ ] Deployed behaviour verified where applicable; Story status updated only after verification.
