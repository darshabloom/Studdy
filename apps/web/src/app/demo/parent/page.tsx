import { ParentShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoButton,
  Disc,
  Fact,
  Facts,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { JACOB, PRIYA, STACEY, money, priceFor } from '@/lib/demo/fixtures';
import {
  committedLessons,
  demoFortnight,
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
 * PRIYA'S HOME — one lesson and one action.
 *
 * The richness comes from HISTORY rather than from a second child: fourteen
 * lessons since March, a standing Tuesday, a named tutor. That is what makes an
 * account feel lived in, and it is what a schema demonstration cannot fake.
 *
 * There is no "nothing needs you" panel. A section that renders only when it
 * has something to say is the difference between a workspace and a dashboard
 * filling its own space.
 */
export default function ParentHomePage() {
  const now = new Date();
  const upcoming = committedLessons(demoFortnight(now), now).filter(
    (lesson) => lesson.student.slug === JACOB.slug,
  );
  const next = upcoming[0] ?? null;
  const { past } = lessonsForStudent(JACOB.slug, now);

  return (
    <ParentShell active="/demo/parent">
      {/* TIER 1 — the next lesson, and the one action worth taking. */}
      <section className="border-b border-surface-border pb-8">
        <PageHead
          eyebrow={`${JACOB.firstName}’s next lesson`}
          title={next === null ? 'Nothing booked yet' : WEEKDAY.format(next.at)}
          sub={next === null ? undefined : `${CLOCK.format(next.at)} · your weekly slot`}
        />

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Disc initials={STACEY.initials} size="lg" />
          <div className="min-w-[190px] flex-1">
            <p className="font-display text-[21px] font-medium leading-tight text-text-primary">
              {serviceNameFor(JACOB)} with {STACEY.firstName}
            </p>
            <p className="mt-1 text-[12.5px] text-text-muted">
              {JACOB.format === 'online' ? 'Online' : 'In person'} &middot;{' '}
              {JACOB.durationMinutes} minutes &middot; {JACOB.standing}
            </p>
          </div>
          <DemoButton href="/demo/parent/rebook" size="lg">
            Book another lesson
          </DemoButton>
        </div>
      </section>

      {/* TIER 3 — the relationship, as context rather than as a record. */}
      <section className="mt-9 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        <div>
          <SectionLine
            title={JACOB.firstName}
            meta={`Year ${String(JACOB.schoolYear)}`}
            action={
              <DemoButton href="/demo/parent/student" tone="quiet" size="sm">
                Open
              </DemoButton>
            }
          />
          <div className="mt-3">
            <Facts>
              <Fact label="Subject" value={serviceNameFor(JACOB)} />
              <Fact label="Tutor" value={STACEY.firstName} />
              <Fact label="Since" value={`March · ${String(JACOB.lessonsSoFar)} lessons`} />
              {/* Through the rate card, never a literal — see fixtures.RATE_MINOR. */}
              <Fact label="Cost per lesson" value={money(priceFor(JACOB.durationMinutes))} />
            </Facts>
          </div>
        </div>

        <div>
          <SectionLine title="Coming up" meta={`${upcoming.length}`} />
          <div className="mt-1">
            <RowList>
              {upcoming.slice(0, 3).map((lesson) => (
                <Row key={lesson.id}>
                  <RowMain
                    name={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                    detail={`${String(lesson.durationMinutes)} min · ${lesson.format === 'online' ? 'Online' : 'In person'}`}
                  />
                  <Chip tone="current">Booked</Chip>
                </Row>
              ))}
            </RowList>
          </div>
        </div>
      </section>

      {/* TIER 4 — history. Cheap to build, and it is what makes it feel real. */}
      <section className="mt-9">
        <SectionLine
          title="Recent lessons"
          meta={`${past.length} taught`}
          action={
            <DemoButton href="/demo/parent/lessons" tone="quiet" size="sm">
              All lessons
            </DemoButton>
          }
        />
        <div className="mt-1">
          <RowList>
            {past.slice(0, 4).map((lesson) => (
              <Row key={lesson.id} href="/demo/parent/lessons">
                <RowMain
                  name={lesson.topic ?? 'Lesson'}
                  detail={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                />
                {/* Generic completion stays colourless. */}
                <Chip tone="neutral">Completed</Chip>
                <RowMeta>{lesson.durationMinutes} min</RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      {/* TIER 5 — quiet. Secondary weight, no green. */}
      <div className="mt-9 border-t border-surface-border pt-5">
        <p className="text-[13.5px] text-text-muted">
          {JACOB.firstName} needs help with a subject {STACEY.firstName} does not teach?{' '}
          <a
            href="/demo/parent/tutors"
            className="text-brand underline decoration-brand/40 underline-offset-4"
          >
            Find a tutor
          </a>{' '}
          &mdash; she teaches Maths and Calculus only.
        </p>
        <p className="mt-2 text-[12.5px] text-text-muted">
          Signed in as {PRIYA.name}. Payment deadlines and tutor replies arrive by email; nothing is
          sent in this demo.
        </p>
      </div>
    </ParentShell>
  );
}
