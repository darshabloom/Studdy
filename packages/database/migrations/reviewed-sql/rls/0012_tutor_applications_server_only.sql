-- Tutor applications: SERVER-ONLY.
--
-- These tables hold legal names, a phone number and the email addresses of the
-- applicant's referees: personal data about people who are not even Studdy
-- users. No browser role has any business reading any of it. A column grant is
-- per DATABASE ROLE, and every signed-in person authenticates as `authenticated`,
-- so no grant could show an applicant their own application while hiding
-- another's — the role would receive the union.
--
-- An applicant reads their own application through a server-side projection
-- scoped by their user id; a reviewer reads it through a server action that
-- re-checks their role and MFA. Neither goes through these tables' grants.
--
-- RLS is enabled with deliberately NO policies: deny-all for non-owners, the
-- fail-closed layer beneath the absent grants. The explicit REVOKEs make the
-- absence of grants a stated fact rather than a property of a default that a
-- later schema-wide GRANT could undo.

alter table tutors.tutor_applications enable row level security;
alter table tutors.tutor_application_revisions enable row level security;
alter table tutors.tutor_application_revision_subjects enable row level security;
alter table tutors.tutor_application_revision_references enable row level security;
alter table tutors.tutor_application_checks enable row level security;

revoke all on tutors.tutor_applications from anon, authenticated;
revoke all on tutors.tutor_application_revisions from anon, authenticated;
revoke all on tutors.tutor_application_revision_subjects from anon, authenticated;
revoke all on tutors.tutor_application_revision_references from anon, authenticated;
revoke all on tutors.tutor_application_checks from anon, authenticated;
