-- Row Level Security foundation for the identity, permissions and audit
-- schemas (Database spec §13; brief §8).
--
-- Principles:
--  * Every exposed table has RLS enabled with an intentional policy.
--  * Sensitive tables (audit.*) are server-only: RLS enabled, no policies —
--    default deny for anon/authenticated; service role bypasses RLS.
--  * Resolution chain: auth.uid() → identity.auth_identity_links → identity.users.
--  * Writes are server-authoritative in package one: no insert/update/delete
--    policies for browser roles.

-- Helper: resolve the current permanent Studdy User from the Supabase JWT.
-- SECURITY DEFINER with a pinned search_path; narrow output (Database spec §13.2).
create or replace function identity.current_studdy_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select link.user_id
  from identity.auth_identity_links as link
  where link.provider_type = 'supabase'
    and link.provider_subject_id = (select auth.uid())
    and link.status_code = 'active'
  limit 1;
$$;

revoke all on function identity.current_studdy_user_id() from public;
grant execute on function identity.current_studdy_user_id() to authenticated;

-- identity.users — own record only.
alter table identity.users enable row level security;
drop policy if exists user_read_own_record on identity.users;
create policy user_read_own_record
  on identity.users
  for select
  to authenticated
  using (id = identity.current_studdy_user_id());

-- identity.auth_identity_links — own links only.
alter table identity.auth_identity_links enable row level security;
drop policy if exists user_read_own_auth_links on identity.auth_identity_links;
create policy user_read_own_auth_links
  on identity.auth_identity_links
  for select
  to authenticated
  using (user_id = identity.current_studdy_user_id());

-- identity.contact_points — own contact points only (policy name per spec §13.7).
alter table identity.contact_points enable row level security;
drop policy if exists user_read_own_contact_points on identity.contact_points;
create policy user_read_own_contact_points
  on identity.contact_points
  for select
  to authenticated
  using (user_id = identity.current_studdy_user_id());

-- identity.user_role_assignments — own assignments only.
alter table identity.user_role_assignments enable row level security;
drop policy if exists user_read_own_role_assignments on identity.user_role_assignments;
create policy user_read_own_role_assignments
  on identity.user_role_assignments
  for select
  to authenticated
  using (user_id = identity.current_studdy_user_id());

-- permissions.role_definitions — readable catalogue for signed-in users.
alter table permissions.role_definitions enable row level security;
drop policy if exists authenticated_read_role_definitions on permissions.role_definitions;
create policy authenticated_read_role_definitions
  on permissions.role_definitions
  for select
  to authenticated
  using (status_code = 'active');

-- audit.* — server-only (spec §13.4): RLS enabled, deliberately no policies.
alter table audit.audit_events enable row level security;
alter table audit.status_transitions enable row level security;
alter table audit.domain_events enable row level security;
alter table audit.outbox_entries enable row level security;
