# Approved product decisions

Product decisions approved during implementation. Each entry records the decision, its
status, what it overrides or clarifies in the source material, when it was approved, and
what it means for the code.

These **override** the planning pack where stated. The source documents in
`docs/source-material/` are never edited to match — read them together with this file.

---

## PD-001 — Independent student eligibility: 18 or older

**Decision.** A fully independent student account, holding its own payment authority,
requires the holder to be **18 or older**, self-declared at account setup. Students under
18 use a Family Account with a parent or guardian. Older dependent students booking with
guardian permission may be supported later but are not treated as financially independent.

**Status.** Approved 6 August 2026 (identity slice). **Launch product rule, explicitly not
a legal conclusion — must be reviewed before production.**

**Overrides / clarifies.** No source document defines independent-student age,
eligibility or consent rules. This fills a documented gap rather than overriding anything.

**Consequence.** `/welcome` requires the declaration on the independent path and directs
under-18s to the family path. Recorded on the role assignment as
`assignment_reason_code = 'self_declared_18_plus'`. Tracked for legal review in
`documentation/product/independent-student-eligibility.md`.

---

## PD-002 — Multi-factor authentication scope

**Decision.** TOTP MFA is implemented now and enforced **only** for `platform_manager`
and `platform_owner`. Not mandatory for parents, students or tutors at this stage; the
mechanism is role-agnostic so extending it later is configuration, not rework.

**Status.** Approved 6 August 2026 (identity slice). Implemented.

**Overrides / clarifies.** Clarifies doc 06 §4.3, which requires MFA for Platform Owner
and privileged managers from launch but does not scope other roles.

**Consequence.** `aal2` gate in the workspace chrome for manager and owner workspaces.

---

## PD-003 — Names collected at onboarding

**Decision.** Sign-up collects email and password only. `/welcome` collects **preferred
or display name and family name**. A legal name is requested only where genuinely
required — identity verification, contracts, Stripe onboarding or another regulated
process.

**Status.** Approved 6 August 2026 (identity slice). Implemented.

**Overrides / clarifies.** Clarifies doc 10 §15, which lists legal name as a User field
without saying when it is collected.

**Consequence.** `identity.users.legal_name` stays nullable and unused; `family_name` was
added.

---

## PD-004 — Password policy

**Decision.** Minimum 10 characters. Long passphrases and password-manager output are
welcome. No uppercase, number or symbol composition rules unless Supabase requires them.

**Status.** Approved 6 August 2026 (identity slice). Implemented.

**Overrides / clarifies.** No source document specifies a password policy.

---

## PD-005 — First workspace for multi-role users

**Decision.** No silent priority order. One active workspace → enter it. Several with a
saved preference → restore it. Several with no preference → show a **chooser**, then save
the choice.

**Status.** Approved 6 August 2026 (identity slice). Implemented.

**Overrides / clarifies.** Fills a gap: doc 02 §2 requires returning to the last-used
workspace but does not say what happens on first login with several.

**Consequence.** `/workspace` router plus `/workspace/choose`. Preference persists in
`identity.user_preferences`, written **only** by explicit user action — never during
render, because link prefetching would otherwise overwrite it silently.

---

## PD-006 — Tutor self-registration creates a pending application only

**Decision.** Choosing "I want to tutor" records a **pending** tutor role assignment
(`workspace_enabled = false`). It grants no tutor workspace and no access to student
information. Manager and Owner accounts are **invitation, seed or authorised assignment
only** and can never be self-registered.

**Status.** Approved 6 August 2026 (identity slice). Implemented and tested.

**Overrides / clarifies.** Clarifies doc 12 §19's tutor status enum by fixing what
self-registration may produce.

---

## PD-007 — Guardian access is limited to dependent students

**Decision.** Guardians automatically access **dependent** students only. An independent
student does not retain automatic guardian access through a family link. Explicit
supporter access may be added later.

**Status.** Approved 6 August 2026, confirmed 7 August 2026 (discovery slice). Implemented.

**Overrides / clarifies.** Clarifies doc 03 and doc 08 family-scope rules, which do not
address an independent student who keeps a family link.

**Consequence.** `students.current_user_student_profile_ids()` gates the family branch on
`independence_status_code = 'dependent'`. Raised by the Fable family-scope review as a
product question and closed conservatively.

---

## PD-008 — Saved shortlist, not a sent request

