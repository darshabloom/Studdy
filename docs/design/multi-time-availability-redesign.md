# Multi-time requests and real availability — approved design

**Status: APPROVED IN PRINCIPLE, 7 August 2026. Not implemented. PR #14 is untouched.**

Raised by the owner after manually reviewing the parent and tutor journeys: the request
composer asked a family to guess one exact lesson time with no sight of tutor availability,
and every Tutor Request immediately took a hard calendar hold.

**Revision 3, 7 August 2026.** Revision 2's eight decisions (§2) stand. Revision 3 adds the
owner's amendment to D-6 — availability is **not** gated behind shortlisting (§7) — an
explicit acceptance criterion that the tutor workspace be genuinely useful (§3.4), the
accepted scope of the closure-timing limit (§12), and the four conditions on the new tutor
action route (§9).

**Merge intent (owner, 7 August).** PR #14's useful foundation is to be merged after the
owner's manual review completes. The redesigned vertical slice then branches **cleanly from
main**, not stacked on PR #14.

---

## 1. What was wrong

**The family guessed.** The composer collected one date and one start time with no sight of
any tutor's real availability. A request naming a time nobody could do was dead on arrival,
and nobody found out until every tutor declined or the deadline passed.

**Holds were taken too early, and could not survive multiple times.** Each Tutor Request
created an exclusive reservation the moment it was sent. Offer five acceptable times to
three tutors under that rule and it would hold fifteen tutor-hours for a lesson consuming
one — while tutors were still deciding and other families were locked out of every one.

---

## 2. Approved decisions

These supersede the open questions in revision 1. Each becomes a numbered product decision
when the implementation slice opens.

### D-1 — Holds move to tutor acceptance

Sending a Tutor Request creates **no** calendar reservation. When a tutor accepts one
offered time, Studdy atomically revalidates that time and creates **one** temporary
reservation. If the time has become unavailable, acceptance fails cleanly and the tutor may
choose another still-valid offered option.

### D-2 — PD-010 amended

Creation remains atomic. The send-time precondition becomes: **every invited tutor has at
least one currently offerable time** among the family's selected options. Tutors need not
share identical availability; each receives only their applicable subset.

### D-3 — A request carries several acceptable times

The family is not selecting one universal proposed lesson time.

### D-4 — One acceptance per Tutor Request

In this release a tutor accepts exactly **one** still-available offered time, or declines.
Multiple acceptance holds for one Tutor Request are not created. Enforced by a partial
unique index, not by application logic.

### D-5 — Family selection is a tutor **and** time selection

Different tutors may accept different offered times. The family compares accepted
tutor/time combinations and chooses one.

### D-6 — Availability is part of discovery, not just the composer

Tutor discovery exposes meaningful current availability, and the composer is built on real
bookable time rather than a blind date picker.

**Amended in revision 3:** seeing real bookable availability is **not** gated behind
shortlisting. Availability exists to help a family decide whom to shortlist. Full access
model and its limits in §7 — those limits are a security matter.

### D-7 — Tutor availability management is in the slice

Implement the doc 07 model needed for recurring availability, exceptions and blocks,
minimum notice and bookable-time calculation, together with a genuinely useful tutor
availability and calendar experience.

### D-8 — PD-012 provisional launch values

**Tutor response window**, by how far ahead the lesson is:

| Lesson starts in | Tutor must respond within |
| ---------------- | ------------------------- |
| more than 48h    | 24h                       |
| 24–48h           | 12h                       |
| 6–24h            | 4h                        |
| under 6h         | 1h                        |

Minimum notice before a lesson: **2h**.

**Accepted-time family selection hold** — the reservation created on acceptance expires at
whichever comes first:

- **8 hours** from the moment of acceptance, or
- **2 hours before** that offered lesson time.

Both sets stay versioned and configurable in `platform.rule_settings`, and every calculated
deadline is snapshotted onto the record with the rule version that produced it, so a later
configuration change never moves a deadline someone has already been given.

The second limb matters: it means a hold can never outlive the point at which the lesson
becomes unbookable anyway, since minimum notice is also 2h. A hold that expired later would
be protecting a slot nobody could still book.

---

## 3. Revised end-to-end journeys

