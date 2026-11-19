-- Studdy payment tables are server-authoritative. No browser role can read or write
-- these records directly. The trusted server uses a database connection with
-- restricted backend credentials and enforces domain permissions.
--
-- Enable RLS without adding permissive anon/authenticated policies.
-- This covers the four payment tables added since the earlier RLS migrations.
alter table payments.connected_accounts enable row level security;
alter table payments.payment_events enable row level security;
alter table payments.payments enable row level security;
alter table payments.tutor_transfers enable row level security;
