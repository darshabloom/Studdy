import { ParentShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Chip,
  Confirmed,
  DemoButton,
  DemoNote,
  Disc,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
  PayChip,
} from '@/components/demo/kit';
import { JACOB, STACEY, money, serviceById } from '@/lib/demo/fixtures';
import { familyWeekBlocks, withPaid } from '@/lib/demo/schedule';
import { chosenTimes, intervalLabel, rebookStory } from '@/lib/demo/stories';

export const metadata = { title: 'This lesson is booked' };

/**
 * THE END OF THE LIFECYCLE, and the first screen allowed to say the lesson is
 * booked.
 *
 * In the product this state is rendered from the request's own `fulfilled`
 * status — the authoritative record that a payment succeeded — and never from
 * anything the browser observed.
 *
 * THE SAME LESSON, NOT A NEW ONE. Stacey accepted an hour, the family owed for
 * it, and this screen is that hour settled. Every link out of here carries
 * `?paid=1`, so the dashboard the viewer returns to shows the extra session as
 * paid rather than still demanding money for something they have just bought.
 * That flag is the demo's entire state, and it lives in the URL.
 *
 * The solid forest block on the calendar is THE SAME LESSON Stacey sees on her
 * own side, computed once in `schedule.ts`. That is the point of the whole
 * demo: one lesson, two sides, and they cannot disagree.
 */
export default async function RebookBookedPage({
  searchParams,
}: {
  searchParams: Promise<{ time?: string | string[] }>;
}) {
  const { time } = await searchParams;
  const now = new Date();
  const story = rebookStory(now, chosenTimes(time));
  const settled = (href: string) => withPaid(href, true);
  /*
   * THE FAMILY PROJECTION, not the tutor's.
   *
   * Priya is looking at Stacey's week. She may see Jacob's lessons and her own
   * new booking; every other family's lesson is real, occupies the hour, and is
   * labelled `Booked`. Using the tutor projection here is exactly the mistake
   * that put another child's name on this screen once already.
   */
  const blocks = familyWeekBlocks(story.week.days, now, JACOB.slug, {
    extraLesson: {
      at: story.accepted,
      durationMinutes: story.durationMinutes,
      label: JACOB.firstName,
    },
  });

  return (
    <ParentShell active="/demo/parent" paid>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {story.reference}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Booked
          </h1>
          <p className="mt-1.5 text-[13.5px] text-text-muted">
            An extra session for {JACOB.firstName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="committed">Confirmed</Chip>
          <PayChip payment="paid" />
        </div>
      </header>

      <div className="mt-6">
        <Confirmed title={intervalLabel(story.accepted, story.durationMinutes)}>
          {STACEY.firstName} has this time reserved for {JACOB.firstName}. Your payment went through
          and nothing else is needed from you.
        </Confirmed>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel>
          <PanelHead title="The lesson" />
          <PanelBody>
            <div className="flex items-center gap-3">
              <Disc initials={STACEY.initials} />
              <div className="min-w-0">
                <p className="font-display text-[17px] font-medium leading-tight text-text-primary">
                  {STACEY.firstName}
                </p>
                <p className="mt-0.5 text-[12.5px] text-text-muted">
                  {serviceById(JACOB.serviceId)?.name ?? 'Maths'}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Facts>
                <Fact label="Student" value={JACOB.firstName} />
                <Fact label="When" value={intervalLabel(story.accepted, story.durationMinutes)} />
                <Fact label="Length" value={`${String(story.durationMinutes)} minutes`} />
                <Fact
                  label="Format"
                  value={story.request.format === 'online' ? 'Online' : 'In person'}
                />
                <Fact label="Paid" value={money(story.priceMinor)} strong />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        <Panel className="min-w-0">
          <PanelHead title={`${STACEY.firstName}'s week`} meta={story.week.rangeLabel} />
          <PanelBody>
            <p className="mb-4 text-[12.5px] text-text-muted">
              Your new lesson, and {JACOB.firstName}&rsquo;s standing Tuesday, on the time they took
              out of her availability.
            </p>
            <DemoCalendar
              blocks={blocks}
              dayLabels={story.week.dayLabels}
              todayIndex={story.week.todayIndex}
              pastCount={story.week.pastCount}
              size="comfortable"
              ariaLabel={`Stacey's week, ${story.week.rangeLabel}`}
              legend={{ once: true }}
            />
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-6">
        <DemoNote title="That is the rebooking journey">
          <p>
            Four screens, because everything except <em>when</em> was already known. A family with
            no tutor yet takes a longer road &mdash; and the difference is worth seeing.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <DemoButton href={settled('/demo/parent')}>Back to your family</DemoButton>
            <DemoButton href="/demo/tutor/bookings" tone="tertiary">
              See it as {STACEY.firstName}
            </DemoButton>
            <DemoButton href={settled('/demo/parent/tutors')} tone="quiet">
              Find a new tutor instead
            </DemoButton>
          </div>
        </DemoNote>
      </div>
    </ParentShell>
  );
}