### 3.1 Parent / guardian

> **SUPERSEDED IN PRESENTATION, not in model.** The owner reviewed the working slice and
> directed a user-journey and interaction redesign before PR #17 may merge. The screen
> sequence in the table below is **shortlist-first, and that is no longer the normal path**.
>
> The normal journey is now: **Child → Subject → Tutor → Lesson length → Online/In person →
> Availability → Review → Send request**, entered from a tutor card or profile with the
> tutor and any known child/subject context prefilled. **Shortlisting is optional** — a
> saving and comparison feature, never a prerequisite for booking. The multi-tutor fan-out
> in this table survives intact as an optional "Ask shortlisted tutors" journey reached from
> the shortlist.
>
> Also changed: **1–5 acceptable times, not 2–5**; lesson length is chosen from the tutor's
> **published service durations**; and a `student_subject_section` is find-or-created **at
> send**, never as a side effect of browsing.
>
> Everything else in this document — the data model, the state machines, the acceptance and
> selection transactions, and the whole of §7's access model — **stands unchanged**. See
> `docs/handoffs/current-session.md` §6 for the authoritative redesign and its steps.

| #   | Screen                                   | What happens                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/sign-up` → `/verify` → `/welcome`      | Account, email verification, display and family name. Unchanged.                                                                                                                                                                                                                                                                                                       |
| 2   | `/parent`                                | Create or choose a dependent Student Profile. Unchanged.                                                                                                                                                                                                                                                                                                               |
| 3   | `/parent/subjects/new`                   | Create a Student Subject Section: subject and year level. Unchanged.                                                                                                                                                                                                                                                                                                   |
| 4   | `/tutors?section=…`                      | Discovery. Signed in with a subject context, the family sees **actual currently bookable slots for any eligible tutor** — no shortlisting required — alongside subject, year range, format and price. This is what lets availability inform **whom to shortlist**. **D-6, §7.**                                                                                        |
| 4a  | `/tutors/[reference]?section=…`          | A tutor's profile shows their own bookable slots for this subject context, at the section's service duration. Derived slots only; never rules, blocks, exceptions or reasons.                                                                                                                                                                                          |
| 5   | `/shortlist/[sectionId]`                 | Shortlist 1–3 tutors — for saving and comparing, having **already** seen their availability. Unchanged from PR #14.                                                                                                                                                                                                                                                    |
| 6   | **`/shortlist/[sectionId]/times`** — NEW | The combined availability grid for the shortlisted tutors at the section's service duration. Each bookable slot is labelled with how many of _their own_ shortlist can do it. The family picks **2–5** acceptable options.                                                                                                                                             |
| 7   | `/requests/new`                          | Review before sending: each invited tutor with **the subset of chosen times that tutor can actually do**, their own price, and the notes field. If a shortlisted tutor can do none of the chosen times, this screen says so **before** sending and offers to add a time that tutor can do or to send without them. **D-2.** No request is ever sent with zero options. |
| 8   | `/requests/[reference]`                  | Awaiting responses. Per tutor: status, their response deadline, and which times they were offered. Copy states plainly that nothing is held until a tutor accepts.                                                                                                                                                                                                     |
| 9   | `/requests/[reference]`                  | As tutors respond: each acceptance shows **that tutor and the specific time they accepted**, with the hold's expiry.                                                                                                                                                                                                                                                   |
| 10  | **`/requests/[reference]/select`** — NEW | Compare accepted tutor/time combinations and choose one. **D-5.**                                                                                                                                                                                                                                                                                                      |
| 11  | —                                        | Selection closes the others in one transaction, releases their reservations, promotes the winner's reservation. Payment is the next, separately gated slice.                                                                                                                                                                                                           |

### 3.2 Independent student

Identical screens with three differences, all pre-existing:

- Role selection at `/welcome` requires the **18-or-older** self-declaration (PD-001);
  under-18s are directed to the family path.
- Workspace is `/student`; there is no Family Account and `family_account_id` stays null,
  so the student carries payment authority themselves.
- No guardian visibility applies (PD-007).

Everything in §3.1 steps 4–11 is the same code and the same screens. This remains one
application, not two.

### 3.3 Tutor

