-- RLS for the request slice.
--
-- DELIBERATELY SERVER-ONLY (approved correction 5, design §8.0).
--
-- Column-level grants are granted per DATABASE ROLE, and a parent and a tutor
-- both authenticate as `authenticated`. A grant therefore cannot show
-- intended_lesson_request_id to a family while hiding it from a tutor — the
-- role would receive the union of both audiences' needs. Relying on column
-- grants to carry the tutor-privacy boundary is unsound.
--
-- So these tables are reachable only through the trusted server connection,
-- exactly like audit.*. Each audience is served by a server-side query with
-- its own explicit projection; the tutor projection never selects the ILR
-- foreign key, the position, or any close reason.
--
-- RLS is enabled with DELIBERATELY NO POLICIES, which in PostgreSQL means
-- deny-all for every non-owner role. That is the fail-closed second layer: if
-- a future migration accidentally re-granted table access, RLS would still
-- return zero rows. Three independent layers protect these tables — no schema
-- usage, no table grants, and policy-less RLS.
--
-- Note: `service_role` likewise holds no usage on these schemas. The
-- application connects as the owner (`postgres`), so this is correct today; an
-- environment that connects as `service_role` would fail closed rather than
-- leak, which is the intended direction of failure.

alter table bookings.intended_lesson_requests enable row level security;
alter table bookings.tutor_requests enable row level security;
alter table availability.tutor_time_reservations enable row level security;
alter table platform.rule_settings enable row level security;

-- Explicitly ensure no inherited privileges linger from schema defaults.
revoke all on bookings.intended_lesson_requests from anon, authenticated;
revoke all on bookings.tutor_requests from anon, authenticated;
revoke all on availability.tutor_time_reservations from anon, authenticated;
revoke all on platform.rule_settings from anon, authenticated;

-- The bookings and availability schemas gain no usage grant for browser roles
-- at all, so nothing inside them is addressable even if a table grant were
-- added by mistake later.
revoke usage on schema bookings from anon, authenticated;
revoke usage on schema availability from anon, authenticated;
