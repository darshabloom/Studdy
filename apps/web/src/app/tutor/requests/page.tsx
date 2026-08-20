import Link from 'next/link';
import { listRequestsForTutor, tutorProfileForUser } from '@studdy/database';
import { Alert, Card, EmptyState, RestrictedState } from '@studdy/design-system';
import {
  TutorRequestStatus,
  formatDeadline,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { resolveIdentity } from '@/lib/identity/resolve';

export const metadata = { title: 'Lesson requests' };

/**
 * TUTOR READ-ONLY REQUEST VIEW.
 *
 * A tutor sees ONLY their own requests. The projection behind this page
 * (`listRequestsForTutor`) selects no Intended Lesson Request identifier, no
 * slot position, and no close reason — so nothing on this page, in its URL, or
 * in its markup can reveal whether other tutors were asked, how many, who they
 * were, how they responded, or why a request ended.
 *
 * Accept and decline arrive in the tutor-response slice; this page says so
 * plainly rather than showing controls that do nothing.
 */
export default async function TutorRequestsPage() {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    return <RestrictedState title="Sign in to see your lesson requests" />;
  }

  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) {
    return (
      <RestrictedState
        title="Your tutor profile is not active yet"
        description="Lesson requests appear here once your tutor application is approved."
      />
    );
  }

  const requests = await listRequestsForTutor(profile.id);
  const awaiting = requests.filter((request) => request.statusCode === 'sent');

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
        Lesson requests
      </h1>
      <p className="mt-2 text-text-secondary">
        Families send you a request when they would like a lesson at a particular time.
      </p>

      <div className="mt-4">
        <Alert tone="information" title="Accepting holds the time">
          Open a request to accept one of the times you were offered, or to decline. Accepting holds
          that time on your calendar while the family decides.
        </Alert>
      </div>

      {requests.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No lesson requests yet"
            description="When a family asks you for a lesson, it will appear here with the time they have in mind and how long you have to reply."
          />
        </div>
      ) : (
        <>
          {awaiting.length > 0 ? (
            <p className="mt-6 text-sm font-medium text-text-secondary">
              {awaiting.length} awaiting your response
            </p>
          ) : null}
          <ul className="mt-3 flex flex-col gap-4">
            {requests.map((request) => (
              <li key={request.reference}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-text-muted">{request.reference}</p>
                      <p className="text-lg font-semibold">
                        <Link
                          className="hover:underline"
                          href={`/tutor/requests/${request.reference}`}
                        >
                          {request.subjectDisplayName} with {request.studentPreferredName}
                        </Link>
                      </p>
                      {/* The times THIS tutor was offered. Never a count of
                          the family's full set — only their own subset. */}
                      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-text-secondary">
                        {request.offeredTimes.map((option) => (
                          <li key={option.startAt.toISOString()} className="tabular-nums">
                            {formatLessonDateTime(option.startAt, request.timeZone)}
                            {/* Deliberately cause-free. Today `unavailable`
                                only ever means this tutor's own calendar
                                filled, but withdrawal and selection close-out
                                will land on the same status, and a wording
                                that named a cause would then either be false
                                or invite a second, distinguishing string. */}
                            {option.statusCode === 'unavailable' ? ' · no longer available' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <TutorRequestStatus statusCode={request.statusCode} />
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
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
                      <dt className="text-text-secondary">Year level</dt>
                      <dd className="font-medium">
                        {request.studentSchoolYearCode ?? 'Not given'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Your rate for this lesson</dt>
                      <dd className="font-medium">
                        {formatMoney(request.priceAmountMinor, request.currencyCode)}
                      </dd>
                    </div>
                  </dl>

                  {request.notesForTutors !== null ? (
                    <div className="mt-4">
                      <p className="text-sm text-text-secondary">What the family told you</p>
                      <p className="mt-1 text-sm">{request.notesForTutors}</p>
                    </div>
                  ) : null}

                  {/*
                    The temporary hold, labelled as temporary and always shown
                    with its expiry so it never appears open-ended.
                  */}
                  {request.statusCode === 'sent' && request.holdExpiresAt !== null ? (
                    <div className="mt-4 rounded-[var(--radius-medium)] border border-status-warning-border bg-status-warning-bg p-3">
                      <p className="text-sm font-semibold text-status-warning">
                        Temporary request hold
                      </p>
                      <p className="mt-1 text-sm text-text-primary">
                        This time is held in your calendar until{' '}
                        <strong>{formatDeadline(request.holdExpiresAt, request.timeZone)}</strong>.
                        If the request is not taken up by then, the hold is released automatically
                        and the time is yours again.
                      </p>
                    </div>
                  ) : null}

                  {request.statusCode === 'sent' ? (
                    <p className="mt-4 text-sm text-text-secondary">
                      Reply due by{' '}
                      <strong>{formatDeadline(request.respondByAt, request.timeZone)}</strong>.
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
