# Studdy Launch Status

**The source of truth for what each role can actually do today.** Updated with every merged
slice. If this and another document disagree about what works, this one is right and the other
needs fixing; if this one disagrees with the code, the code is right and this needs fixing.

Last updated: **10 October 2026**, with tutor onboarding complete (after applications, settlement, refunds and the Booking entity).

How to read it: **Works** means built, tested and reachable by that role. **Partial** means a
real piece exists but the journey does not finish. **Not started** means nothing a user can
touch. **Blocked** means it needs something outside the code.

Delivery target: properly usable before December 2026, December/January for cleanup, and a
visibly usable product by the end of October.

---

## What every role can do

### Visitor

| Journey                                                                                           | Status |
| ------------------------------------------------------------------------------------------------- | ------ |
| Public site: home, how it works, pricing, for tutors, help, trust and safety                      | Works  |
| Browse tutors, filter, see a tutor's profile, the services they sell and real availability        | Works  |
| Sign up, verify email, sign in, reset password                                                    | Works  |
| Choose a role at `/welcome` (parent, independent student with an 18+ declaration, tutor interest) | Works  |

### Parent

| Journey                                                                                                                       | Status                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Add a student and a subject need                                                                                              | Works                                |
| Shortlist tutors (cap of three)                                                                                               | Works                                |
| Ask one tutor, or several tutors at once, for a lesson at chosen times                                                        | Works                                |
| See, and come back to, their lesson requests (sidebar link and dashboard link, desktop and phone)                             | Works                                |
| Choose the tutor and time once a tutor accepts                                                                                | Works                                |
| Pay inside the payment window (Stripe Payment Element, retry on decline)                                                      | Works in Stripe test mode            |
| Booking confirmed automatically when payment succeeds                                                                         | Works in Stripe test mode            |
| Emails: payment required, booking confirmed, request expired, payment refunded                                                | Built, **not sending** (see Blocked) |
| Get the money back when a paid lesson could not be booked (an operator starts it; the family is emailed)                      | Works in Stripe test mode            |
| The locked Parent screens: Students, individual Student, Bookings, Calendar, Payments, Find a Tutor, My Tutors, Book a Lesson | Not started (Week 3)                 |
| Cancel or reschedule a booking, get a refund on request                                                                       | Not started                          |
| Lessons, summaries, homework, progress                                                                                        | Not started                          |

### Tutor

| Journey                                                                                        | Status                                         |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Apply to become a tutor (draft, submit, resubmit, withdraw)                                    | Works                                          |
| Be approved into a real tutor profile and workspace                                            | Works (a reviewer decides; see Admin)          |
| Enter the workspace as soon as approved, and see a setup checklist of what is left             | Works                                          |
| Edit their public profile (headline, approach, year levels, formats, room for new students)    | Works                                          |
| Create a service: subject, description, year levels, format, lesson lengths and prices         | Works                                          |
| Send a service to Studdy for review, take it back, and act on requested changes                | Works                                          |
| Publish an approved service, unpublish it, and publish it again                                | Works; publishing needs payouts (see Blocked)  |
| Change a live service without going off sale (drafted, reviewed, swapped in on publish)        | Works                                          |
| Pause and resume their own listing                                                             | Works                                          |
| Appear in discovery and on a public profile with their real service, price and description     | Works                                          |
| Set weekly availability and exceptions                                                         | Works                                          |
| See lesson requests, accept with a time or decline                                             | Works                                          |
| Held time and release when a request closes                                                    | Works                                          |
| Start Stripe Connect onboarding and see payout status                                          | Works in Stripe test mode                      |
| Emails: application received, changes requested, declined, approved; service approved, changes | Built, **not sending**                         |
| Notified by email when asked, and when a request closes                                        | Built, **not sending**                         |
| The locked Tutor dashboard, calendar, earnings                                                 | Not started                                    |
| Paid out (operator-run settlement, weekly, after the lesson)                                   | Built; **not proven end to end** (see Blocked) |

**Start to finish, with no database work:** apply, be approved by a reviewer, open the workspace,
create and price a service, send it for review, have a reviewer approve it, complete Stripe
onboarding, set availability, publish, and be found by a family. The one step that still needs a
person outside Studdy's screens is Stripe's own hosted onboarding.

### Independent student

| Journey                                                                        | Status                    |
| ------------------------------------------------------------------------------ | ------------------------- |
| Set up their own profile and subject need                                      | Works                     |
| Same request, choice and payment journey as a parent, through the same screens | Works in Stripe test mode |
| Student dashboard beyond the above, lessons, progress                          | Not started               |

### Dependent student

| Journey                              | Status                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Having their own login               | Not started. No registration path grants it; only a dev seed does      |
| Self-creating an independent profile | **Blocked on purpose** (a dependent cannot bypass the 18+ declaration) |
| Their lessons through a parent       | Not started                                                            |

A parent-managed student is a record the parent acts for. The product question of what a
dependent student sees when they do have a login is open and is a product decision.

### Admin / Platform Manager

