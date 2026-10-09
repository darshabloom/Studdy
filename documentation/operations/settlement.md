# Settlement — the operator's runbook

How a tutor is paid. Studdy takes the parent's money into its own Stripe balance when they
pay (separate charges and transfers) and sends the tutor's share afterwards, so a cancelled or
disputed lesson never needs money clawed back out of a tutor's account.

The approved alpha design (`docs/design/payments-and-first-paid-booking.md` §5) is that
settlement is **deliberate and manual, reviewed weekly**. Nothing here runs on a timer. Which
day, and who runs it, is still an open decision (§15 item 4), and building the mechanism
without automating it leaves that decision where it belongs.

---

## What is owed, and when

A tutor's share was recorded as a `pending` obligation the moment the booking was confirmed. It
becomes **eligible** only when all of these hold:

- the payment succeeded, and there is a charge to send it from;
- there is a booking, and it was not cancelled;
- the lesson's **scheduled end has passed**. A tutor is paid for a lesson that was supposed to
  have happened, never in advance of it;
- nothing is flagged for refund and no refund has been started or made;
- the tutor is payable **now**, by Stripe's own account state. A tutor restricted since the
  parent paid is skipped, not sent to.

Anything else is **held**, with the first reason that applies. A held obligation is not a
problem: it stays pending and is considered again on the next run.

## 1. Look at what is owed

```bash
curl -s -X POST "$SITE_URL/api/jobs/settlement" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"report": true}'
```

Returns `eligible` (payment reference, tutor reference, amount, when the lesson ended),
`eligibleTotals` (per currency), `held` and `heldByReason`. It sends nothing and names no
person: a tutor is a `TUT-` reference, not a name.

| Hold reason             | Meaning                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| `lesson_not_ended`      | The lesson has not finished yet. Normal; wait                                 |
| `tutor_not_payable`     | Stripe says the tutor cannot receive money now. Ask them to finish onboarding |
| `booking_cancelled`     | The booking was cancelled. Nothing is owed unless a person decides otherwise  |
| `flagged_for_refund`    | The payment is being given back. Never pay out against it                     |
| `refund_started`        | A refund has been started or made                                             |
| `no_booking`            | No booking exists for the payment; investigate                                |
| `no_charge`             | The payment has no Stripe charge to draw from; investigate                    |
| `payment_not_succeeded` | There is no money to send                                                     |
| `transfer_not_pending`  | Already sent or failed                                                        |

## 2. Send it

Quote the **eligible total you reviewed** (in minor units, so $36.00 is `3600`):

```bash
curl -s -X POST "$SITE_URL/api/jobs/settlement" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"execute": true, "expectedTotalMinor": "3600"}'
```

**If the eligible total is not the number you quoted, nothing is sent** and the response (HTTP
409, `total_changed`) says what it is now. A refund flagged, a booking cancelled or a lesson
newly ended between looking and clicking cannot quietly change how much money moves. Read the
report again, then run it with the new total.

There is no default action: an empty or unrecognised body is refused, so nothing moves money by
omission. More than one currency being eligible is also refused (`mixed_currency`); launch is
NZD only.

Each obligation is **re-read and re-judged immediately before it is sent**, so one that stopped
being eligible in the meantime is skipped, not paid.

| Count      | Meaning                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `sent`     | Stripe accepted it and it is recorded                                                               |
| `failed`   | Stripe definitively refused. The tutor is **owed and unpaid**; see below                            |
| `deferred` | No answer from Stripe (network, rate limit, bad key). Still pending; run again                      |
| `skipped`  | Became ineligible between the report and the send, or was already recorded. Nothing was sent for it |

## 3. After a failure

A `failed` obligation is terminal and raises a high-risk audit event. Find out why (the reason
is on the transfer; the usual one is that the tutor's account cannot receive transfers), fix it,
then put it back in the queue:

```bash
curl -s -X POST "$SITE_URL/api/jobs/settlement" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"requeue": "PAY-10000123"}'
```

That creates a **new** pending obligation with its own idempotency key, because Stripe may
replay the cached outcome of the old key. It is refused unless the latest obligation failed and
nothing is pending or sent for the payment. It goes to the same account unless that has been
replaced, in which case it goes to the tutor's current one. Then run step 1 and 2 again.

---

## Safety properties, for whoever changes this

- **The total you reviewed is the total that is sent.** The run takes it as an argument and
  sends nothing if the eligible total differs.
- **Never in advance of the lesson**, and never against a payment being refunded. One pure
  rule (`decideSettlement`) decides, and the report and the run both apply it, so they cannot
  disagree.
- **Stripe is never called inside a database transaction.** Each transfer is drawn from the
  parent's own charge (`source_transaction`), so it cannot exceed what that charge brought in.
- **A lost transfer is found, not repeated.** Stripe honours an idempotency key for 24 hours and
  this runs weekly, so before creating a transfer the run asks Stripe what it already holds for
  the payment and adopts the one whose metadata names this obligation. An adopted transfer
  whose amount, currency or destination differ from what is owed, or that was reversed, is
  **never recorded as settling the obligation**.
- **Only a definitive Stripe refusal marks an obligation failed.** A network error, rate limit
  or bad key leaves it pending, because recording a failure for something that might have
  reached Stripe is a route to paying a tutor twice.
- Recording is guarded on `pending`: two runs racing one obligation produce one `sent`.
- Logs carry counts and correlation ids only, never a reference, amount, tutor or provider id.

## Not built yet

- A tutor-facing earnings view (Week 2).
- Reversing a transfer already sent (arrives with cancellation, which must also settle the
  parent's side).
- Automated cadence, which is a product decision.
