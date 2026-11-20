-- Reference catalogue only. Do not seed fake tutor or student identities.
-- Previously this catalogue existed only inside the local demo seed, leaving
-- a newly provisioned shared Studdy project with no selectable subjects.
-- Values are stable codes used by tutoring services and application review.
insert into platform.subjects (code, display_name, sort_order)
values
  ('mathematics', 'Mathematics', 10),
  ('english', 'English', 20),
  ('science', 'Science', 30),
  ('calculus', 'Calculus', 40),
  ('physics', 'Physics', 50),
  ('chemistry', 'Chemistry', 60),
  ('biology', 'Biology', 70)
on conflict (code) do nothing;
