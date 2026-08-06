-- RLS, grants and public exposure for feat/family-students-and-discovery.
--
-- Reviewed by a focused security pass before finalisation; the corrections
-- from that review are folded in here (see the notes at each site).
--
-- Boundaries in this file:
--   * family scope   — a guardian reaches only their own family's DEPENDENT students;
--   * self scope     — a student reaches only their own records;
--   * public tutors  — anonymous visitors read ONE view, never a base table.
--
-- Writes remain server-authoritative everywhere: no insert/update/delete
-- policy is granted to any browser-facing role.

-- ---------------------------------------------------------------------------
-- Scope helpers. SECURITY DEFINER with an empty search_path and fully
-- qualified identifiers, mirroring identity.current_studdy_user_id().
-- ---------------------------------------------------------------------------

create or replace function families.current_user_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.family_account_id
  from families.family_memberships as membership
  join families.family_accounts as account
    on account.id = membership.family_account_id
  where membership.user_id = identity.current_studdy_user_id()
    and membership.status_code = 'active'
    -- Review fix: a membership ended via ended_at, or not yet in effect, must
    -- not grant access even if status_code was not flipped.
    and membership.ended_at is null
    and membership.effective_from <= now()
    and (membership.effective_until is null or membership.effective_until > now())
    -- Review fix: members of a suspended or closed family lose access.
    and account.status_code = 'active'
    and account.archived_at is null;
$$;

revoke all on function families.current_user_family_ids() from public;
grant execute on function families.current_user_family_ids() to authenticated;

-- Student profiles the current user may reach:
--   * their own profile (independent student, or a dependent who has a login);
--   * DEPENDENT profiles in one of their families.
--
-- Review fix: the family branch is gated on independence_status_code =
-- 'dependent'. An independent (18+) student who retains a family link is the
-- sole owner of their record — guardians do not read it. This follows the
-- approved independence rule; widening it is a product decision, not a default.
create or replace function students.current_user_student_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id
  from students.student_profiles as profile
  where profile.status_code = 'active'
    and profile.archived_at is null
    and (
      profile.user_id = identity.current_studdy_user_id()
      or (
        profile.independence_status_code = 'dependent'
        and profile.default_family_account_id in (select families.current_user_family_ids())
      )
    );
$$;

revoke all on function students.current_user_student_profile_ids() from public;
grant execute on function students.current_user_student_profile_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Family scope
-- ---------------------------------------------------------------------------

alter table families.family_accounts enable row level security;
drop policy if exists member_read_own_family_account on families.family_accounts;
create policy member_read_own_family_account
  on families.family_accounts
  for select
  to authenticated
  using (id in (select families.current_user_family_ids()));

alter table families.family_memberships enable row level security;
drop policy if exists member_read_own_family_memberships on families.family_memberships;
create policy member_read_own_family_memberships
  on families.family_memberships
  for select
  to authenticated
  using (family_account_id in (select families.current_user_family_ids()));

-- ---------------------------------------------------------------------------
-- Student scope (serves dependent and independent students identically)
-- ---------------------------------------------------------------------------

alter table students.student_profiles enable row level security;
drop policy if exists family_or_self_read_student_profiles on students.student_profiles;
create policy family_or_self_read_student_profiles
  on students.student_profiles
  for select
  to authenticated
  using (id in (select students.current_user_student_profile_ids()));

alter table students.student_subject_sections enable row level security;
drop policy if exists family_or_self_read_subject_sections on students.student_subject_sections;
create policy family_or_self_read_subject_sections
  on students.student_subject_sections
  for select
  to authenticated
  using (student_profile_id in (select students.current_user_student_profile_ids()));

alter table students.subject_section_shortlist_entries enable row level security;
drop policy if exists family_or_self_read_shortlist_entries
  on students.subject_section_shortlist_entries;
