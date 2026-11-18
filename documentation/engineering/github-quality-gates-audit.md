# GitHub quality gates audit — Story sc-30

Audited: 18 November 2026
Repository: [darshabloom/Studdy](https://github.com/darshabloom/Studdy)
Shortcut: [sc-30](https://app.shortcut.com/studdy/story/30)

## Directly verified

- Default branch: `main`.
- Repository visibility: **public**. This is a current configuration fact and should be
  reviewed as an explicit owner decision; changing visibility is outside this Story.
- GitHub branch API reported `protected: false`, with required status-check enforcement
  `off` for `main`.
- Repository rulesets endpoint returned an empty list.
- The connection cannot read the legacy branch-protection settings endpoint (403), but
  the branch API response provides evidence that `main` is currently unprotected.
- Repository merge settings: squash, merge-commit and rebase methods all enabled.
  Auto-merge disabled.
- Existing workflow `.github/workflows/ci.yml` runs on PRs and pushes to main with
  four jobs:
  1. `Typecheck, lint, unit tests, build` (typecheck, lint, Prettier, unit, RLS, build).
  2. `Migrations, seeds, integration tests` (local Supabase, empty database
     migration, synthetic seeds, integration assertions, migration idempotency).
  3. `Playwright end-to-end` (local auth, test database, browser suite).
  4. `Secret scanning` (Gitleaks).
- CI's Supabase CLI version was pinned to `2.111.0` in sc-28 after the previously
  unpinned major release broke local configuration compatibility.
- Recent PRs #52 and #53 were squash merged only after all four CI jobs passed;
  those merges were voluntary, not enforced by GitHub branch protection.

## Recommended repository settings (owner action required)

Open `https://github.com/darshabloom/Studdy/settings/branches` or the
repository's **Settings → Rules → Rulesets** page. Create an active branch
ruleset targeting `main`:

1. Require a pull request before merging, including changes made by repository admins
   where the applicable settings support enforcement.
2. Require status checks to pass. Select exactly the live job check names:
   - `Typecheck, lint, unit tests, build`
   - `Migrations, seeds, integration tests`
   - `Playwright end-to-end`
   - `Secret scanning`
3. Block force pushes and deletion of `main`.
4. Avoid requiring an external human approval by default for a solo developer;
   retain explicit human/risk sign-off for children's information, authorisation,
   payments, schema changes and production credentials.
5. Consider disallowing bypass and requiring the PR branch to be up to date where
   it is operationally manageable.
6. Under **Settings → General → Pull Requests**, leave squash merge on and disable
   merge commits and rebase merge. Enable automatic deletion of head branches,
   if desired and available.

**Important:** the settings are currently not applied by the connected GitHub
tooling, which has no repository-settings mutation action.

## Verification after applying settings

- Re-fetch the `main` branch and confirm `protected: true`.
- Inspect the active ruleset and confirm the precise required checks.
- Attempt a non-destructive direct push test from a throwaway local branch,
  expecting a rejection (do not push application changes directly to main).
- Open a test PR with a deliberately failing check; confirm GitHub refuses merge.
  Revert the deliberate failure; confirm the check passes.
- Confirm the normal Story → branch → PR → CI → squash merge → deploy workflow.

## Boundaries

No production code, application privileges, secrets, CI checks or workflows
were changed in this audit. No claim of protection is made until verification.

## Follow-up

The repository is currently public. Decide whether that visibility is intended
before considering changes that would impact free-tier branch protection options.
