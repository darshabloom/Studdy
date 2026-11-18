# Shortcut–GitHub integration verification

Tracking: [Studdy Shortcut Story #28](https://app.shortcut.com/studdy/story/28).

## Purpose

Verify that a Shortcut Story can trace its implementation through a GitHub
branch, pull request, review and merge without changing application behaviour.

## Agreed conventions

- Create a short-lived branch for each implementation Story, beginning with
  `sc-<story-id>/`.
- Reference the Story in the PR title or body using `[sc-<story-id>]`.
- Keep the PR focused on the Story's acceptance criteria.
- Existing automated checks remain mandatory; green Vercel alone is not
  proof that the entire GitHub Actions pipeline passed.
- Mark a Story Done after the merge and applicable deployment verification.
- For changes affecting permissions, children's data, payments, migrations or
  production credentials, use additional review before merging.

## Verification checklist

- [ ] This branch appears on Shortcut Story #28.
- [ ] The PR is associated with Shortcut Story #28.
- [ ] Opening the PR moves the Story to In Review, if integration rules are enabled.
- [ ] GitHub Actions completes successfully.
- [ ] The merged change is present on main.
- [ ] Any relevant deployment is verified before marking Done.

Record observed behaviour in Shortcut Story #28, and configure missing
automation in Shortcut's GitHub integration rather than assuming it works.
