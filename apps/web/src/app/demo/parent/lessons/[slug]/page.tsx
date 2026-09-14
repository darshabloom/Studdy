import { notFound } from 'next/navigation';
import { ParentShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoButton,
  DemoNote,
  Disc,
  Fact,
  Facts,
  NotePanel,
  Panel,
  PanelBody,
  PanelHead,
  PayChip,
  TaskList,
} from '@/components/demo/kit';
import { JACOB, STACEY, money, serviceById } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import { isPaid, lessonById, shortDeadline, spanLabel, withPaid } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Lesson' };

const DAY = new Intl.DateTimeFormat('en-NZ', {
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
 * ONE LESSON, FROM THE FAMILY'S SIDE — and the reason the history is clickable.
 *
 * A completed lesson opens its record: the five things the tutor wrote and the
 * homework she set. A lesson still to come opens its arrangements instead, and
 * if it has not been paid for it says so here as plainly as it does on the
 * dashboard — the same `payment` state on the same projected lesson, so a
 * family cannot find it settled in one place and owing in another.
 */
export default async function ParentLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { slug } = await params;
  const { paid: paidParam } = await searchParams;
  const paid = isPaid(paidParam);
  const now = new Date();
  const lesson = lessonById(slug, now, { paid });
  if (lesson === null) notFound();

  // A family may open THEIR OWN child's lesson and nobody else's. The id is in
  // the URL, so this is the one place the boundary has to be checked rather
  // than projected — a hand-typed id must not return another family's record.
  if (lesson.student.slug !== JACOB.slug) notFound();

  const record = lessonRecord(lesson.topic);
  const service = serviceById(lesson.student.serviceId);
  const link = (href: string) => withPaid(href, paid);
  const done = lesson.status === 'completed';

  return (
    <ParentShell active="/demo/parent/lessons" paid={paid}>
      <DemoButton href={link('/demo/parent/lessons')} tone="quiet" size="sm">
        &larr; All lessons
      </DemoButton>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {DAY.format(lesson.at)} &middot; {CLOCK.format(lesson.at)}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary text-balance">
            {lesson.topic ?? (done ? 'Lesson' : 'Upcoming lesson')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{done ? 'Completed' : 'Scheduled'}</Chip>
          <PayChip payment={lesson.payment} />
        </div>
      </header>

      {/* The one thing still owed, said once and loudly. */}
      {lesson.payment === 'due' ? (
        <div className="mt-6">
          <Panel tone="attention">
            <PanelBody className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <span
                aria-hidden
                className="hidden w-[3px] self-stretch rounded-full bg-status-warning sm:block"
              />
              <span className="min-w-[220px] flex-1">
                <span className="block font-display text-[18px] font-semibold text-text-primary">
                  {STACEY.firstName} is holding this time
                </span>
                <span className="mt-1 block max-w-[60ch] text-[13.5px] leading-relaxed text-text-secondary">
                  She has accepted the session, but it is not booked until the payment goes through.
                  {lesson.payBy === null
                    ? ''
                    : ` Pay by ${shortDeadline(lesson.payBy)} or the hour is released.`}
                </span>
              </span>
              <DemoButton href="/demo/parent/rebook/pay">Pay now</DemoButton>
            </PanelBody>
          </Panel>
        </div>
      ) : null}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {record === null ? (
            <Panel>
              <PanelHead title="Summary" />
              <PanelBody>
                <p className="max-w-[64ch] text-[13.5px] leading-relaxed text-text-secondary">
                  {STACEY.firstName} writes the summary and sets the homework after the lesson. This
                  one has not happened yet.
                </p>
              </PanelBody>
            </Panel>
          ) : (
            <>
              <Panel>
                <PanelHead title="What happened" />
                <PanelBody className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <NotePanel label="What we covered">{record.covered}</NotePanel>
                  <NotePanel label="Understood well" tone="good">
                    {record.understood}
                  </NotePanel>
                  <NotePanel label="Struggled with" tone="watch">
                    {record.struggled}
                  </NotePanel>
                  <NotePanel label="What changed">{record.changed}</NotePanel>
                </PanelBody>
              </Panel>

              <Panel tone="hero">
                <PanelHead
                  title="Homework set"
                  meta={`${String(record.homework.length)} ${record.homework.length === 1 ? 'task' : 'tasks'}`}
                />
                <PanelBody>
                  <TaskList tasks={record.homework} />
                </PanelBody>
              </Panel>

              <Panel tone="quiet">
                <PanelHead title="Next focus" />
                <PanelBody>
                  <p className="max-w-[64ch] text-[14px] leading-relaxed text-text-secondary">
                    {record.next}
                  </p>
                </PanelBody>
              </Panel>
            </>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHead title="The lesson" />
            <PanelBody>
              <div className="flex items-center gap-3">
                <Disc initials={STACEY.initials} />
                <div className="min-w-0">
                  <p className="font-display text-[17px] font-medium leading-tight text-text-primary">
                    {STACEY.firstName}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-text-muted">{service?.name ?? 'Maths'}</p>
                </div>
              </div>
              <div className="mt-4">
                <Facts>
                  <Fact label="Student" value={lesson.student.firstName} />
                  <Fact label="When" value={spanLabel(lesson.at, lesson.durationMinutes)} />
                  <Fact label="Length" value={`${String(lesson.durationMinutes)} minutes`} />
                  <Fact
                    label="Format"
                    value={lesson.format === 'online' ? 'Online' : 'In person'}
                  />
                  <Fact
                    label={lesson.payment === 'paid' ? 'Paid' : 'To pay'}
                    value={money(lesson.priceMinor)}
                    strong
                  />
                </Facts>
              </div>
            </PanelBody>
          </Panel>

          <Panel tone="quiet" href={link('/demo/parent/student')}>
            <PanelBody className="flex items-center gap-3">
              <Disc initials={lesson.student.initials} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-medium text-text-primary">
                  {lesson.student.firstName}
                </span>
                <span className="mt-0.5 block text-[12px] text-text-muted">
                  Year {lesson.student.schoolYear} &middot; every lesson and the arrangement
                </span>
              </span>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <div className="mt-6 sm:mt-8">
        <DemoNote title="Sample notes">
          Studdy does not record or transcribe lessons. {STACEY.firstName} writes this after the
          session, and the family sees exactly what you see here.
        </DemoNote>
      </div>
    </ParentShell>
  );
}
