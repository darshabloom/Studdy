-- SC-62: v2 applicant snapshot is restricted personal data.
-- Applied after generated Drizzle migration creates the table.
alter table tutors.tutor_application_v2_revisions enable row level security;
revoke all on tutors.tutor_application_v2_revisions from anon, authenticated;

-- No browser RLS policy. Applicants and reviewers use authenticated
-- server projections scoped to their own user or a verified staff role.
