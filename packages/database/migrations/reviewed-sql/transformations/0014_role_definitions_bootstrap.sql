-- Required role catalogue for the server-authoritative onboarding flow.
-- Codes are stable and used by completeAccountSetup; this is safe to re-run.
-- Never grant owner/manager status through self-service onboarding.
insert into permissions.role_definitions (code, display_name, workspace_code)
values
  ('parent_guardian', 'Parent or guardian', 'parent'),
  ('dependent_student', 'Dependent student', 'dependent_student'),
  ('independent_student', 'Independent student', 'independent_student'),
  ('tutor', 'Tutor', 'tutor'),
  ('supporter', 'Supporter', null),
  ('organisation_member', 'Organisation member', 'organisation'),
  ('organisation_manager', 'Organisation manager', 'organisation'),
  ('platform_manager', 'Platform Manager', 'platform_manager'),
  ('platform_owner', 'Platform Owner', 'platform_owner')
on conflict (code) do nothing;
