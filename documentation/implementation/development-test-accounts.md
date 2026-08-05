# Development test accounts

Synthetic accounts only — no real student details, family information or payment details
ever enter development environments. **No production credentials, tokens or
account-recovery secrets are committed to this repository.**

## Local (synthetic, deterministic, no real inbox)

Seeded by `pnpm db:seed` (scenario `clean_registration`). When local Supabase is running,
matching Supabase Auth users are created so these accounts can sign in; auth emails land
in the local inbox at http://127.0.0.1:54324.

Shared local-only password: `Studdy-local-only-1` (synthetic; local environment only;
defined in `packages/database/src/seed/synthetic-users.ts`).

| Email                                 | Roles                        |
| ------------------------------------- | ---------------------------- |
| owner@local.studdy.test               | Platform Owner               |
| manager@local.studdy.test             | Platform Manager             |
| parent.one@local.studdy.test          | Parent or guardian           |
| parent.two@local.studdy.test          | Parent or guardian           |
| student.independent@local.studdy.test | Independent student          |
| student.dependent@local.studdy.test   | Dependent student            |
| tutor.a@local.studdy.test             | Tutor                        |
| tutor.b@local.studdy.test             | Tutor                        |
| tutor.c@local.studdy.test             | Tutor                        |
| restricted.tutor@local.studdy.test    | Tutor (restricted scenarios) |

## Seed scenarios

Available now: `clean_registration`. Planned (land with their slices):
`multi_tutor_request_pending`, `one_tutor_accepted`, `several_tutors_accepted`,
`payment_required`, `booking_confirmed`, `request_expired`, `calendar_conflict`,
`payment_failed`, `restricted_tutor`, `independent_student_booking`.

## Development cloud

Development cloud accounts use test email addresses controlled by Darsha (Parent,
Independent student, Tutor A/B/C, Platform Manager, Platform Owner). To be created when
the Development environment is wired up; recorded here **without** passwords.
