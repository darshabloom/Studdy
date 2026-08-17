import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listRequestsForStudents } from '@studdy/database';
import { Button, Card, EmptyState } from '@studdy/design-system';
import { FamilyRequestStatus, formatLessonDateTime } from '@/components/requests/request-status';
import { resolveDiscoveryContext } from '@/lib/discovery/context';

export default async function RequestsPage() {
  const context = await resolveDiscoveryContext();
  if (context === null) redirect('/sign-in?next=%2Frequests');

  const requests = await listRequestsForStudents(
    context.students.map((student) => student.studentProfileId),
  );

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
          Lesson requests
        </h1>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/tutors">Find a tutor</Link>
        </Button>
      </div>

      {requests.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No lesson requests yet"
            description="Shortlist tutors for a subject, then send your request to up to three of them at once."
            action={
              <Button asChild>
                <Link href="/tutors">Find a tutor</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {requests.map((request) => (
            <li key={request.intendedLessonRequestId}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">
                      {request.subjectDisplayName} for {request.studentPreferredName}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {request.timeOptions.length === 0
                        ? 'No times recorded'
                        : `${formatLessonDateTime(request.timeOptions[0]!.startAt, request.timeZone)}${
                            request.timeOptions.length > 1
                              ? ` and ${String(request.timeOptions.length - 1)} other ${
                                  request.timeOptions.length === 2 ? 'time' : 'times'
                                }`
                              : ''
                          }`}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Sent to {request.tutorRequests.length}{' '}
                      {request.tutorRequests.length === 1 ? 'tutor' : 'tutors'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <FamilyRequestStatus
                      statusCode={request.statusCode}
                      closeReasonCode={request.closeReasonCode}
                    />
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/requests/${request.reference}`}>View request</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
