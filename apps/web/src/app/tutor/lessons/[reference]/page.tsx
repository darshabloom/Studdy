import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@studdy/design-system';
import { schoolYearLabel } from '@studdy/domain/students';
import { PageHeader, Panel, Quiet, TextLink, lessonDay } from '@/components/parent/kit';
import { formatMoney } from '@/components/requests/request-status';
import { TutorUnavailable, timeRange } from '@/components/tutor/kit';
import { loadTutorWorkspace } from '@/lib/tutor/load';
import { EARNING_LABELS, earningState, formatLabel, lessonStatus } from '@/lib/tutor/overview';

export const metadata = { title: 'Lesson' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary">{children}</dd>
    </div>
  );
}

export default async function TutorLessonPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const workspace = await loadTutorWorkspace();
  if (workspace === null) return <TutorUnavailable />;

  // Found among this tutor's own bookings or not at all.
  const booking = workspace.bookings.find((entry) => entry.reference === reference);
  if (booking === undefined) notFound();

  const now = new Date();
  const status = lessonStatus(booking, now);
  const earning = EARNING_LABELS[earningState(booking, now)];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <TextLink href="/tutor/lessons">← Back to Lessons</TextLink>
      </div>
      <PageHeader
        title={`${booking.subjectDisplayName} with ${booking.studentPreferredName}`}
        description={`${lessonDay(booking.scheduledStartAt, booking.timeZone)}, ${timeRange(booking)}`}
        action={<StatusBadge family={status.family}>{status.label}</StatusBadge>}
      />

      <Panel>
        <dl className="divide-y divide-surface-border">
          <Row label="Student">
            <Link
              href={`/tutor/students/${booking.studentReference}`}
              className="font-medium text-brand-purple hover:underline"
            >
              {booking.studentPreferredName}
            </Link>
            {booking.studentSchoolYearCode === null
              ? ''
              : ` · ${schoolYearLabel(booking.studentSchoolYearCode)}`}
          </Row>
          <Row label="When">
            {lessonDay(booking.scheduledStartAt, booking.timeZone)}, {timeRange(booking)} (
            {booking.durationMinutes} minutes)
          </Row>
          <Row label="Format">{formatLabel(booking.lessonFormatCode)}</Row>
          <Row label="Lesson price">
            <span className="tabular-nums">
              {formatMoney(booking.lessonAmountMinor, booking.currencyCode)}
            </span>
          </Row>
          <Row label="Studdy fee">
            <span className="tabular-nums">
              {formatMoney(booking.platformFeeAmountMinor, booking.currencyCode)}
            </span>
          </Row>
          <Row label="You earn">
            <span className="font-semibold tabular-nums">
              {formatMoney(booking.earnsMinor, booking.currencyCode)}
            </span>{' '}
            <StatusBadge family={earning.family}>{earning.label}</StatusBadge>
          </Row>
          <Row label="Booking reference">
            <span className="tabular-nums">{booking.reference}</span>
          </Row>
        </dl>
      </Panel>

      <Quiet>
        Lesson notes, attendance, homework and a summary for the family cannot be recorded on Studdy
        yet. Changing or cancelling a booked lesson is not available here either; if this lesson
        cannot go ahead, get in touch through <TextLink href="/help">Help</TextLink> with the
        booking reference.
      </Quiet>
    </div>
  );
}