| #   | Screen                                  | What happens                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/tutor`                                | Dashboard: upcoming confirmed time and accepted holds on a week view; requests awaiting a response with the soonest deadline; a **prompt to set availability if none exists**, because a tutor with no availability receives nothing and must not be left staring at an empty screen wondering why. |
| 2   | **`/tutor/availability`** — NEW         | Weekly recurring hours per service; one-off additions; blocked time with a private reason; minimum notice. **D-7.**                                                                                                                                                                                 |
| 3   | `/tutor/requests`                       | Own requests only. Each shows student year and subject, the family's notes, the tutor's own price, the response deadline, and **the times this tutor was offered**, each marked bookable or no longer available.                                                                                    |
| 4   | **`/tutor/requests/[reference]`** — NEW | Accept exactly one still-available time, or decline with an optional reason. **D-4.** See §9 for the route-authorisation requirement this creates.                                                                                                                                                  |
| 5   | After accepting                         | The claimed slot appears on the calendar as a temporary hold with its expiry (**D-8**), and the request states honestly that the family is now choosing, that this may or may not become a booking, and by when.                                                                                    |
| 6   | If a time is claimed elsewhere first    | Acceptance fails cleanly with "that time is no longer available" and the tutor may pick another still-valid option. **D-1.**                                                                                                                                                                        |

**What a tutor must never see**, unchanged from SP-006 and extended for this design: that
other tutors were contacted, how many, who, how they responded, whether one was selected,
why their own request closed, the ILR or its identifier, their slot position — and now also
**the size of the family's full option set** (only their own subset) and **any
distinguishing reason for a time becoming unavailable**.

### 3.4 Acceptance criterion — the tutor workspace must be genuinely useful

**Added by the owner, 7 August 2026 (revision 3). This is a gate on the slice, not a
description of it.** The slice is not complete when the tutor workspace is technically
capable; it is complete when a tutor can do their real job in it. The current dashboard is
sparse and unclear precisely because tutors cannot yet do anything, and shipping "capable
but still bewildering" would repeat that.

The slice does not close until **all** of the following are true in the tutor workspace:

| #   | Must be present                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Incoming requests requiring a response, visible without hunting                                                               |
| 2   | Each request's **offered viable times**                                                                                       |
| 3   | Accept one time / decline, as real working controls                                                                           |
| 4   | Accepted requests **currently holding a slot while the family decides**, distinguishable from those still awaiting a response |
| 5   | The **hold expiry**, shown plainly, never open-ended                                                                          |
| 6   | A current/upcoming lesson area, where applicable                                                                              |
| 7   | A clear **availability summary**                                                                                              |
| 8   | An obvious **Manage availability** journey from the dashboard                                                                 |
| 9   | Recurring availability, exceptions and blocked periods, through the approved doc 07 model                                     |

Each is verified by an end-to-end test against a seeded tutor with real request state, not
by inspection. Item 4 in particular is a state a tutor must be able to tell apart at a
glance: "waiting on me" and "waiting on them" are different jobs.

---

## 4. Data model — exact changes

### 4.1 New — `availability.availability_rules` (doc 07 §8.4)

| Column                                                   | Notes                                        |
| -------------------------------------------------------- | -------------------------------------------- |
| `tutor_profile_id`                                       | → `tutors.tutor_profiles`, restrict          |
| `service_id`, `subject_id`                               | nullable; null means the rule applies to all |
| `lesson_format_code`                                     | `online` \| `in_person` \| `any`             |
| `day_of_week`                                            | 0–6, checked                                 |
| `local_start_time`, `local_end_time`                     | `time`, checked end > start                  |
| `iana_time_zone`                                         | authoritative with the local time            |
| `effective_from`, `effective_until`                      | `date`, the latter nullable                  |
| `minimum_notice_minutes`, `maximum_advance_booking_days` | nullable overrides                           |
| `status_code`                                            | `active` \| `archived`                       |

Local weekday and local time are authoritative alongside the IANA zone — never a stored UTC
offset, so daylight saving cannot silently move a tutor's Tuesday evening.

### 4.2 New — `availability.availability_exceptions` (doc 07 §8.6)

