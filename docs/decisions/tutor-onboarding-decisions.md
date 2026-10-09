# Tutor onboarding — decisions

Recorded 10 October 2026 with the tutor application slice (`feat/tutor-applications`); TO-009
onward added the same day with tutor setup (`feat/tutor-onboarding-setup`).

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

## TO-009 — Every service is reviewed before it can be published

Doc 04 §15 requires Studdy to review every new tutor service before publication, and doc 09
§45-47 gives the workflow. Built from it: draft, pending approval, changes requested, approved,
published, unpublished, archived. Scheduled publication, restriction and suspension are in the
approved workflow and are **not built**, because nothing here could drive them.

**Approval does not publish.** The reviewer approves; the tutor publishes, when they choose. Going
on sale is always the tutor's own act, and coming off sale is too.

The review outcomes built are **approve** and **request changes**. Doc 04 also lists "approve with
conditions" and "reject". Neither is built: the approved status list has no rejected state for a
service, a service that should not exist is handled by requesting changes (the tutor can remove
it), and conditions have nothing to attach to yet. **Needs the owner** if an outright rejection is
wanted.

## TO-010 — A reviewed service is never edited in place

The database spec (§8.2) makes published and approved versions immutable. So a tutor changing a
reviewed service drafts a **replacement**, which is reviewed like any other service. The original
stays on sale, unchanged, until the tutor publishes the replacement; the same transaction retires
the original. A price change therefore never takes a tutor off sale while Studdy reviews it, and a
request or booking already made keeps the version, and the price, it was agreed on.

Consequence worth knowing: **every change to a reviewed service is reviewed, including a price
change.** That is what doc 04 §15 says ("review should cover ... price"). Doc 04 §16 (trusted
publishing for eligible tutors) is the approved way to relax it later and is not built.

## TO-011 — A tutor must be payable before a service can be published — **needs the owner**

The database spec says publishing validates payment rules, and a family who chooses a tutor Stripe
cannot pay is refused at the payment step, after the tutor has accepted and the family has chosen.
So publication is refused until Stripe reports the tutor's account can receive payments.

This is a versioned rule, `services.publication_requires_payout_readiness`, **on by default and
failing closed**: only a stored literal `false` relaxes it. The setup checklist lists payouts as
required either way, because a tutor who is visible but cannot be paid is not bookable.

The cost is real: in any environment, a new tutor appears in discovery only after completing
Stripe's hosted onboarding, which in the sandbox still needs a person to do once.

## TO-012 — What a tutor may change about their own profile, without review

Headline, teaching approach, year levels, formats and one of two availability labels ("accepting
new students", "limited availability"). These take effect immediately and are **not reviewed**;
every edit writes the old and new text to the audit trail. **Needs the owner:** whether public
profile text should pass through review as services do. Not changeable by the tutor: their name
(checked against a real person at approval), their status, their verification labels, and the
labels that change who may book ("existing students only", "waiting list").

A tutor cannot stop offering a format that one of their live services is taught in. They change
the service first, which is reviewed.

## TO-013 — A tutor can pause their own listing, and only undo their own pause

Pausing takes a tutor out of discovery and stops new requests; requests and bookings already made
are untouched. The visibility state they paused from is remembered, and resuming restores exactly
that. An unlisted profile with nothing remembered was unlisted by someone else, and the tutor
cannot relist themselves out of it. This is what lets a future moderation tool reduce or remove a
tutor's visibility without the tutor being able to reverse it.

## TO-014 — Review records are server-only, kept apart from the service

`services.services` is readable by signed-in browsers once a service is published. So who reviewed
a service, the message written for the tutor and the reviewer's own note live in
`services.service_reviews`, which no browser role can read. A tutor is shown the message written
for them while changes are requested, and never the staff note.

## TO-015 — Discovery describes the published service, and says which profiles are examples

The public view now reports the year range of a tutor's **published services** for a subject
(falling back to the profile's range where a service states none), so a tutor who publishes "Year
9 to 10 maths" is not advertised for their profile's whole range. It also exposes one boolean,
`is_example_profile`, so the "Example profile" label is shown on seeded profiles only and not on
real tutors. The earlier decision to withhold `source_type_code` stands; this is the single fact
the interface already printed on every seeded profile.

## TO-016 — An approved tutor is `approved`; a tutor with something on sale is `active`

Approval creates the profile as `approved`. Publishing a first service makes it `active`. Both may
enter the tutor workspace and both may be listed. (Before this slice the workspace accepted only
`active`, which locked every newly approved tutor out of their own setup.)

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
- **Service price bounds.** A lesson may be priced from $10 to $500 and sold in 30, 45, 60, 90 or
  120 minutes. The bounds guard against a slipped key; they are not a pricing policy, and the
  owner may want one.
- **A limit of 20 live services per tutor**, as a guard against runaway creation.
- **Unpublishing does not notify anyone.** Doc 09 has an "unpublishing" state for assessing the
  impact on active bookings. Today existing requests and bookings simply continue on their agreed
  terms, which needs no notification; if that ever changes, this is where it is decided.