**Decision.** Discovery ends in a **saved shortlist** attached to a Student Subject
Section: one table, no header record, no state machine. The cap of three deliberately
matches the approved Tutor Request fan-out limit. Generic "favourite tutors" is a
different, later concept and is not built.

**Status.** Approved 6 August 2026 (discovery slice). Implemented.

**Overrides / clarifies.** Doc 14 §15 mentions favourites; this decision separates
favourites from a subject-scoped shortlist.

**Consequence.** `students.subject_section_shortlist_entries`, capped by
`CHECK (position between 1 and 3)` plus a partial unique index, so a fourth active entry
is unrepresentable and concurrent adds cannot both win.

---

## PD-009 — Shortlist survives request creation

**Decision.** Creating an Intended Lesson Request leaves the shortlist unchanged. It is a
saved list, not a cart.

**Status.** Approved 7 August 2026 (ILR slice). Implemented.

---

## PD-010 — Fan-out is all-or-nothing

**Decision.** If any selected tutor cannot receive a hold, the whole command fails
atomically with a clear per-tutor availability error. No silent partial fan-out.

**Status.** Approved 7 August 2026 (ILR slice). Implemented and tested.

**Consequence.** The GiST exclusion constraint raises `23P01`, the transaction rolls back
entirely, and the free tutors receive nothing. Proven by integration test.

---

## PD-011 — What happens when a request ends without a booking

**Decision.**

- **All tutors decline or expire** → expire the ILR, **preserve the shortlist**, return
  the user to discovery. No automatic re-send to more tutors.
- **Selected tutor withdraws, or the payment window lapses** → terminate the ILR and offer
  a pre-filled "Request again" journey creating a **fresh** ILR. Closed Tutor Requests are
  **never** reopened.

**Status.** Approved 7 August 2026 (ILR slice). Expiry implemented; "Request again" and
the payment window arrive with later slices.

**Overrides / clarifies.** Doc 11 §8 implies Studdy suggests alternative tutors after a
request ends; auto-sending would be a new business rule and is explicitly not adopted.

---

## PD-012 — Deadlines and holds are provisional, versioned and snapshotted

**Decision.** Deadline and hold values are seeded as **provisional versioned
configuration**. Every calculated deadline is **snapshotted onto the affected record**
with the rule version that produced it, so a later configuration change never moves a
deadline someone has already been given.

**Status.** Approved 7 August 2026 (ILR slice). Implemented. **The numbers themselves
still await confirmation.**

**Overrides / clarifies.** Doc 11 §13 offers only "a potential model"; doc 04 §23–27
gives "suggested" payment windows. Seeded values carry a provenance note saying so.

**Current provisional values** (`platform.rule_settings`): fan-out cap 3; response tiers

> 48h→24h, 24–48h→12h, 6–24h→4h, <6h→1h; decision grace 24h; minimum notice 2h.

---

## PD-013 — Propose another time is deferred

**Decision.** Tutors get accept and decline. "Propose another time" is deferred to its own
slice — it needs counter-offer state, second holds and parent counter-acceptance.

**Status.** Approved 7 August 2026 (ILR slice). Deferred.

**Overrides / clarifies.** Doc 04 §21 lists it as an allowed tutor response without
specifying mechanics.

---

## PD-014 — Card-on-file policy

**Decision.** A valid payment method is **required before Tutor Requests are sent**, but
is **not charged and not authorised** at that stage. Copy must state plainly that payment
happens only after selecting an accepted tutor. Configurable exemptions are preserved for
free trials, organisation funding and approved alternative arrangements.

**Status.** Approved 7 August 2026. Rule implemented behind versioned configuration and
**deliberately disabled** until the Stripe slice provides a real way to add and verify a
payment method — enabling it sooner would block every request with no way to satisfy it.
Both branches are tested.

**Overrides / clarifies.** Implements doc 04 §22.

**Consequence.** In-product copy says only what is true: _"You will not be charged when
requests are sent. Payment setup and confirmation happen after you choose an accepted
tutor."_ It must **never** say "your card will not be charged" while no payment method
exists. An e2e assertion enforces this.

---

## PD-015 — Dependent student visibility of bookings

**Decision.** Dependent students may see a booking's existence, tutor, date, time and
ordinary lesson status — but **not** price, payment method, refunds, commission or other
family financial information.

**Status.** Approved 7 August 2026 (ILR slice). To be implemented with the booking slice.

