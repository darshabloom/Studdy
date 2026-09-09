import { notFound } from 'next/navigation';
import { TutorShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Chip,
  DemoButton,
  DemoNote,
  Fact,
  Facts,
  PageHead,
  SectionLine,
} from '@/components/demo/kit';
import { formatDeadline, formatLessonDateTime } from '@/components/requests/request-status';
import { money, serviceById } from '@/lib/demo/fixtures';
import { demoWeek, requestBySlug, staceyWeekBlocks } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'You accepted this time' };

/**
 * ACCEPTED, AND HELD — which is not the same as booked.
 *
 * This is the state the product is most easily misread in, so the screen says
 * the quiet part out loud: the family still has to choose this tutor and then
 * pay, the hold has an expiry, and it is released either way when that expiry
 * passes.
 *
 * Deliberately NOT the confirmed treatment. The solid forest panel is reserved
 * for a lesson that is actually booked; a hold gets clay, because what defines
 * it is that a clock is running.
 */
export default async function TutorAcceptedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ time?: string }>;
}) {
  const { slug } = await params;
  const { time } = await searchParams;
  const now = new Date();
  const request = requestBySlug(slug, now);
  if (request === null) notFound();

  // Anything unrecognised falls back to the first offered time rather than
  // erroring — a hand-edited URL should not be able to break a demo somebody
  // is presenting from.
  const accepted =
    request.offered.find((option) => option.at.toISOString() === time) ?? request.offered[0];
  if (accepted === undefined) notFound();

  const week = demoWeek(now, { dayCount: 7 });
  const blocks = staceyWeekBlocks(week.days, now, { includeHolds: true });
  const holdExpiry = new Date(accepted.at.getTime() - 12 * 60 * 60 * 1000);

  return (
    <TutorShell active="/demo/tutor/requests">
      <DemoButton href={`/demo/tutor/requests/${request.slug}`} tone="quiet" size="sm">
        &larr; Back to the request
      </DemoButton>

      <div className="mt-4">
        <p className="text-[12.5px] text-text-muted">{request.reference}</p>
        <PageHead
          title={`Held for ${request.studentFirstName}`}
          sub={formatLessonDateTime(accepted.at, PLATFORM_TIME_ZONE)}
          action={<Chip tone="attention">Awaiting the family</Chip>}
        />
      </div>

      <div className="mt-6 border-l-2 border-status-warning bg-status-warning-bg px-5 py-4">
        <p className="text-[13.5px] font-semibold text-status-warning">
          This time is held, not booked
        </p>
        <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-text-primary">
          It sits on your calendar until {formatDeadline(holdExpiry, PLATFORM_TIME_ZONE)}. The
          family is choosing now &mdash; this may or may not become a booking, and the hold is
          released either way when it expires.
        </p>
      </div>

      <section className="mt-8">
        <SectionLine title="If this becomes a lesson" />
        <div className="mt-3 max-w-md">
          <Facts>
            <Fact label="Student" value={`${request.studentFirstName} · Year ${String(request.schoolYear)}`} />
            <Fact label="Service" value={serviceById(request.serviceId)?.name ?? 'Maths'} />
            <Fact label="Length" value={`${String(request.durationMinutes)} minutes`} />
            <Fact label="Format" value={request.format === 'online' ? 'Online' : 'In person'} />
            <Fact label="You would be paid" value={money(request.priceMinor)} strong />
          </Facts>
        </div>
      </section>

      <section className="mt-9">
        <SectionLine title="Your week, with the hold on it" meta={week.rangeLabel} />
        <div className="mt-4">
          <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              pastCount={week.pastCount}
              size="comfortable"
              ariaLabel={`Your week, ${week.rangeLabel}`}
              legend={{ held: true, once: true }}
            />
        </div>
      </section>

      <div className="mt-9">
        <DemoNote title="Now the family pays">
          <p>
            {request.parentName} chooses you, pays, and Studdy confirms the booking. In the real
            product a Stripe webhook does that &mdash; you are not waiting on anybody to press
            anything.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <DemoButton href="/demo/tutor/bookings">See it as a confirmed booking</DemoButton>
            <DemoButton href="/demo/parent/rebook/pay" tone="quiet">
              Watch the parent pay
            </DemoButton>
          </div>
        </DemoNote>
      </div>
    </TutorShell>
  );
}
