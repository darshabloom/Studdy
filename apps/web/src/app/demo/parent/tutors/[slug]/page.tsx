import { notFound } from 'next/navigation';
import {
  availabilityLabel,
  formatLabel,
  ratingLabel,
  verificationLabel,
  yearLevelRangeLabel,
} from '@studdy/domain/discovery';
import { ParentShell } from '@/components/demo/demo-shells';
import { DemoCalendar } from '@/components/demo/demo-calendar';
import {
  Aside,
  Chip,
  DemoButton,
  Disc,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
} from '@/components/demo/kit';
import { DISCOVERY_TUTOR_SLUG, JACOB, money, physicsTutor } from '@/lib/demo/fixtures';
import { demoWeek } from '@/lib/demo/schedule';
import { tutorBands } from '@/lib/demo/stories';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tutor = physicsTutor(slug);
  return { title: tutor === null ? 'Tutor' : `${tutor.firstName} — Tutor profile` };
}

/**
 * The profile, with the decision surface above the prose.
 *
 * A parent reaching here has already read the headline on the card; what they
 * are asking now is whether the week works. So the calendar sits directly under
 * the header and the teaching approach comes after it — the same ordering the
 * production profile uses, and the same fitted window.
 */
export default async function DiscoveryProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tutor = physicsTutor(slug);
  if (tutor === null) notFound();

  const now = new Date();
  const week = demoWeek(now);
  const blocks = tutorBands(tutor, week.days, now);
  const rating = ratingLabel(tutor.ratingHundredths);
  const isStoryTutor = tutor.slug === DISCOVERY_TUTOR_SLUG;

  return (
    <ParentShell active="/demo/parent/tutors">
      <DemoButton href="/demo/parent/tutors" tone="quiet" size="sm">
        &larr; Back to tutors
      </DemoButton>

      {/* ── Who, and what he costs ──────────────────────────────────── */}
      <div className="mt-4">
        <Panel tone="hero">
          <PanelBody className="flex flex-wrap items-start gap-x-7 gap-y-5 py-6">
            <Disc initials={tutor.initials} size="lg" />
            <div className="min-w-[240px] flex-1">
              <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
                {tutor.firstName}
              </h1>
              <p className="mt-1.5 max-w-[54ch] text-[14px] leading-snug text-text-secondary">
                {tutor.headline}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip tone="current">{availabilityLabel(tutor.availabilityLabelCode)}</Chip>
                {rating === null ? null : <Chip tone="neutral">{rating} rating</Chip>}
                <Chip tone="neutral">{tutor.completedLessonCount} lessons</Chip>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[30px] font-semibold leading-none tabular-nums text-text-primary">
                {money(tutor.hourlyMinor)}
              </p>
              <p className="mt-1 text-[11.5px] text-text-muted">per hour</p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* ── The week, which is the actual decision ──────────────────── */}
      <div className="mt-5">
        <Panel className="min-w-0">
          <PanelHead
            title="Availability"
            meta={`${week.rangeLabel} \u00b7 60-minute lessons, New Zealand time`}
          />
          <PanelBody>
            <DemoCalendar
              blocks={blocks}
              dayLabels={week.dayLabels}
              todayIndex={week.todayIndex}
              pastCount={week.pastCount}
              size="comfortable"
              familySafe
              ariaLabel={`Bookable times for ${tutor.firstName}`}
              legend={{}}
            />
          </PanelBody>
          {isStoryTutor ? (
            <div className="flex flex-wrap items-center gap-4 border-t border-surface-border bg-brand-tint/45 px-5 py-4">
              <DemoButton href="/demo/parent/find/format" size="lg">
                Book a lesson
              </DemoButton>
              <p className="max-w-[46ch] text-[13.5px] text-text-secondary">
                {tutor.firstName} still has to accept &mdash; you are sending a request, not
                confirming a booking.
              </p>
            </div>
          ) : (
            <div className="border-t border-surface-border px-5 py-4">
              <Aside title="The demo story follows Daniel">
                <span className="flex flex-wrap items-center gap-3">
                  {tutor.firstName}&rsquo;s profile is here to show what a card leads to.
                  <DemoButton href="/demo/parent/tutors/daniel" tone="tertiary" size="sm">
                    Open Daniel
                  </DemoButton>
                </span>
              </Aside>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Everything else about him ───────────────────────────────── */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead title="What a lesson is like" />
          <PanelBody>
            <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-text-secondary">
              {tutor.teachingApproach}
            </p>
          </PanelBody>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHead title="Teaching" />
            <PanelBody>
              <Facts>
                <Fact label="Subjects" value={tutor.subjects.join(', ')} />
                <Fact
                  label="Year levels"
                  value={yearLevelRangeLabel(tutor.yearLevelFrom, tutor.yearLevelTo)}
                />
                <Fact
                  label="Format"
                  value={formatLabel(tutor.offersOnline, tutor.offersInPerson)}
                />
                <Fact label="Suits" value={`Year ${String(JACOB.schoolYear)}`} />
              </Facts>
            </PanelBody>
          </Panel>

          <Panel tone="quiet">
            <PanelHead title="Verification" meta={`${String(tutor.verificationLabels.length)}`} />
            <PanelBody className="flex flex-wrap gap-1.5">
              {tutor.verificationLabels.map((label) => (
                <Chip key={label} tone="neutral">
                  {verificationLabel(label)}
                </Chip>
              ))}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </ParentShell>
  );
}