**Overrides / clarifies.** Clarifies doc 03's rule that dependents do not access family
finances.

---

## PD-016 — Payment retries

**Decision.** Payment retries and changing payment method are permitted until
`payment_due_at`. The deadline never extends automatically.

**Status.** Approved 7 August 2026. Payment slice.

---

## PD-017 — Request-versus-booking split and state machines

**Decision.** Request state is separated from booking state. The approved machines are
Intended Lesson Request (5 states), Tutor Request (7), Time Reservation (2), Booking (4).

**Status.** Approved 7 August 2026. See
[multi-tutor-state-machine.md](multi-tutor-state-machine.md) for the full specification.

**Overrides / clarifies.** Resolves the documented conflict between doc 09 §48 and
doc 10 §55, which give different and incompatible Booking status lists. Doc 09 contains
**no** ILR or Tutor Request machine at all.

---

## PD-018 — Reference prefixes

**Decision.** `LR-` for Intended Lesson Requests, `TREQ-` for Tutor Requests, `BOOK-`
retained for Bookings. The earlier proposal of `REQUEST-`/`REQ-` was rejected as
confusable.

**Status.** Approved 7 August 2026 (ILR slice). Implemented.

**Overrides / clarifies.** Extends doc 07 §3's prefix list, which contains no request
prefix.

---

## PD-019 — Families choose start times on a fifteen-minute grid

**Approved 2026-08-24.** Family-selectable lesson starts sit on quarter hours: 4:00, 4:15,
4:30, 4:45. Quarter past and quarter to are times people say out loud, and a school day does
not divide neatly into halves — a lesson after a 3:45 pick-up is a real lesson that a
half-hour grid cannot express.

**Server-authoritative.** `SLOT_STEP_MINUTES` lives in the domain and governs derivation;
the booking calendar imports it so the drawn options cannot drift from what is bookable.
This is not UI filtering over a coarser truth.

The send path deliberately derives with `stepMinutes: 1`. That asks "is this exact interval
inside the tutor's open time", which is a different question from "does it sit on the grid a
family was shown".

---

## PD-020 — Every tutor has a minimum gap between lessons, default fifteen minutes

**Approved 2026-08-24.** `tutors.tutor_profiles.minimum_gap_minutes` is the least time that
must pass between one lesson ending and the next beginning: preparing, resetting, or
travelling. The tutor sets it from `/tutor/availability`.

**One tutor-level figure. NOT split by online and in person.** A per-format travel buffer is
a separate, larger concept (Database spec §8.8); inventing half of one now would be worse
than one honest number.

**Enforced in the database, not only in derivation.** Each reservation snapshots the gap in
force when it was taken and stores `effective_end_at = end_at + gap_minutes`; the GiST
exclusion constraint compares that interval. `tstzrange(start_at, end_at)` catches only true
overlap — 5:00–6:00 and 6:05–7:05 do not overlap and would both be accepted however long the
tutor needed between them.

**The snapshot is the point.** A tutor who widens their gap tomorrow must not retroactively
invalidate a hold a family already has, nor move the line under a lesson already agreed. The
live value governs only what may be taken next. This follows PD-012's discipline for
deadlines and holds.

**Real `start_at` and `end_at` are never padded.** The tutor's calendar, the request records
and the family's confirmation all read them.

**Blocked availability periods are not widened.** A holiday is time off, not a lesson needing
turnaround; widening it would quietly cost bookable time either side of every break.

---

## Still open — decisions this project needs

| Question                                                            | Why it matters                                                                      | Current state                                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Confirmed deadline and hold numbers                                 | Provisional values are seeded and snapshotted; real numbers change tutor experience | PD-012 provisional                                                 |
| Default currency NZD                                                | Appears only as an example in the source                                            | Assumed NZD, not confirmed                                         |
| Whether a tutor may know the platform allows multi-tutor requests   | Platform-level honesty vs per-request silence                                       | Recommendation: honest at platform level, zero per-request signals |
| Matching preference fields (tutor age, gender, cultural background) | Doc 14 §9 proposes them; NZ Human Rights Act 1993 exposure unassessed               | Held out of schema pending legal check                             |
| Email provider                                                      | Required before any provider-specific email code                                    | Comparison document not yet produced                               |
| Retention periods for the eleven categories in doc 06 §18           | Required before production                                                          | Not specified anywhere                                             |
