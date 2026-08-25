-- The overlap guarantee, widened to the tutor's minimum gap between lessons.
--
-- `0005_reservation_exclusion.sql` excluded on the LESSON interval, which
-- catches only true overlap: 5:00–6:00 and 6:05–7:05 do not overlap, so both
-- were accepted however long the tutor needed between them. That constraint is
-- immutable once applied, so this file replaces it rather than editing it.
--
-- The new predicate compares `[start_at, effective_end_at)`, where
-- `effective_end_at = end_at + gap_minutes`, snapshotted onto the row when the
-- reservation is taken.
--
-- PADDED ON ONE SIDE ONLY, DELIBERATELY. Every row carries its own padding, so
-- between any two rows exactly one gap is required; padding both sides of both
-- rows would silently demand two. A lesson placed too close BEFORE an existing
-- one is still caught, by its own padding running into that lesson's start:
--
--   existing  [17:00, 18:00) + 15  ->  blocks [17:00, 18:15)
--   proposed  [18:15, 19:15) + 15  ->  blocks [18:15, 19:30)   accepted, 15 min apart
--   proposed  [18:10, 19:10) + 15  ->  blocks [18:10, 19:25)   overlaps, rejected
--   proposed  [16:00, 17:00) + 15  ->  blocks [16:00, 17:15)   overlaps, rejected
--
-- Derivation in `bookableSlots` expands reservations on BOTH sides instead.
-- That is not an inconsistency: derivation asks "may a new lesson sit here",
-- with only one row in hand and no second row's padding to rely on, so it must
-- account for both neighbours itself. The two express the same minimum
-- separation from different starting points.
--
-- The gap is per tutor and the constraint already scopes by tutor, so two
-- tutors' differing gaps never meet.

alter table availability.tutor_time_reservations
  drop constraint if exists tutor_time_reservations_no_overlap;

alter table availability.tutor_time_reservations
  add constraint tutor_time_reservations_no_overlap
  exclude using gist (
    tutor_profile_id with =,
    tstzrange(start_at, effective_end_at, '[)') with &&
  )
  where (status_code = 'active');
