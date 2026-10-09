# Reviewing tutor services — the reviewer's how-to

For Platform Managers and Owners. Open **Service review** in the manager workspace
(`/manager/services`). You will need your MFA code: the page and every action on it re-check both
your role and your MFA session.

The decisions behind this, and the ones still open, are in
`docs/decisions/tutor-onboarding-decisions.md` (TO-009 onward).

---

## 1. Why a service comes to you

A tutor cannot publish a service until Studdy has approved it. Everything a tutor sends appears
here, oldest first, marked either **New service** or **Change to a service**.

A change is a separate draft of a service you reviewed before. The original stays exactly as it
is, on sale if it was, until the tutor publishes the change. Nothing a tutor edits reaches a
family without passing through this queue.

## 2. Read it

The page shows what the tutor wants to offer (subject, year levels, description, how it is
taught, each lesson length and its price), the tutor's own profile for comparison, what the
service would replace if it is a change, and any earlier decisions with their notes.

Check:

- the subject and year levels are ones this tutor was approved to teach, or reasonably close
- the description makes no claim Studdy has not verified (a qualification, a result, a school)
- the description contains no contact details or anything that takes a family off Studdy
- the prices and lengths are sensible; a lesson may be $10 to $500
- the format matches what the tutor can actually deliver

## 3. Decide

- **Approve.** The tutor is told and can publish. **Approving does not publish**: the tutor
  chooses when to go on sale. Your optional note is staff-only.
- **Request changes.** Write a message for the tutor. They read it exactly as written, edit the
  service and send it again. Do not put anything about another person in it.

There is no "reject". If a service should not exist, request changes and say so; the tutor can
remove it.

If the tutor takes a service back out of review while you have it open, your decision is refused
and the page says so. Nothing is lost; it will come back when they send it again.

## 4. What approval does not check

Whether the tutor can be paid, and whether they have set any availability. Publication is refused
by the system until Stripe reports the tutor can receive payments. A tutor with no availability
can publish but cannot be asked for a time; their setup list tells them.

## 5. What you cannot do from here yet

Unpublish, restrict or suspend a service that is already on sale. Those are in the approved
workflow and are not built. Until they are, taking a service off sale against a tutor's wishes is
a database operation and should be treated as an incident.
