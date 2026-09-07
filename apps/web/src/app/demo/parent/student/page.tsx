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
import { JACOB, STACEY, money, priceFor, serviceById } from '@/lib/demo/fixtures';
import { lessonsForStudent } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Jacob' };

/**
 * THE STUDENT, FROM THE FAMILY'S SIDE.
 *
 * The same relationship the tutor sees, told for the person paying for it: what
 * he is working on, who teaches him, how long it has been going, and what it
 * costs. No metrics, no progress score — Studdy does not measure children, and
 * a demo that invented a number here would be claiming a feature the product
 * has deliberately not built.
 */
export default function ParentStudentPage() {
  const now = new Date();
  const { upcoming, past } = lessonsForStudent(JACOB.slug, now);
  const service = serviceById(JACOB.serviceId);

  return (
    <ParentShell active="/demo/parent/student">
      <div className="flex items-start gap-4">
        <Disc initials={JACOB.initials} size="lg" />
        <div className="min-w-0 flex-1">
          <PageHead
            title={JACOB.firstName}
            sub={`Year ${String(JACOB.schoolYear)} · ${service?.name ?? 'Maths'}`}
          />
        </div>
        <Chip tone="current">Weekly</Chip>
      </div>

      <div className="mt-7 border-l-2 border-brand bg-brand-tint/40 px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-brand-strong">
          What {STACEY.firstName} is working on with him
        </p>
        <p className="mt-1.5 max-w-[68ch] font-display text-[18px] leading-snug text-text-primary">
          {JACOB.goal}
        </p>
      </div>

      <section className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        <div>
          <SectionLine title="The arrangement" />
          <div className="mt-3">
            <Facts>
              <Fact label="Tutor" value={STACEY.firstName} />
              <Fact label="Standing lesson" value={JACOB.standing} />
              <Fact label="Length" value={`${String(JACOB.durationMinutes)} minutes`} />
              <Fact label="Format" value={JACOB.format === 'online' ? 'Online' : 'In person'} />
              <Fact label="Cost per lesson" value={money(priceFor(JACOB.durationMinutes))} strong />
            </Facts>
          </div>
        </div>
        <div>
          <SectionLine title="So far" />
          <div className="mt-3">
            <Facts>
              <Fact label="Lessons" value={String(JACOB.lessonsSoFar)} />
              <Fact label="Since" value="March" />
              <Fact label="Level" value={service?.levels ?? '—'} />
            </Facts>
          </div>
          <div className="mt-5">
            <DemoButton href="/demo/parent/rebook">Book another lesson</DemoButton>
          </div>
        </div>
      </section>

      <section className="mt-9">
        <SectionLine title="Coming up" meta={`${upcoming.length}`} />
        <div className="mt-1">
          <RowList>
            {upcoming.map((lesson) => (
              <Row key={lesson.id}>
                <RowMain
                  name={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                  detail={`${String(lesson.durationMinutes)} min · ${lesson.format === 'online' ? 'Online' : 'In person'}`}
                />
                <Chip tone="current">Booked</Chip>
                <RowMeta>{money(lesson.priceMinor)}</RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      <section className="mt-9">
        <SectionLine
          title="Lesson history"
          meta={`${past.length}`}
          action={
            <DemoButton href="/demo/parent/lessons" tone="quiet" size="sm">
              With summaries
            </DemoButton>
          }
        />
        <div className="mt-1">
          <RowList>
            {past.map((lesson) => (
              <Row key={lesson.id} href="/demo/parent/lessons">
                <RowMain
                  name={lesson.topic ?? 'Lesson'}
                  detail={formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}
                />
                <Chip tone="neutral">Completed</Chip>
                <RowMeta>{lesson.durationMinutes} min</RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>
    </ParentShell>
  );
}