| Journey                                                                                    | Status                                                                 |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Workspace shell with the MFA gate                                                          | Works                                                                  |
| Review tutor applications: read, record the four checks, approve, request changes, decline | Works. Refunds and settlement run through operator routes, not screens |
| Review tutor services: read, compare with what it replaces, approve, request changes       | Works. Emailed when one is waiting (built, **not sending**)            |
| Take a live service or a tutor out of view (restrict, suspend, unlist)                     | Not started. A database operation today                                |
| Everything else an admin does (support, configuration, users)                              | Not started. The pages are empty states                                |

### Platform Owner

| Journey                           | Status                                  |
| --------------------------------- | --------------------------------------- |
| Workspace shell with the MFA gate | Works                                   |
| Everything an owner does          | Not started. The pages are empty states |

### Organisation

| Journey                      | Status                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| Workspace shell              | Exists as an empty state                                       |
| Minimum organisation journey | **Not defined yet.** Needs a product decision before any build |

---

## The money and booking foundation

| Piece                                                                                           | Status                                |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| Price and commission arithmetic (10% of the tutor's price, from the tutor's side)               | Works                                 |
| Tutor payability from Stripe's own account state, never from "they clicked"                     | Works                                 |
| Parent payment, server-priced, retry on the same intent                                         | Works in Stripe test mode             |
| Webhook-authoritative fulfilment, idempotent, race-safe                                         | Works                                 |
| Late success is recorded and flagged for refund, never re-taken                                 | Works                                 |
| **Durable Booking entity** (`bookings.bookings`, approved four states, written at confirmation) | Works                                 |
| Refund execution for a payment that arrived with no booking (operator-started)                  | Works in Stripe test mode             |
| **Tutor settlement** (operator-run, weekly; sends only after the lesson has ended)              | Built; needs a payable tutor to prove |
| Tutor-managed services, reviewed before sale, immutable once reviewed                           | Works                                 |
| Cancellation and reschedule against a Booking                                                   | Not started                           |

---

## Blocked, or waiting on a person

- **Stripe webhooks and the scheduler cannot reach Production.** Vercel Deployment Protection
  redirects `/api/webhooks/stripe/*`, `/api/inngest` and `/api/jobs/*` to a login page. Until
  those are exempt, real payments would not confirm, and expiry, reconciliation and email
  delivery would not run.
- **Email is not sending.** `RESEND_API_KEY` must stay unset until the historical notification
  backlog has been reviewed and superseded (handoff section 8).
- **Live money needs professional confirmation first:** merchant of record, GST treatment and
  who carries a tutor's unpaid negative balance. Sandbox only until then.
- **Production rehearsal with sandbox keys is not possible** by design: the payments webhook
  only accepts live-mode events when `STUDDY_ENVIRONMENT=production`.
- **Refunds and settlement are started by a person**, by design (the approved late-success and
  alpha-settlement rules). Runbooks: `documentation/operations/refunds.md` and `settlement.md`.
  Their routes sit behind the same Deployment Protection as the other `/api/jobs/*` routes, so
  until those are exempt an operator can reach them only from the Vercel side or a local run.
- **No payable tutor exists in the Stripe sandbox**, so a real settlement transfer has not yet been
  seen end to end. The three sandbox accounts all stopped before finishing onboarding. A tutor has
  to complete Stripe's hosted onboarding once (identity details, which only a person should
  enter), and then the settlement path can be run against real Stripe test mode. Until then it is
  proved against the real API only as far as Stripe judging the destination.
- **A new tutor cannot publish until Stripe says they can be paid** (TO-011, a rule that is on by
  default). Since no payable tutor exists in the sandbox, **no newly approved tutor can reach
  discovery in any deployed environment until one person completes Stripe's hosted onboarding as
  that tutor.** This is the same action as the item above and unblocks both. The rule can be
  switched off (`services.publication_requires_payout_readiness` set to `false`), which lets tutors
  be found before they can be paid; a family choosing one would then be refused at payment.
- **Three onboarding policies are waiting on the owner** (`docs/decisions/tutor-onboarding-decisions.md`):
  whether a service can be rejected outright (TO-009), the payout rule above (TO-011), and whether
  profile text edits should be reviewed (TO-012, they are not today). Alongside the earlier open
  ones: what the four application checks mean in practice, and the declaration wording.
- **Production needs its database migrated for this slice** (`pnpm db:migrate`: generated `0013`
  and reviewed `rls/0013_tutor_services.sql`). Until it is, tutor service pages and the public
  tutor profile will error there.
- **Local Docker is down on the development machine** (Docker Desktop's WSL engine fails to
  start), so database and Playwright suites run only in CI for now.

## Where the plan stands

Execution order: **A** money and booking foundation, **B** complete tutor onboarding, **C** the
approved Parent experience, **D** the approved Tutor workspace, **E** student experiences and
the lesson lifecycle, **F** admin, owner and organisation, **G** launch hardening.

**A** is done apart from one end-to-end sandbox run that needs a payable tutor. **B is done:** a
new person can apply, be approved, set up, be reviewed, publish and be found, with the emails for
each step built. What B leaves for later slices is staff-side control of a live service or tutor
(restrict, suspend, unlist), which belongs to **F**. Next is **C**, the approved Parent
experience. Out of scope for launch: chat, advanced analytics, external calendar sync, a large
Resources system.
