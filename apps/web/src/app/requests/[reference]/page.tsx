import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { findRequestForStudents } from '@studdy/database';
import { Alert, Button, Card } from '@studdy/design-system';
import {
  FamilyRequestStatus,
  FamilyTutorRequestStatus,
  formatDeadline,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { resolveDiscoveryContext } from '@/lib/discovery/context';
import { withdrawRequestAction } from '@/lib/requests/actions';

const LIVE_STATUSES = new Set(['sent', 'accepted', 'selected']);

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const context = await resolveDiscoveryContext();
  if (context === null) redirect(`/sign-in?next=%2Frequests%2F${reference}`);

  const request = await findRequestForStudents(
    reference,
    context.students.map((student) => student.studentProfileId),
  );
  if (request === null) notFound();

  const liveCount = request.tutorRequests.filter((entry) =>
    LIVE_STATUSES.has(entry.statusCode),
  ).length;
  const isOpen =
    request.statusCode === 'awaiting_responses' || request.statusCode === 'ready_for_selection';
  const acceptedCount = request.tutorRequests.filter(
    (entry) => entry.statusCode === 'accepted',
  ).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{request.reference}</p>
          <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
            {request.subjectDisplayName} for {request.studentPreferredName}
          </h1>
        </div>
        <FamilyRequestStatus
          statusCode={request.statusCode}
          closeReasonCode={request.closeReasonCode}
        />
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-semibold">The lesson you asked for</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">Times you offered</dt>
            <dd className="font-medium">
              <ul className="flex flex-col gap-1">
                {request.timeOptions.map((option) => (
                  <li key={option.startAt.toISOString()} className="tabular-nums">
                    {formatLessonDateTime(option.startAt, request.timeZone)}
                    {option.statusCode === 'taken' ? ' · taken' : ''}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Length</dt>
            <dd className="font-medium">{request.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Format</dt>
            <dd className="font-medium">
              {request.formatCode === 'online' ? 'Online' : 'In person'}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Choose a tutor by</dt>
            <dd className="font-medium">
              {formatDeadline(request.decisionDeadlineAt, request.timeZone)}
            </dd>
          </div>
        </dl>
        {request.notesForTutors !== null ? (
          <div className="mt-4">
            <p className="text-sm text-text-secondary">What you told the tutors</p>
            <p className="mt-1 text-sm">{request.notesForTutors}</p>
          </div>
        ) : null}
      </Card>

      {request.statusCode === 'ready_for_selection' && acceptedCount > 0 ? (
        <div className="mt-6">
          <Alert tone="information" title="Ready for you to choose">
            <p>
              {acceptedCount === 1
                ? 'A tutor has accepted one of your times.'
                : `${String(acceptedCount)} tutors have accepted one of your times.`}{' '}
              Choosing keeps that tutor&rsquo;s time and closes the others. Nothing is charged yet.
            </p>
            <p className="mt-3">
              <Button size="sm" asChild>
                <Link href={`/requests/${request.reference}/select`}>Choose your tutor</Link>
              </Button>
            </p>
          </Alert>
        </div>
      ) : request.statusCode === 'awaiting_payment' ? (
        <div className="mt-6">
          <Alert tone="information" title="You chose your tutor">
            Their time is held while payment is set up. The lesson is not booked until that is done,
            and payment arrives in the next release.
          </Alert>
        </div>
      ) : isOpen ? (
        <div className="mt-6">
          <Alert tone="information" title="What happens next">
            Each tutor replies separately, and no tutor can see who else you asked. When one accepts
            a time you offered, you will be able to choose them here. Nothing is held or charged
            until then.
          </Alert>
        </div>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold">
        Tutors you asked ({request.tutorRequests.length})
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {request.tutorRequests.map((entry) => (
          <li key={entry.tutorRequestId}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{entry.tutorFirstName}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatMoney(entry.priceAmountMinor, entry.currencyCode)} for this lesson
                  </p>
                  {LIVE_STATUSES.has(entry.statusCode) ? (
                    <p className="mt-1 text-sm text-text-secondary">
                      Reply due by {formatDeadline(entry.respondByAt, request.timeZone)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <FamilyTutorRequestStatus
                    statusCode={entry.statusCode}
                    closeReasonCode={entry.closeReasonCode}
                  />
                  {isOpen && LIVE_STATUSES.has(entry.statusCode) && liveCount > 1 ? (
                    <form action={withdrawRequestAction}>
                      <input type="hidden" name="reference" value={request.reference} />
                      <input type="hidden" name="tutorRequestId" value={entry.tutorRequestId} />
                      <Button type="submit" variant="quiet" size="sm">
                        Withdraw this tutor
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {isOpen ? (
        <Card className="mt-8" tone="secondary">
          <h2 className="text-lg font-semibold">Withdraw this request</h2>
          <p className="mt-1 text-sm text-text-secondary">
            This closes the request with every tutor and frees the times they were holding. It
            cannot be undone — you would need to send a new request.
          </p>
          <form action={withdrawRequestAction} className="mt-3">
            <input type="hidden" name="reference" value={request.reference} />
            <Button type="submit" variant="destructive" size="sm">
              Withdraw the whole request
            </Button>
          </form>
        </Card>
      ) : (
        <div className="mt-8">
          <Alert tone="information" title="This request is closed">
            Your shortlist is still saved, so you can send a new request whenever you are ready.{' '}
            <Link href="/tutors" className="font-medium underline">
              Find a tutor
            </Link>
          </Alert>
        </div>
      )}
    </>
  );
}
