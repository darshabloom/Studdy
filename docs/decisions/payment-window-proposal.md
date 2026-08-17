# Proposed product rule — the payment window

**Status: PROPOSED, awaiting the owner's review. NOT implemented, and no Stripe or ledger
work has been done.** Recorded during checkpoint 5 of
`feat/availability-and-multi-time-requests` so the next slice starts from a written rule
rather than an inference.

## The rule as proposed

1. **Family selection starts a payment window.** The window begins at the moment the family
   chooses their tutor and time, not at acceptance.
2. **The payment deadline is the earlier of:**
   - **30 minutes** after selection, or
   - **2 hours before** the lesson starts.
3. **The winning reservation is extended only to that payment deadline** — never further.
4. **Successful payment moves the ILR `awaiting_payment → fulfilled`**, which is the terminal
   state meaning a confirmed booking.
5. **Payment-window expiry closes the ILR and the selected Tutor Request, and releases the
   hold.** The existing close reason `payment_window_lapsed` covers it, on both records.

## How this lands on what checkpoint 5 already built

Every state, transition and reason this needs already exists and is exercised:

- `awaiting_payment` is the state selection lands on, with `→ fulfilled` and `→ closed` both
  declared and tested (`packages/domain/src/bookings/transitions.ts`).
- `selected → closed` is declared, and `payment_window_lapsed` is already in
  `CLOSE_REASON_CODES` and rendered family-side.
- The expiry sweep already closes a `selected` request at its hold expiry with
  `payment_window_lapsed`, releases the reservation and closes the ILR
  (`expireOverdueRequests`). **The payment slice changes when that deadline falls, not what
  happens when it passes.**

So implementing this is: add the rule setting, extend the winner's reservation inside the
selection transaction, and snapshot the deadline onto the record with its rule version — the
same discipline D-8 uses for every other deadline.

## Why checkpoint 5 did not simply do it

Selection deliberately leaves the winner's hold at its original acceptance expiry. Choosing
a payment window is choosing payment-slice policy, and 30 minutes is a materially different
product than, say, 24 hours — it decides whether a family can step away from their phone
mid-decision. That is the owner's call, not an implementation detail to be inferred.

The consequence today, stated plainly: **without a payment window, every selection
eventually lapses** when the acceptance hold expires. That is the honest outcome — no
payment, no booking — and the hold dies exactly when the tutor was told it would, which
§12 requires. But it does mean the journey currently ends in a lapse rather than a booking,
and this rule is what closes that.

## Points worth deciding explicitly

- **30 minutes is short.** It is good for tutors — a slot is released quickly if the family
  stalls — and unforgiving for families, who must have a card ready at the moment they
  choose. Worth confirming that is intended rather than inherited from the 2-hour limb.
- **The second limb can make the window zero or negative** for a lesson under two hours
  away. Minimum notice is also 2h, so such a lesson is unbookable anyway — but the rule
  should say whether selection is refused outright in that case, or allowed and immediately
  lapsed. Refusing at selection is kinder and easier to explain.
- **The hold currently shrinks, never grows.** Extending to the payment deadline may
  _shorten_ a hold that had longer to run (acceptance gives up to 8 hours; 30 minutes after
  selection is usually less). That is consistent with §12 — never retain a hold longer than
  needed — but it means selecting a tutor can bring their hold expiry _forward_, which the
  tutor's screen should not present as a penalty.
- **What the tutor sees while payment is pending.** Checkpoint 5 shows them "You were
  chosen" with the hold expiry. Whether they should see "awaiting payment" specifically is a
  privacy question: it reveals something about the family's progress, though not about any
  competitor.
