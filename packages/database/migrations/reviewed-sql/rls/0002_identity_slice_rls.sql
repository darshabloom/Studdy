-- RLS + grants for the identity slice (feat/identity-and-authentication).
-- identity.user_preferences: own-record read; writes stay server-authoritative.

alter table identity.user_preferences enable row level security;
drop policy if exists user_read_own_preferences on identity.user_preferences;
create policy user_read_own_preferences
  on identity.user_preferences
  for select
  to authenticated
  using (user_id = identity.current_studdy_user_id());

-- Table privileges. RLS restricts rows; these grants define which tables the
-- browser-facing role may touch at all. SELECT only — every write is
-- server-authoritative. The audit schema receives NO grants (server-only,
-- defence in depth on top of its policy-less RLS). anon receives nothing.
grant usage on schema identity to authenticated;
grant usage on schema permissions to authenticated;
grant select on identity.users to authenticated;
grant select on identity.auth_identity_links to authenticated;
grant select on identity.contact_points to authenticated;
grant select on identity.user_role_assignments to authenticated;
grant select on identity.user_preferences to authenticated;
grant select on permissions.role_definitions to authenticated;
