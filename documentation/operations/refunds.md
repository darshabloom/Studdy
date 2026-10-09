# Refunds — the operator's runbook

How a family's money is given back when a payment succeeded and the lesson could not be
booked. This is the only refund Studdy can issue today: a booked lesson is refused (see
"What it will not do").

The approved rule (`docs/design/payments-and-first-paid-booking.md` §8) is that Studdy
neither confirms silently nor refunds silently. So a refund is started **by a person, on
purpose**, and the family is emailed once Stripe has accepted it. Nothing refunds
automatically.

---

## When you need this

An email titled **"Action needed: payment succeeded but the booking was not confirmed"**
arrives at `STUDDY_OPS_EMAIL` with a `PAY-` reference. It means the parent's card was
charged and Studdy could not make a booking of it. The payment is recorded as succeeded
and flagged; nothing has been returned yet.

## 1. See what is waiting

```bash
curl -s -X POST "$SITE_URL/api/jobs/refunds" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"report": true}'
```

Returns `awaitingRefund` (payment reference, amount, when it was flagged) and `byStatus`
(how many refunds sit in each state). A payment that has a booking, or already has a refund
in flight or done, is never listed.

## 2. Look before you refund

Check the payment in Stripe against the `PAY-` reference. The flag means Studdy could not
confirm the booking; it does not mean the family should be refunded without a human glance,
and it is the moment to decide whether the tutor or family needs a word.

## 3. Refund it

```bash
curl -s -X POST "$SITE_URL/api/jobs/refunds" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"paymentReference": "PAY-10000123"}'
```

| `result`   | Meaning                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `refunded` | Stripe accepted it. `settled: true` means the money is already back; `false` means it is on its way |
| `failed`   | Stripe refused. The money is **still held**. Ops is emailed; fix the cause and run this again       |
| `deferred` | Stripe could not be reached. Nothing is lost: the sweep finishes it within minutes                  |
| `refused`  | Studdy declined to start one. `refusal` says why (HTTP 409, or 404 for an unknown payment)          |

The family is emailed **once**, when Stripe first accepts the refund. A failed refund tells
the family nothing, because nothing has happened to their money.

## 4. The sweep

Every five minutes the scheduler (`settle-open-refunds`) finishes refunds a person already
started: it resumes one whose answer was never recorded and reads pending ones back until
they settle. **It never starts a refund.** You can run it by hand with no body:

```bash
curl -s -X POST "$SITE_URL/api/jobs/refunds" -H "Authorization: Bearer $CRON_SECRET"
```

---

## What it will not do

- **Refund a booked lesson.** A payment that became a booking is refused (`booking_confirmed`).
  Refunding one has to cancel the booking, withdraw the tutor's obligation or claw back a
  transfer already sent, and apply a cancellation policy. That belongs to the cancellation
  slice.
- **Refund part of a payment.** Always the whole remaining amount; partial refunds need a
  policy.
- **Refund twice.** One live refund per payment is a database rule, and a refund Stripe has
  already made is adopted, not repeated, even if Studdy's own record was lost.

## Refusal reasons

| `refusal`               | What to do                                                              |
| ----------------------- | ----------------------------------------------------------------------- |
| `payment_not_found`     | Check the reference                                                     |
| `payment_not_succeeded` | There is no money to return                                             |
| `no_provider_payment`   | The payment never reached Stripe; investigate                           |
| `booking_confirmed`     | The lesson is booked. Do not refund through here                        |
| `refund_not_required`   | Nobody flagged this payment; it is not a late success                   |
| `already_refunded`      | Done                                                                    |
| `refund_in_flight`      | One is already being processed; wait for the sweep, or check `byStatus` |
| `nothing_refundable`    | Nothing left to refund                                                  |

## After a failure

A `failed` refund is terminal. Fix whatever Stripe objected to (its machine-readable reason
is in the ops alert), then run step 3 again: a **new** attempt is made, with its own
idempotency key, precisely because the last one failed.

## Safety properties, for whoever changes this

- The intent is committed **before** Stripe is called, and Stripe is never called inside a
  database transaction.
- Stripe honours an idempotency key for 24 hours only, so a resumed refund first asks Stripe
  what it already holds for the payment and adopts the refund whose metadata names this
  Studdy refund.
- Only a definitive Stripe refusal (`invalid_request`, `card_error`) marks a refund failed. A
  network error, rate limit or bad key leaves it `requested`, because recording a failure for
  something that might have reached Stripe is a route to a double refund.
- Logs carry counts and correlation ids only, never a reference, amount or person.
