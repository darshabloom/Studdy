# Approved launch product rule: independent student eligibility

Status: Approved by Darsha, 6 August 2026 · **Launch product rule — NOT a final legal
conclusion. Must be reviewed before production.**

## Rule

- A fully independent student account, holding its own payment authority, requires the
  account holder to be **18 or older** (self-declared at account setup).
- Students **under 18** use a Family Account with a parent or guardian.
- Older dependent students booking or managing lessons **with guardian permission** may be
  supported later; they are **not** treated as financially independent in the identity
  slice.

## Implementation

- `/welcome` independent-student path requires the declaration: _"I confirm I am 18 or
  older and financially responsible for my lessons."_ Without it, the path cannot be
  completed and the user is directed to the parent/family option.
- The declaration is recorded on the role assignment (`assignment_reason_code =
'self_declared_18_plus'`) and audit-logged.

## Review before production

Verify against NZ legal requirements (minors' contracts, consumer law, privacy) with
qualified advice. This file is the tracking record for that review.