`tutor_profile_id`, `starts_at`, `ends_at`, `effect_code` (`adds` | `removes`),
`reason_code` (nullable), `is_private` (default true), `status_code`.

Check `ends_at > starts_at`. GiST index on `(tutor_profile_id, tstzrange(starts_at, ends_at))`
for overlap queries — an index, not an exclusion constraint; exceptions may overlap.

Private reasons stay server-side. Any public surface shows only "unavailable" (§8.6).

### 4.3 New — `bookings.request_time_options`

The family's acceptable times. One row per option.

`intended_lesson_request_id`, `position`, `starts_at`, `ends_at`, `local_date`,
`local_start_time`, `iana_time_zone`, `status_code`.

- `unique (intended_lesson_request_id, position)`
- `check (ends_at > starts_at)`
- `check (position between 1 and 5)` — mirrors the shortlist-cap pattern so a sixth option
  is unrepresentable rather than merely rejected

**Server-only, family-side. No tutor projection ever reads this table** — it holds the full
set, and its size alone would tell a tutor how flexible the family is.

### 4.4 New — `bookings.tutor_request_time_options`

What one tutor was offered, and the row an acceptance claims.

`tutor_request_id`, `request_time_option_id`, `starts_at`, `ends_at` (**snapshotted, not
joined at read time**), `status_code`, `claimed_at`, `unavailable_detected_at`.

- `unique (tutor_request_id, request_time_option_id)`
- **`unique (tutor_request_id) where status_code = 'claimed'`** — at most one accepted time
  per Tutor Request, enforced by the database. This is **D-4** made unrepresentable rather
  than merely guarded.
- `check (ends_at > starts_at)`

Times are snapshotted because this is the record of what the tutor was offered. Later
availability changes must not rewrite history.

### 4.5 Changed — `bookings.intended_lesson_requests`

**Removed:** `proposed_start_at`, `proposed_end_at` — they move to `request_time_options`.

**Unchanged:** `reference`, `student_subject_section_id`, `requested_by_user_id`,
`family_account_id`, `status_code`, `close_reason_code`, `duration_minutes`, `format_code`,
`time_zone`, `notes_for_tutors`, `decision_deadline_at`, `deadline_rule_version`, `sent_at`,
`closed_at`, and both audit columns.

### 4.6 Changed — `bookings.tutor_requests`

**Added:**

| Column                       | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `accepted_time_option_id`    | → `tutor_request_time_options`, nullable, the claimed option      |
| `acceptance_hold_expires_at` | snapshot of `min(accepted_at + 8h, offered_start − 2h)` — **D-8** |
| `hold_rule_version`          | the rule version that produced it                                 |

**Nothing removed.** The random reference, `position`, `intended_lesson_request_id`,
`close_reason_code`, `decline_reason_code`, all seven statuses and both fan-out uniqueness
indexes stand exactly as built.

### 4.7 Unchanged — `availability.tutor_time_reservations`

The table and its GiST exclusion constraint are kept **exactly** as PR #14 built them. Only
the moment of creation changes — acceptance, not send — and `expires_at` now carries the
D-8 hold expiry. `reservation_type_code` already distinguishes `request_hold` from
`booking_confirmed`.

### 4.8 New rule settings (`platform.rule_settings`, versioned)

`requests.min_time_options` = 2, `requests.max_time_options` = 5,
`requests.acceptance_hold_hours` = 8,
`requests.acceptance_hold_cutoff_before_lesson_hours` = 2.

Existing response tiers and `requests.minimum_notice_hours` = 2 keep their current values
per **D-8**.

### 4.9 New close reason

`selection_window_lapsed` — the family did not choose before the acceptance hold expired.
Server-only, like every other close reason, and never rendered to a tutor.

---

## 5. State machines

### Intended Lesson Request — 6 states

`draft`, `awaiting_responses`, `ready_for_selection`, `awaiting_payment`, `fulfilled`,
`closed`.

**Amended by the owner during checkpoint 5.** Revisions up to this point had selection move
the ILR straight to `fulfilled`. That was wrong: `fulfilled` is terminal and means the
request **resulted in a confirmed booking**, which is also what the interface says — it
renders as "Booked". Landing there at selection would have claimed a booking for a lesson
nobody had paid for, and would have left a payment failure needing a transition _backwards_
out of a terminal state.

