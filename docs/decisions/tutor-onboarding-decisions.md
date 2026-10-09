# Tutor onboarding — decisions

Recorded 10 October 2026 with the tutor application slice (`feat/tutor-applications`).

Each decision below was made inside the approved planning pack (docs 03, 04, 07, 09, 12), which
describes tutor onboarding in far more detail than this slice builds. Where the pack leaves a
choice, the choice is stated here so it can be reviewed rather than discovered. Items marked
**needs the owner** are policy rather than engineering and are expected to be confirmed or
changed; the code is built so changing them is configuration, not a rewrite.

---

## TO-001 — An application is a workflow record, not a profile

An applicant has no public presence, cannot be booked and holds no tutor workspace. Approval is
one controlled transaction that creates all three, exactly as the database spec (§6.1, §6.3)
describes. A half-finished application therefore cannot appear in discovery, by structure rather
than by care.

## TO-002 — What the application collects, and what it deliberately does not

It collects: legal and preferred name, an optional phone number, subjects, year levels, formats,
headline, teaching approach, experience, optional qualifications, two or three referees, and one
declaration (18 or over, accurate, agrees to the tutor terms, accepts the safeguarding
requirements).

It does **not** collect identity documents, a date of birth or police-vetting evidence. Those are
checked by a person outside the form and recorded as a check outcome, so Studdy holds the result
and not the documents. Data Studdy never asked for cannot leak.

## TO-003 — Four checks, all required by default — **needs the owner**

Identity, safeguarding requirements, references and an interview are each recorded on their own,
with who checked and when (database spec §6.4 prohibits one generic "verified" flag). **Approval
is refused unless every required check is verified**, read under a lock inside the approval
transaction, so the gate cannot be raced or bypassed by the screen that sent the click. A
**failed** check is reported separately from one that is merely outstanding, and blocks.

The default is all four, because the pack says identity, required safeguarding checks and serious
reference concerns must never be deferred, and an interview is part of the application it
describes. Which checks are required is a versioned rule, `tutors.required_application_checks`,
so it can change without a release. **The rule fails closed:** an empty, malformed or unknown value
falls back to all four, never to "none", because an empty list would mean "approve anyone" and
must be a deliberate change.

What "safeguarding requirements met" means in practice (for example a police vet) is the owner's
policy. This slice records the outcome of whatever the reviewer checks.

## TO-004 — Public labels

A verified identity, references and interview earn the public labels `identity_verified`,
`references_completed` and `interviewed` (the pack's "Identity verified", "References completed",
"Studdy interviewed"). Safeguarding earns **none**: it is a condition of working with children, not a
selling point, and a label for one tutor would imply its absence on the others.

## TO-005 — Conditional approval is not in this slice

The pack allows conditional approval for non-critical outstanding items. It is left out, because
nothing here could drive it yet: every required check is verified or the tutor is not approved.
The outcomes built are approve, request changes (the applicant edits and resubmits as a new
revision) and decline.

## TO-006 — Approval makes a person a tutor; it does not put anything on sale

An approved tutor has a profile (`approved`, visible by status) and a tutor workspace, but is **not
listed in discovery** until they have a published service, which has its own review (the next
slice). Nothing about being approved makes anyone bookable.

## TO-007 — Reviewing is staff-only, re-checked every time

Server actions are directly callable endpoints, and a page's data fetch runs alongside its
layout. So every reviewer page and action calls `requireStaff()` itself, which re-reads the
caller's active manager or owner role and requires an MFA session at assurance level 2 (PD-002).
It fails closed: an unreadable database or an unreachable auth service is a refusal. The workspace
layout's guard is the second layer, not the only one.

## TO-008 — What an applicant is told, and what they are never told

An applicant sees the message a reviewer wrote **for them** with a changes-requested or declined
decision, and never a reviewer's own note. The audit trail records the outcome of a check and
never the reviewer's words about a person. The queue names an applicant by the first name they
chose to be known by, not their legal name.

---

## Still open

- **Retention of a declined or withdrawn applicant's personal data** (legal name, phone, referees'
  emails). Nothing deletes it today. A retention period is a privacy decision for the owner,
  alongside SP-011's treatment of notification records.
- **The wording of the declarations and the tutor terms.** The form says what is declared in
  plain words and records which version was accepted; the legal text itself is the owner's.
- **Emails to the applicant** (received, changes requested, approved, declined). The decisions are
  recorded as events; delivering them is the next piece.
- **Contacting referees** is a manual step for the reviewer. Studdy does not email referees.
