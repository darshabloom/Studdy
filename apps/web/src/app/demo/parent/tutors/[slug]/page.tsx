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
  PageHead,
  SectionLine,
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

      <div className="mt-4 flex items-start gap-4">
        <Disc initials={tutor.initials} size="lg" />
        <div className="min-w-0 flex-1">
          <PageHead title={tutor.firstName} sub={tutor.headline} />
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[20px] font-semibold tabular-nums text-text-primary">
            {money(tutor.hourlyMinor)}
          </p>
          <p className="text-[11.5px] text-text-muted">per hour</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        <Chip tone="neutral">{availabilityLabel(tutor.availabilityLabelCode)}</Chip>
        {rating === null ? null : <Chip tone="neutral">{rating} rating</Chip>}
        <Chip tone="neutral">{tutor.completedLessonCount} lessons</Chip>
      </div>

      <section className="mt-8">
        <SectionLine title="Availability" meta={week.rangeLabel} />
        <p className="mt-3 text-[13.5px] text-text-muted">
          60-minute lessons, shown in New Zealand time.
        </p>
        <div className="mt-4">
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
        </div>

        {isStoryTutor ? (
          <div className="mt-6 flex flex-wrap items-center gap-4 border-l-2 border-brand bg-brand-tint/40 px-5 py-4">
            <DemoButton href="/demo/parent/find/format" size="lg">
              Book a lesson
            </DemoButton>
            <p className="text-[13.5px] text-text-secondary">
              {tutor.firstName} still has to accept &mdash; you are sending a request, not
              confirming a booking.
            </p>
          </div>
        ) : (
          <div className="mt-6">
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
      </section>

      <section className="mt-9 max-w-[68ch]">
        <SectionLine title="What a lesson is like" />
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          {tutor.teachingApproach}
        </p>
      </section>

      <section className="mt-9 grid gap-x-10 sm:grid-cols-2">
        <div>
          <SectionLine title="Teaching" />
          <div className="mt-3">
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
          </div>
        </div>
        <div>
          <SectionLine title="Verification" />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {tutor.verificationLabels.map((label) => (
              <Chip key={label} tone="neutral">
                {verificationLabel(label)}
              </Chip>
            ))}
          </div>
        </div>
      </section>
    </ParentShell>
  );
}