Selection therefore lands on **`awaiting_payment`**, and the payment slice moves
`awaiting_payment → fulfilled` on confirmation, or `awaiting_payment → closed` with the
existing reason `payment_window_lapsed` when it does not. Payment failure now has a forward
path.

`awaiting_responses → fulfilled` is removed with it: every route to a confirmed booking runs
through selection and then payment, so nothing can reach "Booked" without both having
happened.

| From                | To                          | Trigger                                  |
| ------------------- | --------------------------- | ---------------------------------------- |
| draft               | awaiting_responses, closed  | requester sends / abandons               |
| awaiting_responses  | ready_for_selection, closed | a tutor accepts / withdrawal or expiry   |
| ready_for_selection | awaiting_payment, closed    | selection completes / withdrawal, lapse  |
| awaiting_payment    | fulfilled, closed           | payment confirms / payment window lapses |
| fulfilled           | —                           | terminal: a confirmed booking            |
| closed              | —                           | terminal                                 |

`awaiting_payment` is deliberately **not** an "open" status for the response and selection
expiry sweep: by then the decision has been made, and the payment window is a different
clock owned by the payment slice.

### Tutor Request — unchanged, 7 states

`sent`, `accepted`, `selected`, `declined`, `expired`, `acceptance_withdrawn`, `closed`.

**The approved seven survive intact**, including every family-side and system-side ending
collapsing into `closed` with the real reason server-only. One new transition path:
`accepted → closed` when the acceptance hold lapses, reason `selection_window_lapsed`.

### Request Time Option — 4 states

`offered` → `taken` (a tutor claimed it) | `lapsed` (start time passed) | `withdrawn`.

### Tutor Request Time Option — 4 states

