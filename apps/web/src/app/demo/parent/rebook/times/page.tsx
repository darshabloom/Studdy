import { WeekCalendar } from '@studdy/design-system';
import { ParentShell } from '@/components/demo/demo-shells';
import { Aside, DemoButton, DemoNote, PageHead, SectionLine } from '@/components/demo/kit';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { JACOB, STACEY } from '@/lib/demo/fixtures';
import { rebookStory, rebookStarts, standingSlotLabel, intervalLabel } from '@/lib/demo/stories';

export const metadata = { title: 'When would suit?' };

/**
 * CHOOSING A TIME, with the standing lesson explained rather than hidden.
 *
 * Jacob's usual Tuesday at four does not appear as bookable, and the reason is
 * the whole point: IT IS ALREADY HIS. A picker that silently omitted it would
 * look like the tutor was busy; saying so turns an absence into a fact about
 * the relationship.
 *
 * Every block is one START. A four o'clock lesson and a half past four one are
 * different things to choose between, and merging them into bands would erase
 * exactly the distinction this screen exists to make.
 */
export default function RebookTimesPage() {
  const now = new Date();
  const story = rebookStory(now);
  const starts = rebookStarts(now);
  const blocks = starts.map((start) => start.block);
  const standing = standingSlotLabel(now);

  const chosen = story.request.offered.map((option) => option.at);

  return (
    <ParentShell active="/demo/parent">
      <DemoButton href="/demo/parent/rebook" tone="quiet" size="sm">
        &larr; Back
      </DemoButton>

      <div className="mt-4">
        <PageHead
          eyebrow="Book another lesson"
          title={`When could ${STACEY.firstName} teach ${JACOB.firstName}?`}
          sub={`${story.week.rangeLabel} · shown in New Zealand time`}
        />
      </div>

      {standing === null ? null : (
        <div className="mt-6">
          <Aside title={`Your usual time is already ${JACOB.firstName}’s`}>
            {standing} is his weekly lesson, so it is not free to book again. Everything below is
            what {STACEY.firstName} has left this week.
          </Aside>
        </div>
      )}

      <section className="mt-7">
        <SectionLine
          title={`${STACEY.firstName}’s remaining time`}
          meta={`${starts.length} start times`}
        />
        <p className="mt-3 text-[13.5px] text-text-muted">
          Each block is a time the lesson could start. Lessons are {story.durationMinutes} minutes
          long.
        </p>
        <div className="mt-4">
          <WeekCalendar
            blocks={blocks}
            window={profileCalendarWindow(blocks)}
            dayLabels={story.week.dayLabels}
            hourHeight={112}
            familySafe
            ariaLabel={`Bookable times for ${STACEY.firstName}, ${story.week.rangeLabel}`}
            {...(story.week.todayIndex >= 0
              ? { now: { dayIndex: story.week.todayIndex, minutes: 9 * 60 } }
              : {})}
          />
        </div>
      </section>

      <section className="mt-8">
        <SectionLine title="The times you are offering" meta={`${chosen.length}`} />
        <ul className="mt-3 flex flex-col gap-2">
          {chosen.map((at) => (
            <li
              key={at.toISOString()}
              className="flex items-center gap-3 rounded-[4px] border border-brand bg-brand-tint px-4 py-2.5 text-[14px] font-medium tabular-nums text-brand-strong"
            >
              {intervalLabel(at, story.durationMinutes)}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-text-muted">
          These are alternatives &mdash; {STACEY.firstName} will accept at most one.
        </p>
      </section>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <DemoButton href="/demo/parent/rebook/review" size="lg">
          Continue
        </DemoButton>
        <p className="text-[13.5px] text-text-secondary">Nothing is sent until you review it.</p>
      </div>

      <div className="mt-9">
        <DemoNote title="Two times are chosen for you">
          So the story can continue. In the product you would pick these off the calendar above.
        </DemoNote>
      </div>
    </ParentShell>
  );
}
