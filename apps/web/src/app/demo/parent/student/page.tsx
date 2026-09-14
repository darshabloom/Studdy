import { ParentShell } from '@/components/demo/demo-shells';
import {
  CardsHead,
  Chip,
  DemoButton,
  Disc,
  Fact,
  Facts,
  OpenMark,
  Panel,
  PanelBody,
  PanelHead,
  PayChip,
  Stat,
} from '@/components/demo/kit';
import { CADENCE_LABEL, JACOB, STACEY, money, priceFor, serviceById } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import { isPaid, lessonsForStudent, spanLabel, withPaid } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Jacob' };

const SHORT = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/**
 * THE STUDENT, FROM THE FAMILY'S SIDE.
 *
 * The same relationship the tutor sees, told for the person paying for it: what
 * he is working on, who teaches him, how long it has been going, and what it
 * costs. No metrics, no progress score — Studdy does not measure children, and
 * a demo that invented a number here would be claiming a feature the product
 * has deliberately not built. `Lessons` and `Invested` are counts of things
 * that happened, which is a different kind of number.
 *
 * Six cards of visibly different weight: who he is, what Stacey is working on,
 * the relationship, what is booked, what has been taught, and the way to book
 * more. A parent should be able to answer any of those in a glance without
 * reading a paragraph to find it.
 */
