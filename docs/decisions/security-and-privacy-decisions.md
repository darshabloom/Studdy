# Security and privacy decisions

Security and privacy decisions approved during implementation, including the findings of
each focused Fable review and what was changed as a result.

---

## SP-001 — Identity separation

**Decision.** Supabase Auth owns credentials, sessions, email verification and factors —
nothing else. The permanent business identity is `identity.users`, linked through
`identity.auth_identity_links`. Business tables reference Studdy User IDs only, never
`auth.users`.

**Status.** Approved, implemented (bootstrap + identity slices).

**Source.** Doc 06 §4, brief §5. See ADR-0001.

---

## SP-002 — Public tutor exposure through one view

**Decision.** Anonymous visitors read exactly two objects: `public.public_tutor_search`
and `platform.subjects`. They hold **no grant on any tutor, service or student base
table**. The view is created without `security_invoker`, so its own `WHERE` clause is the
security boundary, and both `status_code` and `visibility_state_code` are allow-listed —
any state not named is hidden rather than leaked.

**Status.** Approved, implemented (discovery slice).

**Source.** Doc 07 §15.3, doc 14 §13.

**Consequence.** Every future edit to that view is a public-exposure change and must be
reviewed as one.

---

## SP-003 — Fable review, public exposure (discovery slice)

Focused review before the migrations were finalised. **No critical findings.** Four issues
fixed:

1. `source_type_code` was projected publicly, revealing which profiles are development
   seeds. **Removed.**
2. Price and currency came from two independent `min()` aggregates and could be mispaired,
   advertising an amount that exists in no service. **Both now taken from the same cheapest
   version.**
3. The `authenticated` grant on `tutor_profiles` was whole-row, exposing tutors' identity
   linkage (`user_id`) and seed provenance to any self-signed-up account. **Now
   column-level.**
4. Supabase's default ACLs auto-grant `anon` on **future** objects in `public`, so "anon
   reaches exactly one object" was only true that day. **Default privileges revoked**; stray
   TRUNCATE/REFERENCES/TRIGGER on the view stripped.

Confirmed safe: the security-definer view approach, fail-closed allow-lists, and helper
functions with pinned `search_path`.

---

## SP-004 — Fable review, family scope (discovery slice)

**No critical findings.** Two issues fixed:

1. A membership ended via `ended_at` without flipping `status_code`, or a **future-dated**
   membership, still granted access. Both closed, plus members of a suspended or archived
   family account.
