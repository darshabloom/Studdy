import { ParentShell } from '@/components/demo/demo-shells';
import { Aside, CardsHead, Chip, Panel, PanelBody } from '@/components/demo/kit';
import { DemoTutorCard } from '@/components/demo/demo-tutor-card';
import { JACOB, PHYSICS_TUTORS, STACEY } from '@/lib/demo/fixtures';
import { demoWeek, isPaid } from '@/lib/demo/schedule';
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
 * FOUR CARDS THAT CAN BE COMPARED. Each one carries a seven-day strip rather
 * than a calendar: the question at this stage is which of these people could
 * teach Jacob on the days the family is free, and four embedded week grids
 * answered a more precise question at four times the height. The profile behind
 * each card still carries the full calendar, which is where the exact hour
 * actually gets chosen.
 */
export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid: paidParam } = await searchParams;
  const paid = isPaid(paidParam);
  const now = new Date();
  const week = demoWeek(now);

  const cards = PHYSICS_TUTORS.map((tutor) => ({
    tutor,
    // Which columns of this week he has anything free in at all. Derived from
    // the same bookable-start projection the profile calendar draws, so the
    // strip cannot promise a day the calendar then shows as empty.
    openDayIndexes: [
      ...new Set(tutorBands(tutor, week.days, now).map((block) => block.dayIndex)),
    ].sort((a, b) => a - b),
  }));

  return (
    <ParentShell active="/demo/parent/tutors" paid={paid}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            A subject {STACEY.firstName} does not teach
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
            Find a Physics tutor
          </h1>
          <p className="mt-1.5 text-[13.5px] text-text-muted">
            For {JACOB.firstName} &middot; Year {JACOB.schoolYear} &middot; NCEA Level 1
          </p>
        </div>
      </header>

      {/* The search, as something that was actually asked. */}
      <div className="mt-6">
        <Panel tone="quiet">
          <PanelBody className="flex flex-wrap items-center gap-2 py-3">
            <span className="text-[12.5px] text-text-muted">Filtered to</span>
            <Chip tone="current">Physics</Chip>
            <Chip tone="current">Year {JACOB.schoolYear}</Chip>
            <Chip tone="ghost">Any format</Chip>
            <Chip tone="ghost">Any price</Chip>
            <span className="ml-auto text-[12.5px] tabular-nums text-text-muted">
              {week.rangeLabel}
            </span>
          </PanelBody>
        </Panel>
      </div>

      <section className="mt-7">
        <CardsHead
          title="Available tutors"
          meta={`${String(PHYSICS_TUTORS.length)} match your search`}
        />
        <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
          {cards.map(({ tutor, openDayIndexes }) => (
            <DemoTutorCard
              key={tutor.slug}
              tutor={tutor}
              openDayIndexes={openDayIndexes}
              dayLabels={week.dayLabels}
              rangeLabel={week.rangeLabel}
            />
          ))}
        </div>
      </section>

      <div className="mt-8">
        <Aside title={`Why ${STACEY.firstName} is not here`}>
          She teaches Maths and Calculus only. Studdy shows the tutors who actually cover the
          subject you asked for, rather than everyone you have worked with before.
        </Aside>
      </div>
    </ParentShell>
  );
}
