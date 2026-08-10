# Source material index

Preserved copies of the documents that materially informed the Studdy build.

These files are **source material, not working documents**. They are never edited to
match later decisions. Where a later decision changes or clarifies something here, the
decision is recorded in `docs/decisions/` and listed in the "Overridden by" column below.

## How these were produced

The fourteen planning documents were supplied to the build session as PDFs. They were
extracted to Markdown on 7 August 2026 with `pypdf`, preserving wording, section numbers
and terminology. Two caveats apply to every extracted file:

- **Layout is flattened.** Tables become run-on lines and bullet indentation is lost.
  Wording and numbering are faithful; where exact layout matters, consult the original PDF.
- **Runs of spaces are collapsed.** The PDF encoder emitted double spaces between words;
  these are normalised to single spaces. No wording was altered.

Extraction was spot-checked against known quotations, including the fan-out cap
("A recommended initial maximum is three, configurable by admin."), the tutor-selection
rule ("first tutor to accept does not automatically win"), the reservation exclusion
constraint in doc 07, and the four-pixel spacing system in doc 01. All matched.

## Authority order

Highest authority first. This is the order set by the handoff brief (§2) and it governs
when two documents disagree.

1. `../../claude/studdy-fable-handoff-brief.md` — the build brief. **Authority rank 1.**
2. `docs/decisions/` — decisions approved during implementation. These override the
   planning pack where stated, and are the reason to check them before trusting a
   planning document on any point they cover.
3. The fourteen planning documents below, in their numbered order.

Where a planning document was superseded on a specific point, the decision file says so
explicitly. Nothing in `docs/source-material/` has been quietly rewritten.

## The planning pack

| #   | Document                                                                                              | Status                      | Purpose                                                                                    | Overridden by                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | [Product Design System and UX Standards](01-product-design-system-and-ux-standards.md)                | Approved v1.0 (31 Jul 2026) | Colour roles, typography, spacing, components, status vocabulary, microcopy, accessibility | Token _values_ authored in PR1 (none existed in source); vocabulary partly superseded by the request model — see [product decisions](../decisions/approved-product-decisions.md) |
| 02  | [Information Architecture and Screen Map](02-information-architecture-and-screen-map.md)              | Draft 0.1                   | Workspaces, navigation, sidebar destinations, homepage sections                            | Workspace codes enumerated in implementation (source defines none)                                                                                                               |
| 03  | [User Roles and Permissions](03-user-roles-and-permissions.md)                                        | Draft 0.1                   | Roles, family model, student profiles, admin capabilities                                  | Single "Admin" split into Platform Manager + Owner                                                                                                                               |
| 04  | [MVP Scope and Delivery Plan](04-mvp-scope-and-delivery-plan.md)                                      | Draft 0.1, ready for review | Launch scope, delivery phases, request model, payment windows                              | Multi-tutor model confirmed; phase plan differs from the brief's package definition (brief governs)                                                                              |
| 05  | [Implementation Blueprint and Repository Plan](05-implementation-blueprint-and-repository-plan.md)    | Approved v1.0 (31 Jul 2026) | Monorepo layout, toolchain, module boundaries, RequestContext, bootstrap sequence          | Package scope `@studdy/*` (source writes invalid `@Studdy`); 20 schema dirs per doc 07                                                                                           |
| 06  | [Technical Architecture and Security Design](06-technical-architecture-and-security-design.md)        | Approved v1.0 (31 Jul 2026) | Modular monolith, identity, RLS, feature flags, CI gates, storage                          | §3.2 in-app modules layout superseded by doc 05's monorepo — see [ADR-0006](../../documentation/decisions/ADR-0006-packages-monorepo-over-in-app-modules.md)                     |
| 07  | [Database Schema and Migration Specification](07-database-schema-and-migration-specification.md)      | Approved v1.0 (2 Aug 2026)  | Named schemas, conventions, key tables, RLS patterns, migration checks                     | Reference prefixes extended (`LR-`, `TREQ-`); `TREQ-` is random not sequential — see [security decisions](../decisions/security-and-privacy-decisions.md)                        |
| 08  | [Permissions, Roles and Access Control](08-permissions-roles-and-access-control.md)                   | Draft 0.1, ready for review | Capability model, scopes, access sources, sensitive data, impersonation                    | No complete capability catalogue exists; seeded role definitions only                                                                                                            |
| 09  | [Statuses, State Transitions and Business Rules](09-statuses-state-transitions-and-business-rules.md) | Draft 0.1                   | Cross-cutting transition machinery, per-module state machines                              | Contains **no** ILR/Tutor Request machine; supplied by [multi-tutor state machine](../decisions/multi-tutor-state-machine.md)                                                    |
| 10  | [Data Model and Entity Relationships](10-data-model-and-entity-relationships.md)                      | Draft 0.1, conceptual       | Entities, fields, cardinalities                                                            | Booking status list conflicts with doc 09; resolved by splitting request state from booking state                                                                                |
| 11  | [Core User Journeys](11-core-user-journeys.md)                                                        | Draft 0.1                   | Public entry, matching, requests, deadlines, holds, direct payment                         | §11 "One Active Request Per Intended Lesson" **overridden** by the brief's multi-tutor model                                                                                     |
| 12  | [Functional Capabilities and System Modules](12-functional-capabilities-and-system-modules.md)        | Draft 0.1                   | 33 modules, capability lists, status enums                                                 | Booking status enum superseded; Stripe default confirmed                                                                                                                         |
| 13  | [Vision and Product Principles](13-vision-and-product-principles.md)                                  | Draft 0.1                   | Positioning, tagline, principles, verification labels                                      | §12 single-tutor flow and §13 direct-pay model **overridden** by the brief                                                                                                       |
| 14  | [Tutor Discovery and Public Website Direction](14-tutor-discovery-and-public-website-direction.md)    | Draft 0.1                   | Homepage structure, hero copy, tutor cards, public profile fields                          | "How it works" copy rewritten for the multi-tutor flow                                                                                                                           |

## Documents already in the repository (not duplicated here)

| Document                              | Path                                          | Purpose                                                                                                                                |
| ------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Fable Handoff and Build Brief         | `claude/studdy-fable-handoff-brief.md`        | Authority rank 1. Product model, implementation rules, approval checkpoints                                                            |
| Implementation plan and session state | `claude/studdy-implementation-plan.md`        | Running status, environment facts, conflicts, decisions needed                                                                         |
| Planning pack digest                  | `claude/studdy-planning-pack-digest.md`       | Condensed extract of all 14 documents, written when they were first read. Useful as an index; the full sources above are authoritative |
| Multi-tutor state machine design      | `docs/decisions/multi-tutor-state-machine.md` | The approved design, with its approved amendments                                                                                      |
| ADRs 0001–0007                        | `documentation/decisions/`                    | Architecture decisions from the bootstrap slice                                                                                        |

## Known gaps

Two copy artefacts appear in docs 13 and 14 and must never reach a public page: the
phrase describing the product name as "pronounced Tutor-in" (a leftover from a previous
product name), and doc 13's reference to a specific personal bank account and open-banking
provider. Both are preserved here as source, and both are explicitly excluded from
implementation.
