# Studdy release and preview rules for coding assistants

These instructions apply to every Studdy coding, review, deployment and merge task. Re-check current GitHub and Vercel state on each task; historical screenshots, chat links and commits are not live status.

## Approved work must reach main

1. A feature is **released** only once its approved, fully tested pull request has been merged into `main` and the **main production deployment** verified. Merging into another feature branch is integration only, never a production release. Report the actual merge base and target prominently.
2. Once the user approves a scoped feature, checks pass and no security/privacy/product blocker remains, merge it promptly into `main`. Do not make the user approve unchanged work repeatedly. Hold only for genuine unresolved decisions, failed tests or risks.
3. Isolate safe, approved visual changes in independently mergeable PRs based on current `main` if a stacked branch is blocked by unrelated unfinished OAuth, identity, safeguarding or data work. Do not move unfinished sensitive flows into production simply to ship approved UI.
4. Avoid stacking PRs unnecessarily. For existing stacks disclose their complete parent chain and what is still absent from main. No feature is described as “on main” unless verified there.
5. Following each verified merge, delete the merged source branch if safe and no dependent open PR requires it. Verify its absence. If the connected GitHub capability cannot delete branches, report the blocker and use GitHub’s Delete branch UI; never claim cleanup occurred without checking.
6. Before merging confirm: current head SHA and target, green mandatory CI, visual acceptance for affected routes, correct account/role access, migration compatibility, production readiness and unresolved comments. Verify production SHA after merging and give one canonical permanent production URL.

## Preview accuracy

1. Before each browser-testing link, fetch the _current_ PR head SHA and confirm it matches the Vercel deployment SHA, branch, READY state and intended route. Preview URLs are immutable snapshots; never reuse a stale URL for new work.
2. Label all links **Production · main** or **Preview · branch**. Include commit, exact route, expected visual changes and whether data is synthetic, persisted or submitted.
3. READY only means deployed. Verify the correct component and approved design, not just build status. Check old versus new headers, routes and identity states.
4. Never send an approved tutor to a legacy approved-status page for testing a new applicant form. Use public synthetic preview for form design review when appropriate.
5. If latest deployment is building or CI pending, say so. Do not substitute a previous READY preview.

## Protect existing behavior

Preserve the approved Tutor Home, role isolation, Parent workspace, Stripe, safeguarding, and production. Real Tutor Application v2 collection must remain gated until legal document versions, guardian consent, reviewer decisions and end-to-end integration tests are complete.

## Current product knowledge and session handoff

Read [current product direction](documentation/product/current-direction.md), [development workflow](documentation/implementation/development-workflow.md) and [recovery checkpoint](documentation/implementation/recovery-checkpoint.md) at the beginning of each task. Fetch live repository and deployment state before acting. The old launch-status document and historical PDFs are reference snapshots, not verified current status.

Record material approvals, superseded decisions and unresolved conflicts in the current product documentation. Update the checkpoint throughout each slice and at handoff. Scope work to manageable, independently testable increments; ask about material uncertainty and challenge unnecessary complexity. Preserve approved designs and protect production. Use synthetic development data for interactive previews. The approved pre-launch shared database exception and mandatory launch isolation are defined in the development workflow; never assume preview data is isolated, never reset the shared database, and verify protection and sandbox providers before mutations.
