-- Append-only Tutor Application v2 submission history.
-- Staff decisions refer to a particular immutable revision number.
create or replace function tutors.prevent_v2_submission_change()
returns trigger language plpgsql
set search_path = pg_catalog, tutors
as $$
begin
  raise exception 'Tutor Application v2 submitted revisions are immutable';
end;
$$;

create trigger tutor_application_v2_revisions_immutable
before update or delete on tutors.tutor_application_v2_revisions
for each row execute function tutors.prevent_v2_submission_change();