export default async function ParentStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid: paidParam } = await searchParams;
  const paid = isPaid(paidParam);
  const now = new Date();
  const { upcoming, past } = lessonsForStudent(JACOB.slug, now, { family: true, paid });
  const service = serviceById(JACOB.serviceId);
  const link = (href: string) => withPaid(href, paid);
  const spentMinor = past.reduce((total, lesson) => total + lesson.priceMinor, 0n);
  const owing = upcoming.filter((lesson) => lesson.payment === 'due');

  return (
    // Entered through Students, so that is the section that stays highlighted.
    <ParentShell active="/demo/parent/students" paid={paid}>
      <DemoButton href={link('/demo/parent/students')} tone="quiet" size="sm">
        &larr; Students
      </DemoButton>
      <div className="mt-3" />
      {/* ── Who he is, and what is being worked on ────────────────────── */}
      <Panel tone="hero">
        <PanelBody className="flex flex-wrap items-start gap-x-8 gap-y-6 py-6">
          <div className="flex min-w-[230px] flex-1 items-center gap-4">
            <Disc initials={JACOB.initials} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
                {JACOB.firstName}
              </h1>
              <p className="mt-1 text-[13px] text-text-muted">
                Year {JACOB.schoolYear} &middot; {service?.name ?? 'Maths'}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Chip tone="current">{CADENCE_LABEL[JACOB.cadence]}</Chip>
                <Chip tone="neutral">{JACOB.lessonsSoFar} lessons</Chip>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 border-t border-brand/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Disc initials={STACEY.initials} size="sm" />
              <p className="min-w-0 text-[13.5px] text-text-secondary">
                <span className="font-medium text-text-primary">
                  {service?.name ?? 'Maths'} with {STACEY.firstName}
                </span>
                <span className="block text-[12.5px] text-text-muted">{JACOB.standing}</span>
              </p>
            </div>
            <DemoButton href={link('/demo/parent/rebook')} size="lg" className="w-full sm:w-auto">
              Book another lesson
            </DemoButton>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Stat
              label="Lessons"
              value={String(JACOB.lessonsSoFar)}
              size="lg"
              detail="since March"
            />
            <Stat label="Invested" value={money(spentMinor)} size="lg" detail="paid to date" />
          </div>
        </PanelBody>
      </Panel>

      {/* ── The relationship, and what it is aimed at ─────────────────── */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Panel href={link('/demo/parent/lessons')}>
          <PanelHead title="Tutor" action={<OpenMark label="Lessons" />} />
          <PanelBody className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Disc initials={STACEY.initials} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[18px] font-medium leading-tight text-text-primary">
                  {STACEY.firstName}
                </p>
                <p className="mt-0.5 text-[12.5px] text-text-muted">{service?.name ?? 'Maths'}</p>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-text-secondary">{JACOB.standing}</p>
            <div className="border-t border-surface-border pt-3">
              <Facts>
                <Fact label="Length" value={`${String(JACOB.durationMinutes)} minutes`} />
                <Fact label="Format" value={JACOB.format === 'online' ? 'Online' : 'In person'} />
                <Fact label="Level" value={service?.levels ?? '—'} />
                <Fact label="Per lesson" value={money(priceFor(JACOB.durationMinutes))} strong />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title={`What ${STACEY.firstName} is working on`} />
          <PanelBody>
            <p className="max-w-[60ch] font-display text-[19px] leading-snug text-text-primary">
              {JACOB.goal}
            </p>
            <div className="mt-5 border-t border-surface-border pt-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                Recently covered
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {JACOB.recentTopics.map((topic) => (
                  <Chip key={topic} tone="neutral">
                    {topic}
                  </Chip>
                ))}
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* ── What is booked, and what it costs ─────────────────────────── */}
      <div className="mt-5">
        <Panel tone={owing.length > 0 ? 'attention' : 'default'}>
          <PanelHead
            title="Upcoming lessons"
            meta={`${String(upcoming.length)}`}
            action={
              <DemoButton href={link('/demo/parent/rebook')} tone="quiet" size="sm">
                Book another
              </DemoButton>
            }
          />
          <PanelBody className="grid gap-4 sm:grid-cols-2">
            {upcoming.length === 0 ? (
              <p className="text-[13.5px] text-text-secondary">
                Nothing booked in the next fortnight.
              </p>
            ) : (
              upcoming.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex flex-col gap-3 rounded-[5px] border border-surface-border bg-surface-card px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold tabular-nums text-text-primary">
                        {spanLabel(lesson.at, lesson.durationMinutes)}
                      </p>
                      <p className="mt-0.5 text-[12px] text-text-muted">
                        {lesson.topic ?? service?.name ?? 'Maths'} &middot; with {STACEY.firstName}
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">
                      {money(lesson.priceMinor)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PayChip payment={lesson.payment} />
                    {lesson.payment === 'due' ? (
                      <DemoButton href="/demo/parent/rebook/pay" size="sm">
                        Pay now
                      </DemoButton>
                    ) : (
                      <DemoButton
                        href={link(`/demo/parent/lessons/${lesson.id}`)}
                        tone="quiet"
                        size="sm"
                      >
                        Details
                      </DemoButton>
                    )}
                  </div>
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* ── What has already been taught ──────────────────────────────── */}
      {past.length > 0 ? (
        <section className="mt-6 sm:mt-8">
          <CardsHead
            title="Lesson history"
            meta={`${String(past.length)}`}
            action={
              <DemoButton href={link('/demo/parent/lessons')} tone="quiet" size="sm">
                With summaries
              </DemoButton>
            }
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.slice(0, 6).map((lesson) => {
              const record = lessonRecord(lesson.topic);
              return (
                <Panel
                  key={lesson.id}
                  tone="quiet"
                  href={link(`/demo/parent/lessons/${lesson.id}`)}
                >
                  <PanelBody className="flex h-full flex-col gap-2.5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 font-display text-[15.5px] font-medium leading-tight text-text-primary">
                        {lesson.topic ?? 'Lesson'}
                      </h3>
                      <OpenMark label="" />
                    </div>
                    <p className="text-[12px] tabular-nums text-text-muted">
                      {SHORT.format(lesson.at)} &middot; {lesson.durationMinutes} min
                    </p>
                    {record === null ? null : (
                      <p className="mt-auto pt-1 text-[12.5px] leading-relaxed text-text-secondary">
                        {record.next}
                      </p>
                    )}
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── The way on ────────────────────────────────────────────────── */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Panel tone="hero">
          <PanelBody className="flex flex-wrap items-center gap-4">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[17px] font-medium text-text-primary">
                Book another lesson
              </span>
              <span className="mt-0.5 block text-[12.5px] text-text-muted">
                An extra session with {STACEY.firstName}, alongside his weekly slot
              </span>
            </span>
            <DemoButton href={link('/demo/parent/rebook')}>Choose a time</DemoButton>
          </PanelBody>
        </Panel>

        <Panel tone="quiet" href={link('/demo/parent/tutors')}>
          <PanelBody className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[16px] font-medium text-text-primary">
                Find another tutor
              </span>
              <span className="mt-0.5 block text-[12.5px] text-text-muted">
                For a subject {STACEY.firstName} does not teach
              </span>
            </span>
            <OpenMark label="Search" />
          </PanelBody>
        </Panel>
      </div>
    </ParentShell>
  );
}