create policy family_or_self_read_shortlist_entries
  on students.subject_section_shortlist_entries
  for select
  to authenticated
  using (
    student_subject_section_id in (
      select section.id
      from students.student_subject_sections as section
      where section.student_profile_id in (select students.current_user_student_profile_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- Tutor records. Signed-in users may read publicly visible tutors (needed to
-- render shortlists and profiles in-app). Anonymous visitors get NOTHING on
-- these tables — they read the public view below instead.
-- ---------------------------------------------------------------------------

alter table tutors.tutor_profiles enable row level security;
drop policy if exists public_read_visible_tutor_profiles on tutors.tutor_profiles;
create policy public_read_visible_tutor_profiles
  on tutors.tutor_profiles
  for select
  to authenticated
  using (
    status_code in ('approved', 'active')
    and visibility_state_code in ('public_recommended', 'public_reduced')
    and archived_at is null
  );

alter table tutors.tutor_verifications enable row level security;
drop policy if exists public_read_visible_tutor_verifications on tutors.tutor_verifications;
create policy public_read_visible_tutor_verifications
  on tutors.tutor_verifications
  for select
  to authenticated
  using (
    status_code = 'active'
    and archived_at is null
    and tutor_profile_id in (
      select profile.id
      from tutors.tutor_profiles as profile
      where profile.status_code in ('approved', 'active')
        and profile.visibility_state_code in ('public_recommended', 'public_reduced')
        and profile.archived_at is null
    )
  );

alter table services.services enable row level security;
drop policy if exists public_read_published_services on services.services;
create policy public_read_published_services
  on services.services
  for select
  to authenticated
  using (status_code = 'published' and archived_at is null);

alter table services.service_versions enable row level security;
drop policy if exists public_read_current_service_versions on services.service_versions;
create policy public_read_current_service_versions
  on services.service_versions
  for select
  to authenticated
  using (
    status_code = 'current'
    and archived_at is null
    and service_id in (
      select service.id
      from services.services as service
      where service.status_code = 'published' and service.archived_at is null
    )
  );

-- Reference data: harmless to everyone, readable by everyone.
alter table platform.subjects enable row level security;
drop policy if exists anyone_read_active_subjects on platform.subjects;
create policy anyone_read_active_subjects
  on platform.subjects
  for select
  to anon, authenticated
  using (status_code = 'active');

-- ---------------------------------------------------------------------------
-- Public tutor discovery view (Database spec §15.3).
--
-- SECURITY NOTE — reviewed deliberately: this view is created WITHOUT
-- security_invoker, so it executes with its owner's privileges and its own
-- WHERE clause IS the security boundary. That is the intent: anonymous
-- visitors hold no grant on tutors.* or services.* at all, so the only way to
-- see a tutor is through this projection. The consequence is that EVERY
-- FUTURE EDIT TO THIS VIEW IS A PUBLIC-EXPOSURE CHANGE and must be reviewed
-- as one.
--
-- Approved public fields only (doc 14 §13). Deliberately absent: family name,
-- email, phone, exact availability, location, user id, and all internal
-- status/provenance codes — including source_type_code, which would reveal
-- which profiles are development seeds.
--
-- Both status_code and visibility_state_code are allow-listed, so any state
-- not named here (unlisted, restricted, suspended, existing_only, departed,
-- recommendations_paused, applicant, under_review, or anything added later)
-- is hidden rather than leaked.
-- ---------------------------------------------------------------------------

drop view if exists public.public_tutor_search;

create view public.public_tutor_search as
select distinct on (profile.id, subject.id)
  profile.reference               as tutor_reference,
  profile.public_first_name       as first_name,
  profile.headline                as headline,
  profile.teaching_approach       as teaching_approach,
  profile.year_level_from         as year_level_from,
  profile.year_level_to           as year_level_to,
  profile.offers_online           as offers_online,
  profile.offers_in_person        as offers_in_person,
  profile.availability_label_code as availability_label_code,
  profile.completed_lesson_count  as completed_lesson_count,
  profile.rating_hundredths       as rating_hundredths,
  profile.is_new_to_studdy        as is_new_to_studdy,
  subject.code                    as subject_code,
  subject.display_name            as subject_display_name,
  -- Review fix: price and currency are taken from the SAME cheapest version.
  -- Independent min() aggregates could pair a price with another version's
  -- currency and advertise an amount that exists in no service.
  cheapest.price_amount_minor     as starting_price_amount_minor,
  cheapest.currency_code          as currency_code,
  cheapest.duration_minutes       as starting_price_duration_minutes,
  coalesce(
    (
      select array_agg(verification.label_code order by verification.label_code)
      from tutors.tutor_verifications as verification
      where verification.tutor_profile_id = profile.id
        and verification.status_code = 'active'
        and verification.archived_at is null
    ),
    array[]::text[]
  )                               as verification_labels
from tutors.tutor_profiles as profile
join services.services as service
  on service.tutor_profile_id = profile.id
 and service.status_code = 'published'
 and service.archived_at is null
join platform.subjects as subject
  on subject.id = service.subject_id
 and subject.status_code = 'active'
 and subject.archived_at is null
join lateral (
  select
    version.price_amount_minor,
    version.currency_code,
    version.duration_minutes
  from services.service_versions as version
  where version.service_id = service.id
    and version.status_code = 'current'
    and version.archived_at is null
  order by version.price_amount_minor asc, version.id asc
  limit 1
) as cheapest on true
where profile.status_code in ('approved', 'active')
  and profile.visibility_state_code in ('public_recommended', 'public_reduced')
  and profile.archived_at is null
order by profile.id, subject.id, cheapest.price_amount_minor asc;

-- ---------------------------------------------------------------------------
-- Grants. SELECT only; anon reaches exactly two objects.
-- ---------------------------------------------------------------------------

grant usage on schema families to authenticated;
grant usage on schema students to authenticated;
grant usage on schema tutors to authenticated;
grant usage on schema services to authenticated;
grant usage on schema platform to anon, authenticated;

grant select on families.family_accounts to authenticated;
grant select on families.family_memberships to authenticated;
grant select on students.student_profiles to authenticated;
grant select on students.student_subject_sections to authenticated;
grant select on students.subject_section_shortlist_entries to authenticated;

-- Review fix: column-level grant on tutor_profiles. A whole-row grant would
-- hand any self-signed-up account the tutor's identity linkage (user_id) and
-- seed provenance — one free signup away from the anonymous boundary.
revoke all on tutors.tutor_profiles from authenticated;
grant select (
  id,
  reference,
  public_first_name,
  headline,
  teaching_approach,
  status_code,
  visibility_state_code,
  year_level_from,
  year_level_to,
  offers_online,
  offers_in_person,
  availability_label_code,
  completed_lesson_count,
  rating_hundredths,
  is_new_to_studdy,
  archived_at
) on tutors.tutor_profiles to authenticated;

grant select on tutors.tutor_verifications to authenticated;
grant select on services.services to authenticated;
grant select on services.service_versions to authenticated;
grant select on platform.subjects to anon, authenticated;

grant select on public.public_tutor_search to anon, authenticated;

-- Review fix: the view inherits TRUNCATE/REFERENCES/TRIGGER from Supabase's
-- default ACLs on the public schema. Harmless on a view, but strip them so
-- the grant is exactly what it claims to be.
revoke truncate, references, trigger on public.public_tutor_search from anon, authenticated;

-- Review fix: Supabase ships default privileges that auto-grant anon on
-- FUTURE objects created in the public schema. "anon reaches exactly two
-- objects" must stay true as the schema grows, so close that door now.
-- Wrapped: altering another role's defaults requires elevated rights that are
-- not guaranteed in every environment.
do $$
begin
  execute 'alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated';
exception when insufficient_privilege then
  raise notice 'skipped default-privilege revoke for role postgres (insufficient privilege)';
end $$;

do $$
begin
  execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated';
exception when insufficient_privilege or undefined_object then
  raise notice 'skipped default-privilege revoke for role supabase_admin';
end $$;
