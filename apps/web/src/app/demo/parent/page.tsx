import type { ReactNode } from 'react';
import { ParentShell } from '@/components/demo/demo-shells';
import {
  Chip,
  DemoButton,
  Disc,
  Fact,
  Facts,
  OpenMark,
  Panel,
  PayChip,
  PanelBody,
  PanelHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  Stat,
} from '@/components/demo/kit';
import { formatLessonDateTime } from '@/components/requests/request-status';
import { CADENCE_LABEL, JACOB, PRIYA, money } from '@/lib/demo/fixtures';
import { lessonRecord } from '@/lib/demo/lesson-records';
import {
  demoFortnight,
  familyActions,
  familyLessons,
  familyRelationships,
  isPaid,
  lessonsForStudent,
  shortDeadline,
  withPaid,
} from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Your family' };

const DAY = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const SHORT_DAY = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const CLOCK = new Intl.DateTimeFormat('en-NZ', {
  timeZone: PLATFORM_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * PRIYA'S HOME — cards of deliberately different weight.
 *
 * NO TUTOR CALENDAR HERE. A family home cannot privilege one tutor's whole
 * week: Priya could have two children with three tutors between them, and
 * whose calendar would it be? Availability is a booking question and lives in
 * the booking flow, where it is about a lesson somebody is actually arranging.
 *
 * EVERY RELATIONSHIP IS A LIST ENTRY. There is one today. The upcoming rows
 * carry tutor and subject as columns rather than assuming them, so a second
 * tutor appears without a single layout change — which is the point of
 * structuring it this way while there is still only one.
 *
 * The attention card renders NOTHING when nothing is waiting. An "all clear"
 * card is filler, and filler is what makes software feel automated.
 */
export default async function ParentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid: paidParam } = await searchParams;
  const paid = isPaid(paidParam);
  const now = new Date();
  const relationships = familyRelationships();
  const actions = familyActions(now, paid);
  // THROUGH THE FAMILY PROJECTION. Listing every lesson Stacey teaches put
  // another family's child on Priya's dashboard once already.
  const upcoming = familyLessons(demoFortnight(now), now, [JACOB.slug], { paid });
  const next = upcoming[0] ?? null;
  const { past } = lessonsForStudent(JACOB.slug, now);
  const link = (href: string) => withPaid(href, paid);
  const latest = past[0] ?? null;
  const record = lessonRecord(latest?.topic ?? null);
  const spentMinor = past.reduce((total, lesson) => total + lesson.priceMinor, 0n);
  const primary = relationships[0] ?? null;

  return (
    <ParentShell active="/demo/parent" paid={paid}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-text-muted">
            {PRIYA.name}
          </p>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
            Your family
          </h1>
        </div>
        <DemoButton href={link('/demo/parent/rebook')}>Book another lesson</DemoButton>
      </header>

      {/*
       * Renders ONLY when something genuinely needs Priya, and today one thing
       * does: Stacey has accepted the extra session and is holding the hour
       * until it is paid for. When the demo's payment goes through this list
       * empties and the card disappears entirely - no "all clear" tile, which
       * would be filler dressed as reassurance.
       */}
      {actions.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3">
          {actions.map((action) => (
            <Panel key={action.id} tone="attention">
              <PanelBody className="flex flex-wrap items-start gap-x-6 gap-y-4 py-5">
                <span aria-hidden className="w-[3px] self-stretch rounded-full bg-status-warning" />
                <span className="min-w-[220px] flex-1">
                  <span className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-[19px] font-semibold text-text-primary">
                      {action.title}
                    </span>
                    <Chip tone="attention">Pay by {shortDeadline(action.payByAt)}</Chip>
                  </span>
                  <span className="mt-1.5 block max-w-[62ch] text-[13.5px] leading-relaxed text-text-secondary">
                    {action.detail}
                  </span>
                  <span className="mt-2.5 block text-[13.5px] font-medium tabular-nums text-text-primary">
                    {action.whenLabel}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-3">
                  <span className="text-[26px] font-semibold leading-none tabular-nums text-text-primary">
                    {money(action.amountMinor)}
                  </span>
                  <DemoButton href={action.href} size="md">
                    {action.actionLabel}
                  </DemoButton>
                </span>
              </PanelBody>
            </Panel>
          ))}
        </div>
      ) : null}

      {/* ── HERO: the next lesson ─────────────────────────────────────── */}
      <div className="mt-6">
        <Panel tone="hero">
          <PanelBody className="flex flex-wrap items-center gap-x-8 gap-y-6 py-6">
            <div className="min-w-[150px]">
              <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-brand-strong">
                Next lesson
              </p>
              {next === null ? (
                <p className="mt-2 font-display text-[24px] text-text-primary">Nothing booked</p>
              ) : (
                <>
                  <p className="mt-2 font-display text-[25px] font-semibold leading-tight text-text-primary">
                    {DAY.format(next.at)}
                  </p>
                  <p className="mt-1 text-[30px] font-semibold leading-none tabular-nums text-brand-strong">
                    {CLOCK.format(next.at)}
                  </p>
                </>
              )}
            </div>

            <span aria-hidden className="hidden h-20 w-px bg-brand/20 sm:block" />

            {next === null ? null : (
              <div className="flex min-w-[230px] flex-1 items-center gap-4">
                <Disc initials={primary?.tutorInitials ?? '—'} size="lg" />
                <div className="min-w-0">
                  <p className="font-display text-[20px] font-medium leading-tight text-text-primary">
                    {primary?.subject ?? 'Lesson'} with {primary?.tutorFirstName ?? 'your tutor'}
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-muted">
                    For {next.student.firstName} &middot;{' '}
                    {next.format === 'online' ? 'Online' : 'In person'} &middot;{' '}
                    {next.durationMinutes} minutes &middot; {money(next.priceMinor)}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Chip tone="current">{CADENCE_LABEL[next.kind]}</Chip>
                    <PayChip payment={next.payment} />
                  </div>
                </div>
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* ── Upcoming (wide) + Tutors (narrow) ─────────────────────────── */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead
            title="Upcoming lessons"
            meta={`${String(upcoming.length)} booked`}
            action={
              <DemoButton href={link('/demo/parent/lessons')} tone="quiet" size="sm">
                All lessons
              </DemoButton>
            }
          />
          <PanelBody className="py-1">
            <RowList>
              {upcoming.map((lesson) => {
                const relationship = relationships.find(
                  (entry) => entry.student.slug === lesson.student.slug,
                );
                return (
                  <Row
                    key={lesson.id}
                    href={link(`/demo/parent/lessons/${lesson.id}`)}
                    attention={lesson.payment === 'due'}
                  >
                    <span className="w-[96px] shrink-0">
                      <span className="block text-[13.5px] font-semibold tabular-nums text-text-primary">
                        {CLOCK.format(lesson.at)}
                      </span>
                      <span className="block text-[11.5px] text-text-muted">
                        {SHORT_DAY.format(lesson.at)}
                      </span>
                    </span>
                    <Disc initials={relationship?.tutorInitials ?? '—'} size="sm" />
                    <RowMain
                      name={`${relationship?.subject ?? 'Lesson'} · ${relationship?.tutorFirstName ?? ''}`}
                      detail={`${lesson.student.firstName} · ${lesson.format === 'online' ? 'Online' : 'In person'} · ${String(lesson.durationMinutes)} min`}
                    />
                    <PayChip payment={lesson.payment} />
                    <RowMeta>{money(lesson.priceMinor)}</RowMeta>
                  </Row>
                );
              })}
            </RowList>
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-5">
          <PanelHeadless title="Tutors" count={relationships.length} />
          {relationships.map((relationship) => (
            <Panel key={relationship.id} href={link(relationship.href)}>
              <PanelBody className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Disc initials={relationship.tutorInitials} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[18px] font-medium leading-tight text-text-primary">
                      {relationship.tutorFirstName}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-text-muted">
                      {relationship.subject} &middot; {relationship.student.firstName}
                    </p>
                  </div>
                  <OpenMark />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="current">{CADENCE_LABEL[relationship.cadence]}</Chip>
                  <Chip tone="neutral">{relationship.lessonsSoFar} lessons</Chip>
                </div>
                <p className="text-[12.5px] text-text-secondary">{relationship.standing}</p>
              </PanelBody>
            </Panel>
          ))}

          <Panel tone="quiet" href={link('/demo/parent/tutors')}>
            <PanelBody className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[16px] font-medium text-text-primary">
                  Find another tutor
                </span>
                <span className="mt-0.5 block text-[12.5px] text-text-muted">
                  For a subject your current tutors do not teach
                </span>
              </span>
              <OpenMark label="Search" />
            </PanelBody>
          </Panel>
        </div>
      </div>

      {/* ── Jacob (narrow) + Recent activity (wide) ───────────────────── */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <Panel href={link('/demo/parent/student')}>
          <PanelHead
            title={JACOB.firstName}
            meta={`Year ${String(JACOB.schoolYear)}`}
            action={<OpenMark />}
          />
          <PanelBody>
            <div className="flex flex-wrap gap-x-7 gap-y-4">
              <Stat label="Lessons" value={String(JACOB.lessonsSoFar)} detail="since March" />
              <Stat label="Invested" value={money(spentMinor)} detail="paid to date" />
            </div>
            <div className="mt-4 border-t border-surface-border pt-3">
              <Facts>
                <Fact label="Subjects" value={primary?.subject ?? '—'} />
                <Fact label="Tutors" value={String(relationships.length)} />
              </Facts>
            </div>
          </PanelBody>
        </Panel>

        {latest !== null && record !== null ? (
          <Panel href={link(`/demo/parent/lessons/${latest.id}`)}>
            <PanelHead
              title="Last lesson"
              meta={formatLessonDateTime(latest.at, PLATFORM_TIME_ZONE)}
              action={<OpenMark label="Full record" />}
            />
            <PanelBody>
              <h3 className="font-display text-[19px] font-medium text-text-primary">
                {latest.topic}
              </h3>
              <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <Note label="Understood well" tone="good">
                  {record.understood}
                </Note>
                <Note label="Struggled with" tone="watch">
                  {record.struggled}
                </Note>
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
        ) : null}
      </div>

      {/* ── Earlier lessons, quiet ────────────────────────────────────── */}
      <div className="mt-5">
        <Panel tone="quiet">
          <PanelHead
            title="Earlier lessons"
            meta={`${String(Math.max(past.length - 1, 0))} more`}
          />
          <PanelBody className="py-1">
            <RowList>
              {past.slice(1, 5).map((lesson) => (
                <Row key={lesson.id} href={link(`/demo/parent/lessons/${lesson.id}`)}>
                  <RowMain
                    name={lesson.topic ?? 'Lesson'}
                    detail={`${lesson.student.firstName} · ${formatLessonDateTime(lesson.at, PLATFORM_TIME_ZONE)}`}
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

/** A heading for a column of cards that has no card of its own to sit in. */
function PanelHeadless({ title, count }: { title: string; count: number }): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[16px] font-semibold text-text-primary">{title}</h2>
      <span className="text-[12.5px] text-text-muted">{count}</span>
    </div>
  );
}

function Note({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'good' | 'watch';
  children: ReactNode;
}): ReactNode {
  return (
    <div
      className={
        tone === 'good'
          ? 'border-l-2 border-brand pl-3.5'
          : 'border-l-2 border-status-warning pl-3.5'
      }
    >
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">{children}</dd>
    </div>
  );
}
