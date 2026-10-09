-- Tutor-managed services: the review record is SERVER-ONLY, and the public
-- discovery view learns two things about a tutor-built service.
--
-- ---------------------------------------------------------------------------
-- 1. services.service_reviews: no browser role reads it.
--
-- A review row names the staff member who decided and may carry their internal
-- note. `services.services` is readable by `authenticated` once a service is
-- published, which is exactly why review data was kept OUT of that table.
--
-- RLS is enabled with deliberately NO policies (deny-all for non-owners), and
-- the explicit REVOKE makes the absence of grants a stated fact rather than a
-- property of a default a later schema-wide GRANT could undo. A tutor reads the
-- message written for them through a server-side projection scoped to their own
-- profile; a reviewer reads through an action that re-checks role and MFA.
-- ---------------------------------------------------------------------------

alter table services.service_reviews enable row level security;
revoke all on services.service_reviews from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. public.public_tutor_search, re-created.
--
-- THIS IS A PUBLIC-EXPOSURE CHANGE and is reviewed as one. The view runs with
-- its owner's privileges and its WHERE clause is the security boundary; the
-- allow-lists on profile status, visibility, service status and version status
-- are UNCHANGED from rls/0003. A draft, pending, approved-but-unpublished,
-- unpublished or archived service joins nothing, so a tutor with no PUBLISHED
-- service is still absent from discovery however complete the rest is.
--
-- Two changes, both to the projected columns:
--
--   a. year_level_from / year_level_to now describe the PUBLISHED SERVICES for
--      the subject: the widest range any of them covers, each falling back to
--      the profile's range where a service states none (every seeded service).
--      A tutor who publishes "Year 9 to 10 maths" is no longer advertised for
--      their profile's whole Year 7 to 13.
--
--   b. is_example_profile is added. rls/0003 withheld source_type_code because
--      provenance codes are internal. This is not the code: it is one boolean
--      that says exactly what the interface already prints on every seeded
--      profile ("Example profile"), and it exists so that label can stop being
--      printed on real tutors. No other provenance value is exposed.
-- ---------------------------------------------------------------------------

drop view if exists public.public_tutor_search;

create view public.public_tutor_search as
select distinct on (profile.id, subject.id)
  profile.reference               as tutor_reference,
  profile.public_first_name       as first_name,
  profile.headline                as headline,
  profile.teaching_approach       as teaching_approach,
  min(coalesce(service.year_level_from, profile.year_level_from))
    over (partition by profile.id, subject.id) as year_level_from,
  max(coalesce(service.year_level_to, profile.year_level_to))
    over (partition by profile.id, subject.id) as year_level_to,
  profile.offers_online           as offers_online,
  profile.offers_in_person        as offers_in_person,
  profile.availability_label_code as availability_label_code,
  profile.completed_lesson_count  as completed_lesson_count,
  profile.rating_hundredths       as rating_hundredths,
  profile.is_new_to_studdy        as is_new_to_studdy,
  subject.code                    as subject_code,
  subject.display_name            as subject_display_name,
  -- Price and currency are taken from the SAME cheapest version (rls/0003).
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
  )                               as verification_labels,
  (profile.source_type_code = 'development_seed') as is_example_profile
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

-- Dropping the view dropped its grants. Restored exactly as rls/0003 left them.
grant select on public.public_tutor_search to anon, authenticated;
revoke truncate, references, trigger on public.public_tutor_search from anon, authenticated;
