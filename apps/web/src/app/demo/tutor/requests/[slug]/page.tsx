import { notFound } from 'next/navigation';
import { TutorShell } from '@/components/demo/demo-shells';
import { DemoAcceptForm } from '@/components/demo/demo-accept-form';
import {
  Aside,
  Chip,
  DemoButton,
  Disc,
  EarningsSplit,
  Fact,
  Facts,
  Panel,
  PanelBody,
  PanelHead,
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
export default async function TutorRequestPage({ params }: { params: Promise<{ slug: string }> }) {
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

      {/* ── Who is asking ───────────────────────────────────────────── */}
      <div className="mt-4">
        <Panel tone={request.urgent ? 'attention' : 'hero'}>
          <PanelBody className="flex flex-wrap items-start gap-x-7 gap-y-5 py-5">
            <Disc initials={request.studentInitials} size="lg" />
            <div className="min-w-[220px] flex-1">
              <p className="text-[12.5px] text-text-muted">{request.reference}</p>
              <h1 className="mt-1 font-display text-[27px] font-semibold leading-tight tracking-[-0.018em] text-text-primary">
                {request.studentFirstName} &middot; Year {request.schoolYear}
              </h1>
              <p className="mt-1 text-[13px] text-text-muted">
                {request.parentName} &middot; {service?.name ?? 'Maths'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {request.urgent ? (
                <Chip tone="attention">
                  Reply by {formatDeadline(request.respondByAt, PLATFORM_TIME_ZONE)}
                </Chip>
              ) : request.isExistingStudent ? (
                <Chip tone="current">Your student</Chip>
              ) : (
                <Chip tone="ghost">New family</Chip>
              )}
              <p className="text-[12.5px] text-text-muted">
                {money(request.priceMinor)} to the family
              </p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <PanelHead title="What they are asking for" />
            <PanelBody>
              <Facts>
                <Fact label="Service" value={service?.name ?? 'Maths'} />
                <Fact label="Lesson length" value={`${String(request.durationMinutes)} minutes`} />
                <Fact label="Format" value={request.format === 'online' ? 'Online' : 'In person'} />
                <Fact label="Year" value={`Year ${String(request.schoolYear)}`} />
                <Fact
                  label="Reply by"
                  value={formatDeadline(request.respondByAt, PLATFORM_TIME_ZONE)}
                />
              </Facts>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead title="From the family" />
            <PanelBody>
              <p className="max-w-[64ch] text-[14.5px] leading-relaxed text-text-secondary">
                {request.note}
              </p>
            </PanelBody>
          </Panel>

          <Panel tone="quiet">
            <PanelHead title="Context" />
            <PanelBody>
              {request.isExistingStudent && request.student !== null ? (
                <Aside title={`You already teach ${request.studentFirstName}`}>
                  {request.student.standing}. {request.student.lessonsSoFar} lessons so far.
                </Aside>
              ) : (
                <Aside title="This family is new to you">
                  Nothing here is a commitment beyond the one lesson. If it goes well, they can ask
                  for a standing slot afterwards.
                </Aside>
              )}
            </PanelBody>
          </Panel>
        </div>

        {/* What saying yes is worth, before saying it. */}
        <Panel tone="quiet">
          <PanelHead title="If you accept" />
          <PanelBody>
            <EarningsSplit grossMinor={request.priceMinor} label="You would earn" />
            <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
              Paid out after the lesson, once the family&rsquo;s payment has cleared. Accepting is
              not a booking.
            </p>
          </PanelBody>
        </Panel>
      </div>

      {/* ── The decision ────────────────────────────────────────────── */}
      <div className="mt-5">
        <Panel>
          <PanelHead
            title="Can you do one of these times?"
            meta={`${String(request.offered.length)} offered`}
          />
          <PanelBody>
            <p className="mb-4 text-[13.5px] text-text-secondary">
              Accepting holds the time on your calendar while the family decides. You can accept
              one.
            </p>
            <DemoAcceptForm
              options={request.offered.map((option) => ({
                id: option.at.toISOString(),
                label: formatLessonDateTime(option.at, PLATFORM_TIME_ZONE),
              }))}
              acceptHref={`/demo/tutor/requests/${request.slug}/accepted`}
              declineHref="/demo/tutor/requests"
            />
          </PanelBody>
        </Panel>
      </div>
    </TutorShell>
  );
}
