-- Backfill: give every ALREADY-CONFIRMED lesson its Booking row.
--
-- Before this migration a confirmed booking was a convention — a request at
-- `fulfilled`, a reservation at `booking_confirmed`, a succeeded payment. This
-- turns each such triple into the durable entity, from the snapshots those rows
-- already hold, so nothing confirmed before the table existed is left without
-- one.
--
-- IDEMPOTENT on `selected_tutor_request_id`, and it only ever INSERTS: it never
-- reads a booking back to update it. Rows confirmed after this migration are
-- written by the fulfilment transaction itself.
--
-- A fulfilled request with no succeeded payment or no confirmed reservation is
-- not a booking this migration can honestly describe, so it is skipped rather
-- than guessed at.

insert into bookings.bookings (
  intended_lesson_request_id,
  selected_tutor_request_id,
  payment_id,
  reservation_id,
  student_profile_id,
  student_subject_section_id,
  tutor_profile_id,
  family_account_id,
  booked_by_user_id,
  service_version_id,
  subject_id,
  status_code,
  confirmed_at,
  scheduled_start_at,
  scheduled_end_at,
  duration_minutes,
  iana_time_zone,
  local_date,
  local_start_time,
  lesson_format_code,
  currency_code,
  lesson_amount_minor,
  total_charged_minor,
  platform_fee_amount_minor,
  tutor_entitlement_minor
)
select
  p.intended_lesson_request_id,
  p.tutor_request_id,
  p.id,
  r.id,
  sss.student_profile_id,
  ilr.student_subject_section_id,
  p.tutor_profile_id,
  p.family_account_id,
  p.payer_user_id,
  p.service_version_id,
  sss.subject_id,
  'confirmed',
  coalesce(p.succeeded_at, p.updated_at),
  r.start_at,
  r.end_at,
  ilr.duration_minutes,
  ilr.time_zone,
  (r.start_at at time zone ilr.time_zone)::date,
  (r.start_at at time zone ilr.time_zone)::time,
  ilr.format_code,
  p.currency_code,
  p.lesson_amount_minor,
  p.total_charged_minor,
  p.platform_fee_amount_minor,
  p.tutor_entitlement_minor
from payments.payments p
join bookings.intended_lesson_requests ilr on ilr.id = p.intended_lesson_request_id
join students.student_subject_sections sss on sss.id = ilr.student_subject_section_id
join availability.tutor_time_reservations r
  on r.tutor_request_id = p.tutor_request_id
 and r.status_code = 'active'
 and r.reservation_type_code = 'booking_confirmed'
where p.status_code = 'succeeded'
  and p.refund_required_at is null
  and ilr.status_code = 'fulfilled'
on conflict (selected_tutor_request_id) do nothing;
