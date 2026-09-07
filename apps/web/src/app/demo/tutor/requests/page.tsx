import { TutorShell } from '@/components/demo/demo-shells';
import {
  Aside,
  Chip,
  DemoButton,
  Disc,
  Facts,
  Fact,
  PageHead,
  Row,
  RowList,
  RowMain,
  RowMeta,
  SectionLine,
} from '@/components/demo/kit';
import { formatDeadline, formatLessonDateTime } from '@/components/requests/request-status';
import { money, serviceById } from '@/lib/demo/fixtures';
import { inboxRequests } from '@/lib/demo/schedule';
import { PLATFORM_TIME_ZONE } from '@/lib/time';

export const metadata = { title: 'Lesson requests' };

/**
 * A TUTOR SEES ONLY THEIR OWN REQUESTS.
 *
 * The production projection behind this screen selects no Intended Lesson
 * Request identifier, no slot position and no close reason, so nothing here can
 * reveal whether other tutors were asked, how many, who they were, or how they
 * responded. The demo data is shaped the same way — there is no field on this
 * page that could carry it — because a demo that quietly showed more than the
 * product does would misrepresent the thing it is demonstrating.
 */
export default function TutorRequestsPage() {
  const now = new Date();
  const requests = inboxRequests(now);

  return (
    <TutorShell active="/demo/tutor/requests">
      <PageHead
        title="Lesson requests"
        sub="Families ask for a lesson at times that suit them. You accept the one that fits your week."
      />

      <div className="mt-6">
        <Aside title="Accepting holds the time">
          Accepting puts that hour on your calendar while the family decides and pays. It is not a
          booking yet, and the hold is released either way when it expires.
        </Aside>
      </div>

      <section className="mt-8">
        <SectionLine title="Awaiting your response" meta={`${requests.length}`} />
        <div className="mt-1">
          <RowList>
            {requests.map((request) => (
              <Row
                key={request.reference}
                href={`/demo/tutor/requests/${request.slug}`}
                attention={request.urgent}
              >
                <Disc initials={request.studentInitials} />
                <RowMain
                  name={`${request.studentFirstName} · Year ${String(request.schoolYear)}`}
                  detail={`${serviceById(request.serviceId)?.name ?? 'Maths'} · ${String(request.durationMinutes)} min · ${request.format === 'online' ? 'Online' : 'In person'}`}
                />
                {request.urgent ? (
                  <Chip tone="attention">
                    Reply by {formatDeadline(request.respondByAt, PLATFORM_TIME_ZONE)}
                  </Chip>
                ) : request.isExistingStudent ? (
                  <Chip tone="current">Your student</Chip>
                ) : (
                  <Chip tone="ghost">New family</Chip>
                )}
                <RowMeta>
                  {money(request.priceMinor)}
                  <span className="mt-0.5 block text-text-muted">
                    {request.offered.length} times offered
                  </span>
                </RowMeta>
              </Row>
            ))}
          </RowList>
        </div>
      </section>

      <section className="mt-10">
        <SectionLine title="The times you were offered" />
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          {requests.map((request) => (
            <div key={request.reference}>
              <p className="font-display text-[16px] font-medium text-text-primary">
                {request.studentFirstName}
              </p>
              <div className="mt-2">
                <Facts>
                  {request.offered.map((option) => (
                    <Fact
                      key={option.id}
                      label={formatLessonDateTime(option.at, PLATFORM_TIME_ZONE).split(' at ')[0] ?? ''}
                      value={formatLessonDateTime(option.at, PLATFORM_TIME_ZONE).split(' at ')[1] ?? ''}
                    />
                  ))}
                </Facts>
              </div>
              <div className="mt-3">
                <DemoButton
                  href={`/demo/tutor/requests/${request.slug}`}
                  tone={request.urgent ? 'primary' : 'tertiary'}
                  size="sm"
                >
                  Open request
                </DemoButton>
              </div>
            </div>
          ))}
        </div>
      </section>
    </TutorShell>
  );
}