`offered` → `claimed` | `unavailable` (this tutor's own calendar filled) | `lapsed`.

`unavailable` is safe to show: it is the tutor's own calendar and carries no inference about
anyone else.

### Time Reservation — unchanged, 2 states

`active`, `released`.

---

## 6. The acceptance transaction

Every step status-guarded, so a concurrent duplicate cannot double-apply.

```
-- 1. Claim exactly one offered option
UPDATE bookings.tutor_request_time_options
   SET status_code = 'claimed', claimed_at = now()
 WHERE id = $option AND tutor_request_id = $req AND status_code = 'offered'
   -- 0 rows ⇒ already claimed, lapsed or withdrawn ⇒ abort

-- 2. Move the request, only from 'sent'
UPDATE bookings.tutor_requests
   SET status_code = 'accepted', accepted_time_option_id = $option,
       acceptance_hold_expires_at = LEAST($accepted_at + interval '8 hours',
                                          $offered_start - interval '2 hours'),
       hold_rule_version = $version
 WHERE id = $req AND status_code = 'sent'
   -- 0 rows ⇒ not ours to accept ⇒ abort

-- 3. Revalidate against live availability, then take the ONE reservation.
--    The GiST exclusion constraint is the final arbiter: 23P01 ⇒ roll back whole.
INSERT INTO availability.tutor_time_reservations
  (tutor_profile_id, tutor_request_id, start_at, end_at, expires_at,
   reservation_type_code, status_code)
VALUES ($tutor, $req, $start, $end, $holdExpiry, 'request_hold', 'active')

-- 4. Family-side bookkeeping
UPDATE bookings.request_time_options SET status_code = 'taken' WHERE id = $familyOption
UPDATE bookings.intended_lesson_requests
   SET status_code = 'ready_for_selection'
 WHERE id = $ilr AND status_code = 'awaiting_responses'

-- 5. Audit event, status transition, domain event, outbox entry
```

**Failure is clean, never partial.** A `23P01` from the exclusion constraint rolls the whole
transaction back — no claimed option, no status change, no reservation — and the tutor is
told the time is no longer available and may choose another still-valid option (**D-1**).

The partial unique index of §4.4 makes "two accepted times for one Tutor Request"
unrepresentable even if step 1's guard were wrong.

---

## 7. Availability access model

**Amended by the owner, 7 August 2026 (revision 3).** Revision 2 gated real bookable slots
behind shortlisting. That was wrong: **availability should help a family decide whom to
shortlist, not become visible only after they already have.** Shortlisting is for saving and
comparing tutors — it is not a prerequisite for seeing availability.

| Audience                                                                | Sees                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Signed-out visitor                                                      | Coarse derived availability only — next available day or daypart, or a general indicator ("available this week", "limited"). |
| Signed-in parent or independent student, with a student/subject context | **Actual currently bookable slots, for any eligible tutor.** No shortlist prerequisite.                                      |

### What is never exposed, to anyone outside the tutor's own workspace

- Raw `availability_rules` rows
- Blocked time and availability exceptions
- Any personal calendar data
- **Any reason for unavailability**

Families see only the **derived bookable slots Studdy is willing to offer**. Nothing else.

This last point carries the real protection. Because only positive bookable slots are
returned and never the reason for a gap, a gap is **indistinguishable** between "already
booked", "blocked for a private reason", "on holiday", "held by another family's accepted
request" and "outside this tutor's working hours". A family learns when they may book, never
anything about the tutor's life. That indistinguishability is a design requirement, not a
side effect, and the security review must test it.

### Consequence to be reviewed, stated plainly

Any signed-in family account with a student/subject context can now query bookable slots for
**any** eligible tutor, not merely tutors they have committed to. That is a deliberately
wider surface than revision 2 proposed, and it is the owner's decision.

Two things keep it proportionate: the response is derived and positive-only, per above; and
it is scoped to a real student/subject context rather than being an open calendar endpoint.
The focused security review should confirm both, and consider whether rate limiting is
warranted to prevent bulk harvesting of tutors' bookable time across the platform.

This still changes `public.public_tutor_search` for the signed-out signal, and SP-002 states
that **every edit to that view is a public-exposure change and must be reviewed as one**.

---

## 8. Expiry, extended

The existing command stays idempotent, batched and scheduler-independent. It gains three
responsibilities:

1. Lapse `request_time_options` and `tutor_request_time_options` whose start time has passed.
2. Close `accepted` Tutor Requests whose `acceptance_hold_expires_at` has passed, reason
   `selection_window_lapsed`, releasing their reservations.
3. Release reservations for accepted-but-unselected requests when their ILR closes.

A request may now become unanswerable before its deadline because all its options lapsed.
The sweep marks the options `lapsed`; the request still expires on **its own** deadline, so
its terminal timing stays driven by the tutor's own clock rather than by anyone else's
activity.

---

## 9. Security work this creates

Three items need review before their migrations are finalised. Two are new surfaces; one is
a property PR #14 currently has and this design removes.

**A public-exposure review of the discovery view (§7).** Governed by SP-002.

**A privacy review of the per-tutor option subset.** New surface on the SP-006 boundary. The
subset must never reveal the family's full set size, and "no longer available" must read
identically whatever the cause — another family, another tutor, or the tutor's own calendar.

**An access review of the wider family-facing availability surface (§7).** Revision 3 lets
any signed-in family with a subject context query bookable slots for any eligible tutor. The
review must confirm the response is derived and positive-only, that gaps carry no reason,
that the query is scoped to a real student/subject context, and whether rate limiting is
warranted against bulk harvesting.

**Route authorisation for `/tutor/requests/[reference]`.** SP-007 explicitly recorded "no
HTTP-status oracle (there is no tutor-side `[reference]` route)" as a confirmed-safe
property. **This design adds that route and therefore removes that property.**

**Accepted in principle by the owner, 7 August 2026, conditional on the focused security
review verifying all four of:**

1. Tutor identity comes **only** from the authenticated session — never from a URL
   parameter, form field or header.
2. The `TREQ-` reference is random (SP-009), not sequential or derivable.
3. Ownership is part of the **authoritative query**, not a separate check after loading —
   `findRequestForTutor(reference, tutorProfileId-from-session)`.
4. **Identical external behaviour** for a nonexistent reference and a valid-but-not-owned
   one: same status code, same body, same headers, same timing characteristics.

Condition 4 is the one that carries the property SP-007 previously got for free, and it must
be proven by test rather than asserted. Non-enumerability is a second line of defence, not a
substitute for it.

---

## 10. What PR #14 keeps

Unchanged from revision 1, and worth restating because it is most of the branch. The
redesign changes _when_ a hold is taken and _how many times_ a request carries. It does not
touch the privacy architecture, the transactional discipline, or the constraint that makes
either safe.

**Kept:** `tutor_time_reservations` and its GiST exclusion constraint — leaned on harder than
before; all seven Tutor Request statuses; server-only `close_reason_code`; SP-005, SP-006,
SP-008, SP-009, SP-010 in full; PD-009, PD-012, PD-018; `expireOverdueRequests`; deadline and
rule-settings code; both audience projections; the `/requests`, `/requests/[reference]` and
`/tutor/requests` routes; every privacy and isolation assertion in the test suite.

**Changed:** the ILR's single proposed time moves to `request_time_options`; hold creation
moves to the accept command; the composer is rebuilt on real availability; the tutor view
gains accept and decline.

**Lost:** the single date/time form, and the assumption inside `createIntendedLessonRequest`
that sending takes holds. The concurrent single-slot race integration test moves from
asserting the race at _send_ to asserting it at _acceptance_ — the same guarantee, at the
moment it now applies.

Because the slice branches cleanly from main after PR #14 merges, these are ordinary forward
migrations against merged schema, not edits to applied files.

---

## 11. The slice

**`feat/availability-and-multi-time-requests`**, branched from main after PR #14 merges.

Tutor availability management → family sees real availability → multi-time request →
per-tutor offered subsets → tutor accept/decline → hold at acceptance → family response view
→ tutor selection → close-out. Stripe and payment remain a separately gated financial slice
afterwards.

Five ordered checkpoints inside one PR, each green before the next begins:

1. Availability rules, exceptions, the bookable-slots query, and `/tutor/availability`.
2. Discovery availability signals (§7) and the combined availability grid.
3. Multi-time options: schema, composer, per-tutor subsets at fan-out.
4. Accept and decline: the acceptance transaction and hold-at-acceptance.
5. Family response view, selection close-out, tutor dashboard, empty and error states,
   accessibility pass.

Fable security reviews before the migrations for checkpoints 2, 3 and 4 are finalised, per
§9.

---

## 12. Risks and residual inference channels

**An offered time can vanish before acceptance.** Accepted deliberately under D-1, in
exchange for not blocking calendars on speculation. Mitigated at render, at accept, and by
the constraint. Worst case is a clean refusal, never a double booking.

**Closure timing is a residual channel. ACCEPTED as a documented limit by the owner,
7 August 2026.** A loser closes when selection happens; if nobody selects, it closes when the
hold lapses. A tutor watching the clock can therefore infer _that_ the family took some
action, though never who was chosen, how many others existed, how they responded, or the
outcome.

**The privacy guarantee is scoped accordingly, and this scoping is the approved position:**

> Tutors cannot learn competitor **identities, count, responses or selection outcome**. The
> guarantee is **not** that a tutor can never infer that the family took some action.

**Explicit design constraint that follows.** A tutor's calendar hold must **never** be
retained beyond its natural expiry in order to disguise the timing of a family decision.
Concealment by delay would cost the tutor real, bookable calendar time — a concrete harm — to
obscure an inference that is outside the guarantee anyway. Release holds as soon as they are
genuinely finished with. If a future change appears to argue for holding longer "for
privacy", that is this constraint being violated, not an exception to it.

This channel predates the redesign; D-8 merely makes it easier to notice, because the hold
expiry is now shown to the tutor.

**Availability is only as good as what tutors enter.** A tutor who sets none receives
nothing. This is why availability management is checkpoint 1 and why the dashboard prompts
for it rather than appearing empty and broken.

**Derived availability queries could get slow** across three tutors, a date window and active
reservations. Deriving on read is right for now; doc 07 §8.6's occurrence projection is the
escape hatch. Measure before building it.

**Capacity rules (§8.9) are modelled but not enforced** in this slice. A tutor could be
offered more requests than their capacity allows. Declared as a known gap, not left to be
discovered.

**The slice is the largest so far.** Mitigated by the five checkpoints and by building on a
privacy architecture that is already reviewed and tested.
