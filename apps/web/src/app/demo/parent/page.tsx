import type { ReactNode } from 'react';
import { ParentShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Chip,
  DemoButton,
  Disc,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  Stat,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { JACOB, PRIYA, STACEY, money, priceFor, serviceById } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import {
  committedLessons,
  demoFortnight,
  demoWeek,
  familyWeekBlocks,
  lessonsForStudent,
  serviceNameFor,
} from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Your family' };

const WEEKDAY = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const CLOCK = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * PRIYA'S HOME — an account she has been using since March.
 *
 * Five visible areas, each a panel with its own weight, rather than a column of
 * ruled lists on an open page. The previous pass read as a well-set article;
 * what makes this a workspace is that a glance lands on the next lesson, then
 * the relationship and the week, then the last lesson — without any of them
 * being read.
 *
 * THE CALENDAR IS A FAMILY PROJECTION. Priya sees Jacob by name and every other
 * family's lesson as `Booked`. That is enforced in `familyWeekBlocks`, not
 * here, and covered by a test — a page that has to remember is a page that
 * eventually forgets.
 */
export default function ParentHomePage() {
  const now = new Date();
  const week = demoWeek(now);
  const upcoming = committedLessons(demoFortnight(now), now).filter(
    (lesson) => lesson.student.slug === JACOB.slug,
  );
  const next = upcoming[0] ?? null;
  const { past } = lessonsForStudent(JACOB.slug, now);
  const latest = past[0] ?? null;
  const record = lessonRecord(latest?.topic ?? null);
  const blocks = familyWeekBlocks(week.days, now);
  const service = serviceById(JACOB.serviceId);
  const spentMinor = past.reduce((total, lesson) => total + lesson.priceMinor, 0n);

  return (
    <ParentShell active="/demo/parent">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {PRIYA.name}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Your family
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoButton href="/demo/parent/rebook">Book another lesson</DemoButton>
          <DemoButton href="/demo/parent/tutors" tone="secondary">
            Find another tutor
          </DemoButton>
        </div>
      </header>

      {/* TIER 1 — the next lesson, the one thing the page is about. */}
      <div className="mt-6">
        <Panel tone="hero">
          <PanelBody className="flex flex-wrap items-center gap-x-7 gap-y-5">
            <div className="min-w-[136px]">
              <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-brand-strong">
                {JACOB.firstName}&rsquo;s next lesson
              </p>
              {next === null ? (
                <p className="mt-2 font-display text-[22px] text-text-primary">Nothing booked</p>
              ) : (
                <>
                  <p className="mt-2 font-display text-[23px] font-semibold leading-tight text-text-primary">
                    {WEEKDAY.format(next.at)}
                  </p>
                  <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-brand-strong">
                    {CLOCK.format(next.at)}
                  </p>
                </>
              )}
            </div>

            <span aria-hidden className="hidden h-16 w-px bg-brand/20 sm:block" />

            <div className="flex min-w-[210px] flex-1 items-center gap-3.5">
              <Disc initials={STACEY.initials} size="lg" />
              <div className="min-w-0">
                <p className="font-display text-[19px] font-medium leading-tight text-text-primary">
                  {serviceNameFor(JACOB)} with {STACEY.firstName}
                </p>
                <p className="mt-1 text-[12.5px] text-text-muted">
                  {JACOB.format === 'online' ? 'Online' : 'In person'} &middot;{' '}
                  {JACOB.durationMinutes} minutes &middot; {money(priceFor(JACOB.durationMinutes))}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip tone="current">Weekly slot</Chip>
                  <Chip tone="neutral">Paid</Chip>
                </div>
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* TIER 2 — the relationship, and the week it sits in. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel>
          <PanelHead
            title={JACOB.firstName}
            meta={`Year ${String(JACOB.schoolYear)}`}
            action={
              <DemoButton href="/demo/parent/student" tone="quiet" size="sm">
                Open
              </DemoButton>
            }
          />
          <PanelBody>
            <div className="flex flex-wrap gap-x-8 gap-y-5">
              <Stat label="Lessons" value={String(JACOB.lessonsSoFar)} detail="since March" />
              <Stat label="Tutor" value={STACEY.firstName} detail="4.9 · 340 lessons" />
              <Stat label="Invested" value={money(spentMinor)} detail="paid to date" />
            </div>
            <div className="mt-5 border-t border-surface-border pt-3">
              <Facts>
                <Fact label="Subject" value={service?.name ?? 'Maths'} />
                <Fact label="Standing lesson" value="Tuesdays at 4:00 pm" />
                <Fact label="Format" value={JACOB.format === 'online' ? 'Online' : 'In person'} />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        <Panel className="min-w-0">
          <PanelHead
            title={`${STACEY.firstName}'s week`}
            meta={week.rangeLabel}
            action={
              <DemoButton href="/demo/parent/rebook/times" tone="quiet" size="sm">
                Find a time
              </DemoButton>
            }
          />
          <PanelBody>
            <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              size="compact"
              ariaLabel={`${STACEY.firstName}'s week, ${week.rangeLabel}`}
              legend={{ once: true }}
            />
            <p className="mt-3 text-[12px] text-text-muted">
              Other families&rsquo; lessons show as booked time only.
            </p>
          </PanelBody>
        </Panel>
      </div>

      {/* TIER 3 — what is booked. */}
      <div className="mt-5">
        <Panel>
          <PanelHead
            title="Upcoming lessons"
            meta={`${upcoming.length} booked`}
            action={
              <DemoButton href="/demo/parent/lessons" tone="quiet" size="sm">
                All lessons
              </DemoButton>
            }
          />
          <PanelBody className="py-1">
            <RowList>
              {upcoming.map((lesson) => (
                <Row key={lesson.id}>
                  <span className="w-[92px] shrink-0 text-[13.5px] font-semibold tabular-nums text-text-primary">
                    {CLOCK.format(lesson.at)}
                  </span>
                  <RowMain
                    name={WEEKDAY.format(lesson.at)}
                    detail={`${serviceNameFor(lesson.student)} with ${STACEY.firstName} · ${lesson.format === 'online' ? 'Online' : 'In person'}`}
                  />
                  <Chip tone="current">Booked</Chip>
                  <RowMeta>{money(lesson.priceMinor)}</RowMeta>
                </Row>
              ))}
            </RowList>
          </PanelBody>
        </Panel>
      </div>

      {/* TIER 4 — what happened last time. The reason a record is worth keeping. */}
      {latest !== null && record !== null ? (
        <div className="mt-5">
          <Panel>
            <PanelHead
              title="Last lesson"
              meta={formatLessonDateTime(latest.at, PLATFORM_TIME_ZONE)}
              action={
                <DemoButton href="/demo/parent/lessons" tone="quiet" size="sm">
                  Full summary
                </DemoButton>
              }
            />
            <PanelBody>
              <h3 className="font-display text-[19px] font-medium text-text-primary">
                {latest.topic}
              </h3>
              <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <Note label="Understood well">{record.understood}</Note>
                <Note label="Struggled with">{record.struggled}</Note>
              </dl>
              <div className="mt-5 border-t border-surface-border pt-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Homework set
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {record.homework.map((task) => (
                    <li key={task} className="flex gap-2.5 text-[13.5px] text-text-secondary">
                      <span aria-hidden className="text-brand">
                        &middot;
                      </span>
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            </PanelBody>
          </Panel>
        </div>
      ) : null}

      {/* TIER 5 — history, quiet. */}
      <div className="mt-5">
        <Panel tone="quiet">
          <PanelHead title="Earlier lessons" meta={`${Math.max(past.length - 1, 0)} more`} />
          <PanelBody className="py-1">
            <RowList>
              {past.slice(1, 5).map((lesson) => (
                <Row key={lesson.id} href="/demo/parent/lessons">
                  <RowMain
                    name={lesson.topic ?? 'Lesson'}
                    detail={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                  />
                  <Chip tone="neutral">Completed</Chip>
                  <RowMeta>{money(lesson.priceMinor)}</RowMeta>
                </Row>
              ))}
            </RowList>
          </PanelBody>
        </Panel>
      </div>
    </ParentShell>
  );
}

function Note({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">{children}</dd>
    </div>
  );
}
