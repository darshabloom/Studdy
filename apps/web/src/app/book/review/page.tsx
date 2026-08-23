import { redirect } from 'next/navigation';
import { Alert, Card } from '@studdy/design-system';
import { BookingShell } from '@/components/booking/booking-shell';
import { ReviewForm } from '@/components/booking/review-form';
import { bookingAvailability, stillBookable } from '@/lib/booking/availability';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
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

function money(amountMinor: bigint, currencyCode: string): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: currencyCode }).format(
    Number(amountMinor) / 100,
  );
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
  const availability = await bookingAvailability(booking);
  const stillFree = availability === null ? times : stillBookable(times, availability.slots);
  const lost = times.filter((at) => !stillFree.some((free) => free.getTime() === at.getTime()));

  return (
    <BookingShell
      step="review"
      nextStep={booking.nextStep}
      params={params}
      skipped={formats.length === 1 ? ['format'] : []}
      title="Check this over before you send"
      description={`Nothing is booked yet. ${tutor.firstName} will be asked, and can accept one of your times or decline.`}
    >
      <Card className="flex flex-col gap-0 p-0">
        <dl className="divide-y divide-surface-border">
          {[
            { label: 'Student', value: student.preferredName },
            { label: 'Subject', value: subject.displayName },
            { label: 'Tutor', value: tutor.firstName },
            {
              label: 'Lesson',
              value: `${String(version.durationMinutes)} minutes · ${money(version.priceAmountMinor, version.currencyCode)}`,
            },
            { label: 'Format', value: format === 'online' ? 'Online' : 'In person' },
          ].map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <dt className="text-sm text-text-muted">{row.label}</dt>
              <dd className="text-right font-medium text-text-primary">{row.value}</dd>
            </div>
          ))}
          <div className="px-5 py-3">
            <dt className="text-sm text-text-muted">
              {stillFree.length === 1 ? 'Time you are asking about' : 'Times you are asking about'}
            </dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {stillFree.map((at) => (
                <span
                  key={at.toISOString()}
                  className="rounded-[var(--radius-pill)] border border-brand-purple/40 bg-brand-lavender px-3 py-1 text-sm font-medium tabular-nums text-brand-purple-deep"
                >
                  {timeLabel(at)}
                </span>
              ))}
            </dd>
          </div>
        </dl>
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
