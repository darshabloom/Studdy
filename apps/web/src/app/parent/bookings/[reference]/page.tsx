import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button, StatusBadge } from '@studdy/design-system';
import {
  PageHeader,
  Panel,
  Quiet,
  TextLink,
  lessonDay,
  lessonTimeRange,
} from '@/components/parent/kit';
import { formatMoney } from '@/components/requests/request-status';
import { loadFamilyOverview } from '@/lib/parent/load';
import { bookingStatus, formatLabel, paymentStatus } from '@/lib/parent/overview';

export const metadata = { title: 'Booking' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary">{children}</dd>
    </div>
  );
}

export default async function BookingPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const overview = await loadFamilyOverview();
  if (overview === null) redirect('/sign-in?next=%2Fparent%2Fbookings');

  // Found among this family's own bookings or not at all.
  const booking = overview.bookings.find((entry) => entry.reference === reference);
  if (booking === undefined) notFound();

  const now = new Date();
  const status = bookingStatus(booking, now);
  const payment = overview.payments.find((entry) => entry.bookingReference === booking.reference);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <TextLink href="/parent/bookings">← Bookings</TextLink>
      </div>
      <PageHeader
        title={`${booking.subjectDisplayName} with ${booking.tutorFirstName}`}
        description={`${lessonDay(booking.scheduledStartAt, booking.timeZone)}, ${lessonTimeRange(booking)}`}
        action={<StatusBadge family={status.family}>{status.label}</StatusBadge>}
      />

      <Panel>
        <dl className="divide-y divide-surface-border">
          <Row label="Student">
            <Link
              href={`/parent/students/${booking.studentReference}`}
              className="font-medium text-brand-purple hover:underline"
            >
              {booking.studentPreferredName}
            </Link>
          </Row>
          <Row label="Tutor">
            <Link
              href={`/tutors/${booking.tutorReference}`}
              className="font-medium text-brand-purple hover:underline"
            >
              {booking.tutorFirstName}
            </Link>
          </Row>
          <Row label="When">
            {lessonDay(booking.scheduledStartAt, booking.timeZone)}, {lessonTimeRange(booking)} (
            {booking.durationMinutes} minutes)
          </Row>
          <Row label="Format">{formatLabel(booking.lessonFormatCode)}</Row>
          <Row label="Paid">
            {formatMoney(booking.totalChargedMinor, booking.currencyCode)}
            {payment !== undefined ? (
              <span className="text-text-secondary"> · {paymentStatus(payment).label}</span>
            ) : null}
          </Row>
          <Row label="Booking reference">
            <span className="tabular-nums">{booking.reference}</span>
          </Row>
          <Row label="Request">
            <TextLink href={`/requests/${booking.requestReference}`}>
              {booking.requestReference}
            </TextLink>
          </Row>
        </dl>
      </Panel>

      <Quiet>
        Changing or cancelling a booking cannot be done here yet. If this lesson can no longer go
        ahead, get in touch through <TextLink href="/help">Help</TextLink> and include the booking
        reference.
      </Quiet>

      <div>
        <Button variant="secondary" asChild>
          <Link href={`/book?child=${booking.studentProfileId}&tutor=${booking.tutorReference}`}>
            Book another lesson with {booking.tutorFirstName}
          </Link>
        </Button>
      </div>
    </div>
  );
}
