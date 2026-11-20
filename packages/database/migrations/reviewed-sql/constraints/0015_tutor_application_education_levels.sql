-- Existing revision values are years 1–13. Extend the existing constraint to
-- ordered education levels: 0 = preschool/Pre-K; 1–13 = school years;
-- 14–17 = university years 1–4; 18 = postgraduate.
-- This preserves the integer storage and existing year-level values.
alter table tutors.tutor_application_revisions
  drop constraint if exists tutor_application_revision_years_check;
alter table tutors.tutor_application_revisions
  add constraint tutor_application_revision_years_check
  check (year_level_from between 0 and 18
     and year_level_to between 0 and 18
     and year_level_from <= year_level_to);
