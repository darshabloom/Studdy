import { redirect } from 'next/navigation';
import { Alert, Card } from '@studdy/design-system';
import { BookingShell } from '@/components/booking/booking-shell';
import { BookingSummary } from '@/components/booking/booking-summary';
import { ReviewForm } from '@/components/booking/review-form';
import { bookingAvailability, stillBookable } from '@/lib/booking/availability';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
import { summaryRows } from '@/lib/booking/summary';
import { resolveBooking, stepIsReachable } from '@/lib/booking/resolve';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Review your request' };

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

export default async function BookReviewPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const booking = await resolveBooking(raw);
  if (booking === null) redirect('/sign-in?next=%2Fbook');
  if (!stepIsReachable('review', booking.nextStep)) {
    redirect(bookingHref(booking.nextStep, booking.params));
  }

  const { student, subject, tutor, version, format, times, params, formats, existingSection } =
    booking;
  if (
    student === null ||
    subject === null ||
    tutor === null ||
    version === null ||
    format === null
  ) {
    redirect(bookingHref(booking.nextStep, booking.params));
  }

  // Courtesy, not correctness: the send re-derives availability inside its own
  // transaction. This exists so a family learns a time has gone here, rather
  // than from an error after pressing send.
  const rows = summaryRows(booking);
  const availability = await bookingAvailability(booking);
  const stillFree = availability === null ? times : stillBookable(times, availability.slots);
  const lost = times.filter((at) => !stillFree.some((free) => free.getTime() === at.getTime()));

  return (
    <BookingShell
      step="review"
      params={params}
      rows={rows}
      skipped={formats.length === 1 ? ['format'] : []}
      title="Check this over before you send"
      description={`Nothing is booked yet. ${tutor.firstName} will be asked, and can accept one of your times or decline.`}
    >
      {/*
       * The same summary the parent has watched grow, now finished.
       *
       * Deliberately NOT a new presentation invented for the last screen.
       * A different-looking summary at the moment of committing invites the
       * question "is this the same request?" — which is exactly the question
       * a review screen exists to answer.
       */}
      <Card>
        <h2 className="mb-1 text-sm font-semibold text-text-primary">Your request</h2>
        <BookingSummary rows={rows} current="review" params={params} bare />
      </Card>

      {lost.length > 0 ? (
        <div className="mt-4">
          {/* Says the time has gone, and nothing about why. A tutor's diary, a
              private block and ordinary time off must stay indistinguishable. */}
          <Alert tone="warning" title="One of your times is no longer available">
            {lost.map(timeLabel).join(', ')} can no longer be requested. The rest will still be
            sent, or you can{' '}
            <a
              href={bookingHref('times', {
                child: params.child,
                subject: params.subject,
                tutor: params.tutor,
                version: params.version,
                format,
                times: stillFree.map((at) => at.toISOString()),
              })}
              className="underline"
            >
              go back and pick another
            </a>
            .
          </Alert>
        </div>
      ) : null}

      {existingSection === null ? (
        <div className="mt-4">
          {/* Said out loud, before it happens. The subject really is added to
              the child by sending this — and only by sending it. */}
          <Alert tone="information" title="This will add a subject">
            {subject.displayName} will be added to {student.preferredName}&rsquo;s subjects when you
            send this request.
          </Alert>
        </div>
      ) : null}

      <div className="mt-5">
        <ReviewForm
          child={student.studentProfileId}
          subject={subject.subjectId}
          tutor={tutor.tutorReference}
          version={version.serviceVersionId}
          format={format}
          times={stillFree.map((at) => at.toISOString())}
          tutorName={tutor.firstName}
        />
      </div>
    </BookingShell>
  );
}
