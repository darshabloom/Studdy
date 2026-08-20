-- Availability rules and exceptions: SERVER-ONLY.
--
-- Same posture as the request-slice tables (rls/0004), for the same reason and
-- one additional one.
--
-- The shared reason: a column-level grant is granted per DATABASE ROLE, and a
-- parent, a student and a tutor all authenticate as `authenticated`. A grant
-- therefore cannot show a tutor their own private block reason while hiding it
-- from a family — the role receives the union of both audiences' needs. Each
-- audience is served instead by a server-side projection with its own explicit
-- column list.
--
-- The additional reason, specific to availability: these tables describe when a
-- real person is and is not working, and `availability_exceptions` carries
-- `reason_code` and `private_note` — which may record a medical appointment, a
-- family commitment or a bereavement. That is information about someone's life,
-- not about a bookable service. Families receive only DERIVED POSITIVE BOOKABLE
-- SLOTS, computed server-side, from which no gap and no reason can be read.
--
-- RLS is enabled with deliberately NO policies. In PostgreSQL that is deny-all
-- for non-owners, which is the fail-closed third layer beneath the absent
-- grants and the server-side projections.

alter table availability.availability_rules enable row level security;
alter table availability.availability_exceptions enable row level security;

-- Force RLS for the table owner too, so a future connection that happens to own
-- these tables does not bypass the deny-all.
alter table availability.availability_rules force row level security;
alter table availability.availability_exceptions force row level security;

-- No grants to anon or authenticated. Revoke defensively in case a future
-- default privilege or a manual grant introduces one.
revoke all on availability.availability_rules from anon, authenticated;
revoke all on availability.availability_exceptions from anon, authenticated;

-- The browser roles have no usage on this schema at all, so the tables are not
-- merely ungranted but unreachable. Repeated from rls/0004 because reviewed SQL
-- files are immutable once applied and this file must stand alone.
revoke usage on schema availability from anon, authenticated;

-- Supabase installs default ACLs that auto-grant on FUTURE objects in some
-- schemas. Strip them here so "no browser grant on availability" stays true for
-- tables added by later slices, rather than being true only today.
alter default privileges in schema availability revoke all on tables from anon, authenticated;
alter default privileges in schema availability revoke all on sequences from anon, authenticated;
alter default privileges in schema availability revoke all on functions from anon, authenticated;

comment on table availability.availability_rules is
  'Recurring bookable time (Database spec 8.4). SERVER-ONLY: no browser grant, RLS enabled with no policies (deny-all). Families receive derived positive bookable slots only, never these rows.';

comment on table availability.availability_exceptions is
  'One-off additions, holidays, breaks and blocked time (Database spec 8.6). SERVER-ONLY. reason_code and private_note never leave the tutor''s own workspace.';

comment on column availability.availability_exceptions.reason_code is
  'TUTOR-ONLY. Why time is blocked. Never selected by any family-facing projection.';

comment on column availability.availability_exceptions.private_note is
  'TUTOR-ONLY free text. Never selected by any family-facing projection.';
