import { redirect } from 'next/navigation';
import { EmptyState } from '@studdy/design-system';
import { BookingShell } from '@/components/booking/booking-shell';
import { TimePicker } from '@/components/booking/time-picker';
import { bookingAvailability } from '@/lib/booking/availability';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
import { summaryRows } from '@/lib/booking/summary';
import { bookingIntervalLabel } from '@/lib/booking/time-labels';
import { resolveBooking, stepIsReachable } from '@/lib/booking/resolve';
import { AVAILABILITY_WINDOW_DAYS } from '@/lib/time';

export const metadata = { title: 'When would suit?' };

export default async function BookTimesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const booking = await resolveBooking(raw);
  if (booking === null) redirect('/sign-in?next=%2Fbook');
  if (!stepIsReachable('times', booking.nextStep)) {
    redirect(bookingHref(booking.nextStep, booking.params));
  }

  const { tutor, version, format, params } = booking;
  if (tutor === null || version === null || format === null) {
    redirect(bookingHref(booking.nextStep, booking.params));
  }

  const availability = await bookingAvailability(booking);
  if (availability === null) {
    return (
      <BookingShell
        step="times"
        params={params}
        rows={summaryRows(booking)}

        title="When would suit?"
      >
        <EmptyState
          title="Those times could not be worked out"
          description="Go back a step and try again."
        />
      </BookingShell>
    );
  }

  const base = {
    child: params.child,
    subject: params.subject,
    tutor: params.tutor,
    version: params.version,
    format,
  };
  /*
   * The chip a chosen time becomes carries the whole INTERVAL, not the start.
   *
   * On the grid a marker reads `4:15` because the heading has just said how
   * long the lesson is. A chip sits below that heading in its own box and gets
   * read on its own, so it says `4:15–5:15 pm` — the thing actually being
   * asked for. The tutor's minimum gap is deliberately not in it.
   */
  const labelFor = Object.fromEntries(
    availability.slots.map((slot) => [
      slot.startAt.toISOString(),
      bookingIntervalLabel(slot.startAt, version.durationMinutes),
    ]),
  );

  return (
    <BookingShell
      step="times"
      params={params}
      rows={summaryRows(booking)}

      title={`When would suit for ${String(version.durationMinutes)} minutes with ${tutor.firstName}?`}
      description={`${format === 'online' ? 'Online' : 'In person'}, shown in New Zealand time. ${tutor.firstName} still has to accept — this is a request, not a booking.`}
    >
      <TimePicker
        tutorName={tutor.firstName}
        blocks={availability.blocks}
        window={availability.window}
        dayLabels={availability.dayLabels}
        rangeLabel={availability.rangeLabel}
        summary={availability.summary}
        todayIndex={availability.todayIndex}
        previousHref={
          availability.hasPrevious
            ? bookingHref('times', { ...base, week: availability.page - 1 })
            : null
        }
        nextHref={
          availability.hasNext
            ? bookingHref('times', { ...base, week: availability.page + 1 })
            : null
        }
        horizonDays={AVAILABILITY_WINDOW_DAYS}
        lessonLengthLabel={`Lessons are ${String(version.durationMinutes)} minutes long.`}
        chosen={params.times}
        labelFor={labelFor}
        reviewHref={bookingHref('review', base)}
      />
    </BookingShell>
  );
}
