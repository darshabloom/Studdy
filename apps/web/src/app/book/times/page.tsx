import { redirect } from 'next/navigation';
import { EmptyState } from '@studdy/design-system';
import { BookingShell } from '@/components/booking/booking-shell';
import { TimePicker } from '@/components/booking/time-picker';
import { bookingAvailability } from '@/lib/booking/availability';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
import { resolveBooking, stepIsReachable } from '@/lib/booking/resolve';
import { AVAILABILITY_WINDOW_DAYS, PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'When would suit?' };

/** 'Tue 26 Aug, 4:00 pm' — enough to recognise a time out of context. */
function timeLabel(at: Date): string {
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PLATFORM_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(at)
    .replace(',', '');
}

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

  const { tutor, version, format, params, formats } = booking;
  if (tutor === null || version === null || format === null) {
    redirect(bookingHref(booking.nextStep, booking.params));
  }

  const availability = await bookingAvailability(booking);
  if (availability === null) {
    return (
      <BookingShell
        step="times"
        nextStep={booking.nextStep}
        params={params}
        skipped={formats.length === 1 ? ['format'] : []}
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
  const labelFor = Object.fromEntries(
    availability.slots.map((slot) => [slot.startAt.toISOString(), timeLabel(slot.startAt)]),
  );

  return (
    <BookingShell
      step="times"
      nextStep={booking.nextStep}
      params={params}
      skipped={formats.length === 1 ? ['format'] : []}
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
