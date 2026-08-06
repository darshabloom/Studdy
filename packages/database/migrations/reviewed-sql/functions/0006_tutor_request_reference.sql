-- Non-correlatable public references for Tutor Requests.
--
-- PROBLEM. Every reference previously drew from `platform.global_reference_seq`.
-- Because a fan-out writes its ILR and its Tutor Requests in one transaction
-- with nothing else consuming the sequence, the numbers came out contiguous:
-- LR-10000490 was followed by TREQ-10000491 / 10000492 / 10000493. That gives
-- two correlation channels:
--
--   1. anyone holding an LR- reference can derive the TREQ- references, and
--      the gap between them reveals the fan-out size;
--   2. two tutors comparing their own TREQ- references can tell they were
--      invited to the same request from the adjacency alone.
--
-- Relying on "the LR- reference never reaches a tutor" is a policy, not a
-- control, and channel 2 does not depend on that policy at all.
--
-- FIX. Tutor Request references become random rather than sequential. The
-- reference carries no ordering information, so neither channel exists.
-- Everything else keeps the global sequence (Database spec §3): only the
-- Tutor Request — the one entity a tutor holds a reference to — changes.
--
-- Crockford base32 without I, L, O and U, so a reference can be read aloud
-- and transcribed without ambiguity. 10 characters over a 32-symbol alphabet
-- is ~50 bits; the unique constraint on the column catches any collision.

create or replace function bookings.generate_tutor_request_reference()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  result text := '';
  bytes bytea;
  index_value integer;
begin
  -- pgcrypto is installed into the `extensions` schema by Supabase.
  bytes := extensions.gen_random_bytes(10);
  for position_index in 0..9 loop
    index_value := (get_byte(bytes, position_index) % 32) + 1;
    result := result || substr(alphabet, index_value, 1);
  end loop;
  return 'TREQ-' || result;
end;
$$;

revoke all on function bookings.generate_tutor_request_reference() from public;

alter table bookings.tutor_requests
  alter column reference set default bookings.generate_tutor_request_reference();
