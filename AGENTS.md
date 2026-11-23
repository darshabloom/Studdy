# Studdy repository working rules for AI coding assistants

These instructions apply to every Studdy coding, testing, preview-link and merge task. They supplement the authority order in `claude/studdy-fable-handoff-brief.md`.

## CRITICAL: Always use the newest correct version

1. **Re-resolve the current state at the start of every task.** Fetch current GitHub PR head SHA, its head and base branch, merge status and current release/deployment state. Never rely on a previously reported commit, preview, branch or chat link.
2. **Follow the correct branch ancestry.** Distinguish production `main`, the current parent/base PR, and the latest active feature PR. An older parent PR or past preview is never interchangeable with the current head. Confirm whether the user's request concerns the public site, Tutor Home, Tutor Setup, tutor application, Parent UI or another separate route.
3. **Before offering a browser-test URL**, identify the specific **latest READY deployment for the exact intended commit SHA and branch**, verify the route exists in that commit, and make sure it represents the requested feature. Include branch/short SHA, route, what changed and what the user will see. Do not send an old deployment because it is remembered or easy to access.
4. Preview URLs are immutable deployment snapshots; after each new commit obtain a new READY deployment URL (or verify a stable branch alias now resolves to the current SHA). Never claim the browser contains newer code while the deployment is still building, stale or failed.
5. Be precise about **user/account state**: an approved tutor opening `/apply/tutor` sees an approved application, whereas an unapproved applicant can access the form. For interface-only review provide the dedicated synthetic preview and explain that it does not persist/submit data. Do not send the approved owner to the legacy application and call it a test of the new wizard.
6. **Verify the feature itself**, not merely the CI status: match screenshot/route to the intended design; use real browser/preview verification when possible, and disclose when it is pending.
7. If the newest deployment is not ready, say so and give the exact preview path and planned visual checklist rather than substituting an older version. Keep release verification distinct from design preview.

## CRITICAL: Branch and PR hygiene

1. Reuse the smallest appropriate active scoped feature branch. Do not create unnecessary stacked or disposable branches for small fixes.
2. A merged PR is complete only after merge SHA/target branch and deployment are verified and its **merged source/head feature branch is deleted** (remote branch, plus local copy when available). Do not delete shared `main`, release, protected branches, active PR branches, or a parent branch that has dependent/unmerged child PRs.
3. Where GitHub's **Automatically delete head branches** repository setting can safely enforce deletion, enable/use it through an authorised operation; otherwise explicitly delete the remote merged head branch when supported. Confirm its absence; if tool access or permissions prevent deletion, disclose the blocker and leave an explicit cleanup item rather than claiming the branch was removed.
4. Check related open PRs and dependencies before deleting any branch. A draft/open PR branch remains until merged or deliberately closed.
5. Do not merge into production unless release gates and approval policies are satisfied. Green CI for a foundation module does not mean the full application UI, OAuth or onboarding is live.

## User-facing communication

For every browser-testable change, provide the current precise Preview link, route, commit/branch identity, a concise list of visual differences and a concrete browser-test checklist. State what is **still not implemented**, especially if actions are disabled or data is synthetic. Do not repeatedly send the user to an outdated page or ask them to test features that are not deployed.

**Product context (24 Nov 2026):** Six Tutor Application sections approved in SC-62. PR #61 is the parent Tutor onboarding readiness journey; PR #62 `sc-62/tutor-application-v2-foundation` is its child. The interactive synthetic wizard lives at `/apply/tutor/v2/preview`; `/apply/tutor` remains the legacy/application-status route and approved owners see an approved status. Real v2 collection/submission remains feature-gated pending legal/safeguarding/reviewer controls. This context is historical; **re-fetch live states before acting**.
