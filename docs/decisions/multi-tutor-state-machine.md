# Multi-tutor state machine — approved design

**Status.** Approved 7 August 2026, with the amendments recorded below. Implemented in
`feat/intended-lesson-request` for the request half; response, selection and payment
transitions are specified here but not yet built.

**Overrides.** Doc 09 contains **no** Intended Lesson Request or Tutor Request state
machine. Doc 09 §48 and doc 10 §55 give different, incompatible Booking status lists. This
document supplies the missing machines and resolves that conflict by separating request
state from booking state.

The full design document (entities, transitions, commands, invariants, race conditions,
failure handling, permission boundaries, transaction boundaries) is the working reference;
this file records the **approved** vocabulary and the decisions that amended it.

---

## The model

```
Intended Lesson Request (LR-)          one per tutoring need, NEVER seen by a tutor
  ├── Tutor Request A (TREQ-)          independent status, deadline and hold
  ├── Tutor Request B (TREQ-)
  └── Tutor Request C (TREQ-)
        └── Time Reservation           the calendar hold, released on any ending
```

One ILR fans out to at most three Tutor Requests (`platform.rule_settings`
`requests.fan_out_cap`, admin-configurable). Each tutor sees only their own request,
responds independently, and holds the slot independently. The first tutor to accept does
not automatically win.

## Intended Lesson Request — 5 states

`draft`, `awaiting_responses`, `ready_for_selection`, `fulfilled`, `closed`

| From                | To                                     | Trigger                                                   |
| ------------------- | -------------------------------------- | --------------------------------------------------------- |
| draft               | awaiting_responses, closed             | requester sends / abandons                                |
| awaiting_responses  | ready_for_selection, fulfilled, closed | a tutor accepts / booking confirms / withdrawal or expiry |
| ready_for_selection | fulfilled, closed                      | selection completes / withdrawal or expiry                |
| fulfilled           | —                                      | terminal                                                  |
| closed              | —                                      | terminal                                                  |

## Tutor Request — 7 states (APPROVED, final)

`sent`, `accepted`, `selected`, `declined`, `expired`, `acceptance_withdrawn`, `closed`

**The privacy boundary is expressed in this enum, not only in the labels.**

Every family-side and system-side ending collapses into the single status **`closed`** —
the family withdrew this request, the family withdrew the whole request, a competitor was
selected, the request expired after another tutor accepted, or the winner's payment window
lapsed. The real reason lives in the server-only `close_reason_code`, which the tutor
projection never selects.

If "withdrawn by family" and "not selected" were distinct statuses, the status alone would
tell a tutor a competitor existed.

Tutor-driven terminals stay distinct because the tutor already knows them: `declined` and
`acceptance_withdrawn` are their own acts, `expired` is their own inaction.

| From                                            | To                                              | Trigger                                                                            |
| ----------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| sent                                            | accepted, declined, expired, closed             | tutor responds / deadline passes / family or system ends it                        |
| accepted                                        | selected, acceptance_withdrawn, expired, closed | requester chooses / tutor withdraws / payment window lapses / another tutor chosen |
| selected                                        | closed                                          | payment fails or window lapses — never reopens                                     |
| declined, expired, acceptance_withdrawn, closed | —                                               | terminal                                                                           |

**Amendment (7 August 2026).** An earlier implementation used `withdrawn` and
`superseded`, which made family withdrawal a distinguishable status. That was a deviation
from this approved set and has been corrected. A unit test now asserts the enum has
exactly seven values and contains neither, so a differentiating status cannot return
unnoticed.

## Time Reservation — 2 states

`active`, `released`. Overlapping **active** reservations for one tutor are made
unrepresentable by a GiST exclusion constraint (doc 07 §9.6):

```sql
exclude using gist (
  tutor_profile_id with =,
  tstzrange(start_at, end_at, '[)') with &&
) where (status_code = 'active')
```

This is what makes fan-out atomic against concurrent requests: two families racing for one
slot cannot both succeed, and the loser receives a plain "no longer available" outcome.

## Booking — 4 states in this package

`pending_payment`, `confirmed`, `cancelled`, `completed`. Not yet implemented.

## Close reasons (server-only)

`requester_withdrew`, `request_expired`, `all_tutors_declined`, `another_tutor_selected`,
`payment_window_lapsed`.

Recorded for the family and for audit. **Never** rendered to a tutor.

## Enforcement approach

**No status-transition trigger.** Every command guards its own transition with a
status-named `UPDATE ... WHERE status_code IN (...)`, which enforces the rule at the point
of change. Integration tests are the authoritative protection.

**Approved 7 August 2026.** Reconsider only if multiple write paths, direct administrative
updates or testing reveal a genuine bypass risk — not for belt-and-braces duplication.

## What is implemented, and what is not

**Implemented** (`feat/intended-lesson-request`): ILR creation, all-or-nothing fan-out,
holds, family withdrawal (single tutor and whole request), idempotent batched expiry with
hold release, the family and tutor projections.

**Specified but not implemented:** tutor accept and decline; selection close-out; Booking
creation; payment; `selected` and `acceptance_withdrawn` transitions.

## Guard rails for the next slices

1. **Selection close-out** must set losers to a status inside the tutor-visible set that
   maps to the neutral label, emit `tutor_request.closed` (never a differentiating event
   type), and close all losers in one transaction so timing cannot differentiate. An
   integration test already asserts that a closed request is indistinguishable in shape and
   visibility from a withdrawn one.
2. **Notifications** must use a dedicated tutor-safe projection. The outbox payload is
   clean, but a dispatcher joining `tutorRequestId` back to the raw row would reach
   `intended_lesson_request_id` and `close_reason_code`.
3. **Accept/decline** must reuse `findRequestForTutor(reference, tutorProfileId-from-session)`
   and return identical responses for "not yours" and "does not exist".
