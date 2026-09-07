import { WeekCalendar } from '@studdy/design-system';
import { ParentShell } from '@/components/demo/demo-shells';
import { JourneyProgress } from '@/components/demo/demo-journey';
import { DemoButton, DemoNote, PageHead, SectionLine } from '@/components/demo/kit';
import { profileCalendarWindow } from '@/lib/availability/calendar-projection';
import { JACOB } from '@/lib/demo/fixtures';
import { discoveryStory, intervalLabel, tutorBands } from '@/lib/demo/stories';

export const metadata = { title: 'When could the lesson be?' };

/**
 * Every block is ONE START. A four o'clock lesson and a half past four one are
 * different things to choose between, and merging them into bands would erase
 * exactly the distinction this screen exists to make.
 */
export default function FindTimesPage() {
  const now = new Date();
  const story = discoveryStory(now);
  const blocks = tutorBands(story.tutor, story.week.days, now);

  return (
    <ParentShell active="/demo/parent/tutors">
      <JourneyProgress current="times" />
      <div className="mt-6">
        <PageHead
          eyebrow="Step 3 of 3"
          title={`When could ${story.tutor.firstName} teach ${JACOB.firstName}?`}
          sub="Offer more than one time and you are far more likely to get a lesson — the tutor accepts whichever fits their week."
        />
      </div>

      <section className="mt-7">
        <SectionLine title="His bookable time" meta={story.week.rangeLabel} />
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
            ariaLabel={`Bookable times for ${story.tutor.firstName}, ${story.week.rangeLabel}`}
            {...(story.week.todayIndex >= 0
              ? { now: { dayIndex: story.week.todayIndex, minutes: 9 * 60 } }
              : {})}
          />
        </div>
      </section>

      <section className="mt-8">
        <SectionLine title="The times you are offering" meta={`${story.offered.length}`} />
        <ul className="mt-3 flex flex-col gap-2">
          {story.offered.map((at) => (
            <li
              key={at.toISOString()}
              className="rounded-[4px] border border-brand bg-brand-tint px-4 py-2.5 text-[14px] font-medium tabular-nums text-brand-strong"
            >
              {intervalLabel(at, story.durationMinutes)}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-text-muted">
          These are alternatives &mdash; {story.tutor.firstName} will accept at most one.
        </p>
      </section>

      <div className="mt-7">
        <DemoButton href="/demo/parent/find/review" size="lg">
          Continue
        </DemoButton>
      </div>

      <div className="mt-9">
        <DemoNote title="Two times are chosen for you">
          So the story can continue. In the product you would pick these off the calendar above.
        </DemoNote>
      </div>
    </ParentShell>
  );
}
