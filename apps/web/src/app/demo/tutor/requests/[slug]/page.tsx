import { notFound } from 'next/navigation';
import { TutorShell } from '@/components/demo/demo-shells';
import { DemoAcceptForm } from '@/components/demo/demo-accept-form';
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
import { formatDeadline, formatLessonDateTime } from '@/components/requests/request-status';
import { money, serviceById } from '@/lib/demo/fixtures';
import { requestBySlug } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Lesson request' };

/**
 * INSPECT AND ANSWER — the one tutor screen where something is decided.
 *
 * The copy is careful that accepting HOLDS the time rather than books it: the
 * family still has to choose this tutor and then pay, and a tutor who believes
 * a hold is a booking keeps an hour free for nothing.
 */
export default async function TutorRequestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = new Date();
  const request = requestBySlug(slug, now);
  if (request === null) notFound();

  const service = serviceById(request.serviceId);

  return (
    <TutorShell active="/demo/tutor/requests">
      <DemoButton href="/demo/tutor/requests" tone="quiet" size="sm">
        &larr; All requests
      </DemoButton>

      <div className="mt-4 flex items-start gap-4">
        <Disc initials={request.studentInitials} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-text-muted">{request.reference}</p>
          <PageHead
            title={`${request.studentFirstName} · Year ${String(request.schoolYear)}`}
            sub={`${request.parentName} · ${service?.name ?? 'Maths'}`}
          />
        </div>
        {request.urgent ? (
          <Chip tone="attention">
            Reply by {formatDeadline(request.respondByAt, PLATFORM_TIME_ZONE)}
          </Chip>
        ) : request.isExistingStudent ? (
          <Chip tone="current">Your student</Chip>
        ) : (
          <Chip tone="ghost">New family</Chip>
        )}
      </div>

      <section className="mt-8">
        <SectionLine title="What they are asking for" />
        <div className="mt-3 grid gap-x-10 gap-y-0 sm:grid-cols-2">
          <Facts>
            <Fact label="Lesson length" value={`${String(request.durationMinutes)} minutes`} />
            <Fact label="Format" value={request.format === 'online' ? 'Online' : 'In person'} />
            <Fact label="Year" value={`Year ${String(request.schoolYear)}`} />
          </Facts>
          <Facts>
            <Fact label="Service" value={service?.name ?? 'Maths'} />
            <Fact label="Your rate for this lesson" value={money(request.priceMinor)} />
            <Fact
              label="Reply by"
              value={formatDeadline(request.respondByAt, PLATFORM_TIME_ZONE)}
            />
          </Facts>
        </div>
      </section>

      <section className="mt-8">
        <SectionLine title="From the family" />
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-text-secondary">
          {request.note}
        </p>
      </section>

      {request.isExistingStudent && request.student !== null ? (
        <div className="mt-8">
          <Aside title={`You already teach ${request.studentFirstName}`}>
            {request.student.standing}. {request.student.lessonsSoFar} lessons so far.
          </Aside>
        </div>
      ) : (
        <div className="mt-8">
          <Aside title="This family is new to you">
            Nothing here is a commitment beyond the one lesson. If it goes well, they can ask for a
            standing slot afterwards.
          </Aside>
        </div>
      )}

      <section className="mt-9">
        <SectionLine title="Can you do one of these times?" />
        <p className="mt-3 text-[13.5px] text-text-secondary">
          Accepting holds the time on your calendar while the family decides. You can accept one.
        </p>
        <DemoAcceptForm
          options={request.offered.map((option) => ({
            id: option.at.toISOString(),
            label: formatLessonDateTime(option.at, PLATFORM_TIME_ZONE),
          }))}
          acceptHref={`/demo/tutor/requests/${request.slug}/accepted`}
          declineHref="/demo/tutor/requests"
        />
      </section>
    </TutorShell>
  );
}
