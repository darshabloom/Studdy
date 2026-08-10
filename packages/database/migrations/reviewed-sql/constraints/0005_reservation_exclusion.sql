-- Overlapping ACTIVE reservations for one tutor are made unrepresentable.
-- Drizzle cannot express EXCLUDE, so this is reviewed SQL (Database spec §9.6).
--
-- This is the guarantee that two families cannot both hold the same tutor at
-- the same time. It is enforced by the database, not by application logic:
-- concurrent inserts racing for one slot cannot both succeed — the loser
-- raises exclusion_violation (23P01), which the repository maps to a plain
-- "that time is no longer available for this tutor" outcome.
--
-- The predicate covers only active holds, so released reservations never
-- block a later request for the same slot.

alter table availability.tutor_time_reservations
  add constraint tutor_time_reservations_no_overlap
  exclude using gist (
    tutor_profile_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status_code = 'active');