2. Guardians could read an **independent** student's records where the profile retained a
   family link — see [PD-007](approved-product-decisions.md#pd-007--guardian-access-is-limited-to-dependent-students).

Also added: CHECK constraints on free-text status columns so a typo cannot silently change
public visibility, and indexes on the helper access paths.

Confirmed safe: cross-family isolation, NULL/unauthenticated handling (an unlinked or
absent JWT yields empty sets and matches zero rows), helper safety, and independently that
the shortlist cap is race-proof without a trigger.

---

## SP-005 — Request tables are server-only

**Decision.** `bookings.intended_lesson_requests`, `bookings.tutor_requests`,
`availability.tutor_time_reservations` and `platform.rule_settings` carry **no `anon` or
`authenticated` grants at all**, and those roles have no `usage` on the `bookings` or
`availability` schemas. RLS is enabled with **deliberately no policies**, which in
PostgreSQL is deny-all for non-owners — a fail-closed third layer.

**Status.** Approved, implemented (ILR slice).

**Why, and this is the important part.** Column-level grants are granted **per database
role**, and a parent and a tutor both authenticate as `authenticated`. A grant therefore
cannot show `intended_lesson_request_id` to a family while hiding it from a tutor — the
role receives the union of both audiences' needs. Relying on column grants to carry the
tutor-privacy boundary is unsound. Each audience is instead served by a **server-side
projection** with its own explicit column list.

**Consequence.** All reads go through `listRequestsForStudents` / `findRequestForStudents`
(family) or `listRequestsForTutor` / `findRequestForTutor` (tutor). Adding a browser-facing
read path to these tables would reopen the hole.

---

## SP-006 — The tutor-privacy boundary

**Decision.** A tutor may learn about their **own** request only. They must never
discover, directly or by inference: that the request went to other tutors, how many, who
they are, how any responded, whether a specific tutor was selected, why their own request
closed, the Intended Lesson Request or its identifier, or their slot position.

Internal server-only rows **may** retain the ILR foreign key for transactional integrity,
provided it never appears in tutor-facing queries, URLs, errors, logs, API responses or
anything reaching the browser.

**Status.** Approved 7 August 2026, implemented and tested.

**Enforced at four layers.**

1. **The enum** — every family/system ending is the single status `closed`
   ([state machine](multi-tutor-state-machine.md)).
2. **The projection** — `TutorRequestView` omits `intendedLessonRequestId`, `position` and
   `closeReasonCode`.
3. **Visibility** — every terminal state stays visible and renders identically. Hiding some
   endings while showing others is itself a channel: a tutor could tell "the family
   withdrew" (card vanished) from "it ended another way" (card still there).
4. **Notifications** — withdrawal and expiry emit the **same** outbox event type
   (`tutor_request.closed`) with only `{tutorRequestId}`, so even the event name does not
   differentiate.

---

## SP-007 — Fable review, tutor projection (ILR slice)

**No critical findings.** One latent leak and one integrity gap fixed:

1. **`TUTOR_VISIBLE_STATUSES` omitted terminal states.** A withdrawn request vanished from
   a tutor's list while an expired one remained visible. Harmless at the time, because no
   row could yet be `closed` — but the moment selection close-out lands, that difference
   reveals a competitor. **All terminal states are now visible and identically labelled**,
   with a guard-rail test asserting the shapes match.
2. **Service versions were browser-supplied**, so a crafted form could pin one tutor's
   request to another tutor's cheaper price. See SP-008.

Corrections also applied: the RLS migration comment claimed "intentional policies" when it
relies on policy-less RLS being deny-all; withdrawal recorded a hardcoded `from: sent` even
when withdrawing an accepted request.

Confirmed safe: no ILR id, position or close reason in any tutor-facing column; route
authorisation resolves the tutor from the session with no URL parameter to probe; no
HTTP-status oracle (there is no tutor-side `[reference]` route); hold expiry equals the
tutor's own `respond_by_at` and reveals nothing new; the family side is not over-restricted.

**Noted risk, accepted.** `notes_for_tutors` is family-authored free text shown to every
invited tutor. A family could disclose the fan-out in it. That is inherent to
family-authored content; the platform adds no leak.

---

## SP-008 — Pricing is resolved server-side

**Decision.** The browser submits **tutor ids only**. The priced service version is
resolved server-side from the Student Subject Section's subject. Browser-supplied pricing
or service-version identifiers are untrusted and are not accepted at all.

**Status.** Approved 7 August 2026, implemented and tested.

**Consequence.** Tampering is impossible rather than merely caught. A tutor who does not
offer the subject is refused; each Tutor Request provably carries its own tutor's version.

---

## SP-009 — Non-correlatable Tutor Request references

**Decision.** `TREQ-` references are **random**, not sequential: `TREQ-` plus ten
Crockford base32 characters (no I, L, O, U, so they can be read aloud), ~50 bits, with the
unique constraint catching collisions. Everything else keeps the global sequence.

**Status.** Approved 7 August 2026, implemented.

**Overrides.** Doc 07 §3 draws every human-readable reference from one global sequence.
This changes that for Tutor Requests only.

**Why.** Verified empirically: a fan-out wrote its ILR and Tutor Requests in one
transaction with nothing else consuming the sequence, so `LR-10000490` was followed by
`TREQ-10000491/492/493`. Two channels resulted — deriving the TREQs from the LR (and the
gap revealing fan-out size), and two tutors detecting co-invitation from adjacency alone.
The second does not depend on the LR staying private, so "never show a tutor an LR-
reference" was a policy, not a control.

**Residual note.** `LR-` references remain sequential and should stay family-and-staff
only. They are no longer correlatable with `TREQ-`.

---

## SP-010 — Scheduled job authentication

**Decision.** `POST /api/jobs/expire-requests` authenticates with a server-only shared
secret in the **`Authorization` header**, never a query string (query strings reach access
logs, browser history and referrer headers), compared with a timing-safe check. `GET` is
refused because expiry mutates state. Logs carry counts and timing only — never a
reference, tutor, student or family.

**Status.** Approved 7 August 2026, implemented and tested.

**Environment variable required (name only).** `CRON_SECRET`. Must be set in any deployed
environment before the schedule does anything; without it the endpoint fails closed.

**Amendment (7 August 2026) — no scheduler is attached.** The Vercel Cron schedule
(`*/15 * * * *`) was removed from the branch. The Hobby plan permits a once-daily schedule
only, and any more frequent expression fails the deployment. Slowing expiry to once a day
would have weakened the product to fit a hosting plan — Studdy's deadlines are hour-based
([PD-012](approved-product-decisions.md)) — so the schedule was deleted instead. The route,
its authentication, batching, idempotency and tests are all retained unchanged. **Inngest
is the required production invocation mechanism**; a paid Vercel plan is the alternative.
See [`documentation/operations/scheduled-jobs.md`](../../documentation/operations/scheduled-jobs.md).

Nothing about the security posture changes: the endpoint still fails closed, still refuses
`GET`, and is now simply unreachable on a schedule rather than reachable on one.

---

## SP-011 — Notification delivery records: plaintext addresses, bounded retention

**Decision.** `communications.notification_deliveries` stores `to_address` in plaintext. It
is the same address `identity.auth_identity_links.authentication_email` already holds, it
must be readable to be sent, and column-level encryption would keep the key in the very
process that sends the mail. Storing the RESOLVED address — rather than re-deriving it from
the user later — is deliberate: it is the honest record of where mail actually went, and a
later change to someone's address must not rewrite that history. In non-production it holds
the redirected development address, which is equally honest about what happened.

What is genuinely new is the SHAPE of the data, not its class: an append-only log of who was
told what and when, one family's address beside another's. The controls match that. Server-
only, as classified — no anon or authenticated grant, RLS enabled with no policies
(deny-all), no index on `to_address`, `last_error_code` restricted to machine-readable codes
and never a provider body, and a CHECK requiring a `sent` row to carry both a provider
message id and a timestamp.

**Retention: 90 days, then the row is DELETED.** The purposes are retry (minutes), support —
"I never got it" (days to weeks) — and dispute (weeks). Ninety days covers all three
generously. Deleting loses the address and the template, never the event:
`audit.audit_events`, `audit.status_transitions` and `audit.domain_events` retain what
happened and when, and carry no address at all. Anonymisation is rejected — an anonymised
delivery row has no remaining use. Note that Resend's own message retention is thirty days,
so Studdy's record deliberately outlives the provider's.

**Pruning must only remove deliveries whose outbox entry is terminal** (`sent` or
`superseded`). Deleting a `sent` delivery while a sibling is still owed would leave the entry
`pending`, let the next drain re-plan it against a unique index that no longer collides, and
send a second copy to somebody who already had one. The retention job is a duplicate-email
bug if that condition is omitted.

**Implementation deadline.** The pruning job must exist **before any notification-delivery
row can exceed ninety days of age, and no later than ninety days after the first production
send**. Nothing can be over-retained before that date, which is why the rule is approved now
and the enforcement follows it rather than blocking this slice. **It is not a public-launch
blocker unless that deadline would actually fall before launch** — if launch arrives first,
the job simply has nothing to do yet.

**`UNIQUE(provider_message_id)` is retained as written.** It catches a resolver bug pointing
two recipients at one send, and NULLs do not collide, so pending and failed rows are
unaffected. Two limitations are accepted for launch: it is not scoped by `provider`, and a
violation surfaces as a failed delivery rather than as its own alert. Scoping it to
`(provider, provider_message_id)` needs a new reviewed-SQL file and waits for a second
provider.

**Related finding, found during this review and FIXED in the same pull request.** Delivery
attempts had no ceiling: the claim query selected every `pending` or `failed` row regardless
of `attempts`, and the still-owed backoff was a flat sixty seconds against a one-minute cron
— so a delivery that could never succeed was retried roughly 43,000 times a month, burying
every real failure. Attempts are now capped at `MAX_DELIVERY_ATTEMPTS` (8, spanning a little
over four hours), the still-owed path uses the same exponential `backoffFrom` curve as the
unresolvable path, and exhausted deliveries are reported in every drain's outcome and listed
by `exhaustedDeliveries()` — a projection that deliberately carries the role, template and
error code, and no address.

**Status.** Approved 20 September 2026. Retention job outstanding, deadline as above.

---

## Standing rules

- Service-role keys are server-only, never committed, never in `NEXT_PUBLIC_*`, and never
  requested through chat.
- Every exposed table needs an intentional RLS classification in
  `packages/database/rls-classification.json`; `pnpm check:rls` fails CI otherwise.
- Writes stay server-authoritative: no browser-facing insert, update or delete policy
  exists anywhere in the schema.
- Development data is synthetic. Example tutors are always labelled as examples.
