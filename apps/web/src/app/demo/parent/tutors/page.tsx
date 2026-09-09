import { ParentShell } from '@/components/demo/demo-shells';
import { Aside, Chip, PageHead, SectionLine } from '@/components/demo/kit';
import { DemoTutorCard } from '@/components/demo/demo-tutor-card';
import { familyCalendarWindow } from '@/lib/availability/calendar-projection';
import { JACOB, PHYSICS_TUTORS, STACEY } from '@/lib/demo/fixtures';
import { demoWeek } from '@/lib/demo/schedule';
import { tutorBands } from '@/lib/demo/stories';

export const metadata = { title: 'Find a tutor' };

/**
 * DISCOVERY — the long road, and deliberately so.
 *
 * Priya already has a tutor. She is here because Jacob needs PHYSICS, which
 * Stacey does not teach, so this is a genuine cold search by somebody who
 * already trusts the product. That is what keeps one family across both
 * journeys instead of inventing a second parent, and it is why Stacey correctly
 * never appears in these results.
 *
 * The calendars share ONE vertical window, widened across every card at once by
 * the production `familyCalendarWindow`. Fitted per card, the same height would
 * mean a different hour on each and the cards could not be compared — which is
 * the only reason they carry calendars.
 */
export default function DiscoveryPage() {
  const now = new Date();
  const week = demoWeek(now);
  const cards = PHYSICS_TUTORS.map((tutor) => ({
    tutor,
    blocks: tutorBands(tutor, week.days, now),
  }));
  const sharedWindow = familyCalendarWindow(cards.flatMap((card) => [...card.blocks]));

  return (
    <ParentShell active="/demo/parent/tutors">
      <PageHead
        eyebrow="A subject Stacey does not teach"
        title="Find a Physics tutor"
        sub={`For ${JACOB.firstName} · Year ${String(JACOB.schoolYear)} · NCEA Level 1`}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-text-muted">Filtered to</span>
        <Chip tone="current">Physics</Chip>
        <Chip tone="current">Year {JACOB.schoolYear}</Chip>
        <Chip tone="ghost">Any format</Chip>
        <Chip tone="ghost">Any price</Chip>
      </div>

      <section className="mt-8">
        <SectionLine title="Available tutors" meta={`${PHYSICS_TUTORS.length}`} />
        <div className="mt-6 grid gap-x-8 gap-y-10 lg:grid-cols-2">
          {cards.map(({ tutor, blocks }) => (
            <DemoTutorCard
              key={tutor.slug}
              tutor={tutor}
              blocks={blocks}
              window={sharedWindow}
              // Weekday only: a card divides its width by seven, which leaves
              // no room for a date, and the range beside the calendar names it.
              dayLabels={week.dayLabels.map((label) => label.slice(0, 3))}
              rangeLabel={week.rangeLabel}
              todayIndex={week.todayIndex}
            />
          ))}
        </div>
      </section>

      <div className="mt-10">
        <Aside title={`Why ${STACEY.firstName} is not here`}>
          She teaches Maths and Calculus only. Studdy shows the tutors who actually cover the
          subject you asked for, rather than everyone you have worked with before.
        </Aside>
      </div>
    </ParentShell>
  );
}
