import { notFound } from 'next/navigation';
import { TutorShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Chip,
  DemoButton,
  DemoNote,
  Disc,
  EarningsSplit,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
} from '@/components/demo/kit';
import { formatDeadline } from '@/components/requests/request-status';
import { serviceById } from '@/lib/demo/fixtures';
import { demoWeek, requestBySlug, spanLabel, staceyWeekBlocks } from '@/lib/demo/schedule';
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

      {/* ── The state, said plainly, in the colour that means "a clock" ── */}
      <div className="mt-4">
        <Panel tone="attention">
          <PanelBody className="flex flex-wrap items-start gap-x-7 gap-y-5 py-5">
            <span
              aria-hidden
              className="hidden w-[3px] self-stretch rounded-full bg-status-warning sm:block"
            />
            <Disc initials={request.studentInitials} size="lg" />
            <div className="min-w-[230px] flex-1">
              <p className="text-[12.5px] text-text-muted">{request.reference}</p>
              <h1 className="mt-1 font-display text-[27px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
                Held for {request.studentFirstName}
              </h1>
              <p className="mt-1.5 text-[14px] font-medium tabular-nums text-text-primary">
                {spanLabel(accepted.at, accepted.durationMinutes)}
              </p>
              <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-text-secondary">
                This time is held, not booked. It sits on your calendar until{' '}
                {formatDeadline(holdExpiry, PLATFORM_TIME_ZONE)} &mdash; the family is choosing now,
                and the hold is released either way when it expires.
              </p>
            </div>
            <Chip tone="attention">Awaiting the family</Chip>
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead title="If this becomes a lesson" />
          <PanelBody>
            <Facts>
              <Fact
                label="Student"
                value={`${request.studentFirstName} · Year ${String(request.schoolYear)}`}
              />
              <Fact label="Service" value={serviceById(request.serviceId)?.name ?? 'Maths'} />
              <Fact label="Length" value={`${String(request.durationMinutes)} minutes`} />
              <Fact label="Format" value={request.format === 'online' ? 'Online' : 'In person'} />
            </Facts>
          </PanelBody>
        </Panel>

        <Panel tone="quiet">
          <PanelHead title="What it would pay" />
          <PanelBody>
            <EarningsSplit grossMinor={request.priceMinor} label="You would earn" />
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
              Nothing is owed to you yet. A held hour is not income until the family has paid and
              the lesson is booked.
            </p>
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel className="min-w-0">
          <PanelHead title="Your week, with the hold on it" meta={week.rangeLabel} />
          <PanelBody>
            <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              pastCount={week.pastCount}
              size="comfortable"
              ariaLabel={`Your week, ${week.rangeLabel}`}
              legend={{ held: true, once: true }}
            />
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-6 sm:mt-9">
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
