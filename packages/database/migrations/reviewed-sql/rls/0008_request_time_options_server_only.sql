-- RLS and integrity for the multi-time request option tables (design §4.3, §4.4).
--
-- SERVER-ONLY, for the same reason as the rest of the request slice: a parent
-- and a tutor both authenticate as `authenticated`, so a column grant cannot
-- show a column to one and hide it from the other. It would hand the role the
-- union of both audiences' needs.
--
-- The boundary these two tables carry is sharper than most. `request_time_options`
-- holds the family's WHOLE set of acceptable times, and the size of that set is
-- itself a disclosure: a tutor who learned the family offered five times would
-- know how flexible they are, and by extension how replaceable this tutor is.
-- `tutor_request_time_options` holds one tutor's own subset and is the only one
-- a tutor-facing projection may read — and even there, `request_time_option_id`
-- is an identifier from the family's side and is never selected.
--
-- RLS enabled with DELIBERATELY NO POLICIES: deny-all for every non-owner role.
-- Three independent layers, as elsewhere in this slice — no schema usage, no
-- table grants, and policy-less RLS — so a future migration that mistakenly
-- re-granted table access would still return zero rows.

alter table bookings.request_time_options enable row level security;
alter table bookings.tutor_request_time_options enable row level security;

revoke all on bookings.request_time_options from anon, authenticated;
revoke all on bookings.tutor_request_time_options from anon, authenticated;

-- Belt and braces: the bookings schema already has no usage grant for browser
-- roles, and default privileges must not reintroduce one for tables added later.
--
-- Note the default-privileges line applies to objects later created BY THE ROLE
-- RUNNING THIS MIGRATION. That is the owner (`postgres`) today, matching how the
-- application connects; a future migration run as a different role would not
-- inherit it, and would need its own.
revoke usage on schema bookings from anon, authenticated;
alter default privileges in schema bookings revoke all on tables from anon, authenticated;

-- The accepted time is a foreign key, added here rather than in the generated
-- migration because the two tables reference each other: tutor_request_time_options
-- points at tutor_requests, and this points back at the claimed row.
--
-- It is a COMPOSITE key on (id, tutor_request_id), not on id alone. A plain
-- reference to the option id would let a tutor_request point at an option
-- belonging to a DIFFERENT tutor request — another tutor's offered time, from
-- another family's request — leaving only an application WHERE clause between
-- that and a cross-request acceptance. Carrying the owning request into the key
-- makes it unrepresentable.
alter table bookings.tutor_request_time_options
  drop constraint if exists tutor_request_time_option_id_request_unique;
alter table bookings.tutor_request_time_options
  add constraint tutor_request_time_option_id_request_unique unique (id, tutor_request_id);

alter table bookings.tutor_requests
  drop constraint if exists tutor_request_accepted_time_option_fk;
alter table bookings.tutor_requests
  add constraint tutor_request_accepted_time_option_fk
  foreign key (accepted_time_option_id, id)
  references bookings.tutor_request_time_options (id, tutor_request_id)
  on delete restrict;

-- An accepted request must carry its claimed time and its hold expiry, and a
-- request that has not accepted must carry neither. Making the pair inseparable
-- means no code path can record an acceptance that holds no calendar time, or a
-- hold with nothing to justify it.
alter table bookings.tutor_requests
  drop constraint if exists tutor_request_acceptance_complete;
alter table bookings.tutor_requests
  add constraint tutor_request_acceptance_complete
  check (
    (accepted_time_option_id is null and acceptance_hold_expires_at is null
       and hold_rule_version is null)
    or
    (accepted_time_option_id is not null and acceptance_hold_expires_at is not null
       and hold_rule_version is not null)
  );
