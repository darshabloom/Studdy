# Studdy development working agreement

Agreed 25 November 2026.

## Roles and authority

Product owner: product direction, exploration, feedback, final product acceptance. ChatGPT: product architecture, design, implementation, tests, deployment coordination and persistent documentation, within available tools. Ask focused questions when requirements are unclear; challenge trade-offs before consequential changes. Never invent decisions or claim work was executed without verification.

GitHub holds current product decisions, code and technical documentation. Shortcut tracks tasks, bugs and acceptance criteria; reconcile relevant story decisions into GitHub. Figma holds visual references; preserve exact version/node links and approved exports where available. Vercel provides previews and deployment evidence. Chat history is supporting evidence only. Historical Tutoryn PDFs are reference, not automatic current requirements.

## Session cycle

1. Fetch current main, AGENTS.md, current-direction.md, recovery-checkpoint.md and relevant requirements, story and design. Inspect actual implementation and deployment. If access fails, disclose and stop consequential work.
2. Classify scope small, medium or large. Split large tasks into independently testable slices; choose a clear stopping point. Do not predict exact chat context capacity.
3. Clarify material unknowns, then build an interactive preview using synthetic data and existing design foundations. Record any delegated assumptions.
4. User tests connected screens and provides feedback. Save approvals and supersessions as they occur.
5. Complete domain logic, permissions, error/empty/loading states, tests and documentation. Use AGENTS.md release gates; merge approved green scoped PRs without redundant approval.
6. Record checkpoint with branch/PR/head SHA, files changed, approved decisions, tests actually run and results, preview route and data mode, blockers and exact next action. Save checkpoints before risky or lengthy steps and at each handoff; never depend on a long chat surviving.

## Environments

Pre-launch exception approved 25 November: retain the single existing Studdy Supabase project as a shared development database. Vercel main is a pre-launch release baseline, not an authorised public customer service. Verify protected access, actual database targets, sandbox payment mode and email suppression before test mutations; preserve existing records, prohibit destructive resets, use clearly marked fictional data and review migrations for compatibility with all deployed versions. No live student data or real payments. Establish a stable protected testing URL and fictional role accounts. Separate clean production database, credentials, auth, storage and provider configuration plus verified isolation are mandatory before public launch. Staging may be introduced later.

## Recovery and transition

R01 repository/deployment audit; R02 recover Tutor design and functionality; R03 durable knowledge baseline; R04 verify stable development environment; R05 move to clean Studdy Development ChatGPT project with concise instructions, first-chat prompt, source links and working plan. Move only after baseline is available and environment status is documented. Preserve old project as archive; no duplicate active PDFs. If a blocker remains, document it explicitly.

## Proposed Tutor chunks

T01 Home and navigation, real scheduled bookings; T02 Calendar and availability; T03 Students; T04 Lesson delivery and learning (split); T05 Earnings (confirm eligibility rules); T06 Resources; T07 Profile, services and onboarding (split). Sequence is proposed and may change with product owner feedback. Do not defer launch-critical security or safeguarding.
