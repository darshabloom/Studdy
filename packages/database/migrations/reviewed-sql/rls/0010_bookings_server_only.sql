-- Bookings: SERVER-ONLY.
--
-- A booking joins a student to a tutor, a time, a place and a price. A column
-- grant is per DATABASE ROLE and a parent, a student and a tutor all
-- authenticate as `authenticated`, so no grant could show one family their own
-- bookings while hiding another's: the role receives the union. Every surface
-- that shows a booking reads it through an explicit server-side projection that
-- scopes by the signed-in user's own students or tutor profile, exactly as the
-- request tables do.
--
-- RLS is enabled with deliberately NO policies. In PostgreSQL that is deny-all
-- for non-owners, the fail-closed second layer beneath the absent grants.

alter table bookings.bookings enable row level security;
