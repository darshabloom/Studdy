import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findRequestForTutor, tutorProfileForUser } from '@studdy/database';
import { Alert, Button, Card, RestrictedState } from '@studdy/design-system';
import {
  TutorRequestStatus,
  formatDeadline,
  formatLessonDateTime,
  formatMoney,
} from '@/components/requests/request-status';
import { resolveIdentity } from '@/lib/identity/resolve';
import { TutorResponseForm } from './tutor-response-form';

export const metadata = { title: 'Lesson request' };

/**
 * ONE request, addressed by its TREQ- reference (design §3.3 step 4).
 *
 * SP-007 previously recorded "no HTTP-status oracle" as a confirmed-safe
 * property, on the grounds that no tutor-side `[reference]` route existed. This
 * route removes that property, so the four conditions §9 attaches to it are
 * carried here explicitly:
 *
 * 1. The tutor's identity comes ONLY from the session — `resolveIdentity` then
 *    `tutorProfileForUser`. No parameter, form field or header contributes.
 * 2. The TREQ- reference is random (SP-009), so references cannot be walked.
 * 3. Ownership is part of the authoritative query:
 *    `findRequestForTutor(reference, tutorProfileId)` filters on both, rather
 *    than loading a row and checking it afterwards.
 * 4. A reference that does not exist and one that exists but belongs to another
 *    tutor behave IDENTICALLY — both return null from the same query and reach
 *    the same `notFound()`, so the status, body and headers are the same, and
 *    the work done before answering is the same query either way. Condition 4
 *    is the one that carries the property SP-007 used to get for free, and it
 *    is asserted by test rather than argued here.
 */
export default async function TutorRequestPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
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

  const request = await findRequestForTutor(reference, profile.id);
  if (request === null) notFound();

  const open = request.statusCode === 'sent';
  const stillOffered = request.offeredTimes.filter((option) => option.statusCode === 'offered');
  const accepted = request.offeredTimes.find((option) => option.statusCode === 'claimed');
  /*
   * Booked, as opposed to merely held. Read from this tutor's own reservation
   * row rather than inferred from a null expiry, which a pre-payment-window row
   * also has.
   */
  const isBooked = request.holdTypeCode === 'booking_confirmed';

  return (
    <>
      <Button variant="quiet" size="sm" asChild>
        <Link href="/tutor/requests">← Back to requests</Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{request.reference}</p>
          <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
            {request.subjectDisplayName} with {request.studentPreferredName}
          </h1>
        </div>
        <TutorRequestStatus statusCode={request.statusCode} />
      </div>

      <Card className="mt-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">Lesson length</dt>
            <dd className="font-medium">{request.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Format</dt>
            <dd className="font-medium">
              {request.formatCode === 'online' ? 'Online' : 'In person'}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Your price</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(request.priceAmountMinor, request.currencyCode)}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Reply by</dt>
            <dd className="font-medium">{formatDeadline(request.respondByAt, request.timeZone)}</dd>
          </div>
          {request.studentSchoolYearCode !== null ? (
            <div>
              <dt className="text-text-secondary">Year</dt>
              <dd className="font-medium">{request.studentSchoolYearCode}</dd>
            </div>
          ) : null}
        </dl>

        {request.notesForTutors !== null ? (
          <div className="mt-4 border-t border-surface-border pt-4">
            <h2 className="text-sm font-semibold text-text-primary">From the family</h2>
            <p className="mt-1 text-text-secondary">{request.notesForTutors}</p>
          </div>
        ) : null}
      </Card>

      {accepted !== undefined ? (
        <div className="mt-6">
          {/*
           * A CONFIRMED BOOKING IS NOT A HOLD, and until this slice the tutor
           * screen had no way to say so — a paid lesson kept reading "this may
           * or may not become a booking", which is a temporary claim on a
           * calendar the family has already paid for.
           *
           * The signal is the tutor's own reservation type, flipped to
           * `booking_confirmed` by the fulfilment transaction. The same row the
           * availability calendar already labels "Confirmed lesson", so the two
           * screens cannot disagree.
           *
           * The REQUEST's status is untouched and still `selected` — the seven
           * Tutor Request statuses do not gain a `confirmed`, and the booking
           * is recorded where it actually lives.
           */}
          {isBooked ? (
            <Alert tone="success" title="This lesson is booked">
              <p>{formatLessonDateTime(accepted.startAt, request.timeZone)}</p>
              <p className="mt-1">
                The family has paid and this time is confirmed on your calendar. It no longer
                expires.
              </p>
            </Alert>
          ) : (
            <Alert tone="information" title="You accepted this time">
              <p>{formatLessonDateTime(accepted.startAt, request.timeZone)}</p>
              {request.holdExpiresAt !== null ? (
                <p className="mt-1">
                  It is held on your calendar until{' '}
                  {formatDeadline(request.holdExpiresAt, request.timeZone)}. The family is choosing
                  now — this may or may not become a booking, and the hold is released either way
                  when it expires.
                </p>
              ) : null}
            </Alert>
          )}
        </div>
      ) : null}

      {open ? (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Can you do one of these times?</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Accepting holds the time on your calendar while the family decides. You can accept one
            time.
          </p>
          <TutorResponseForm
            reference={request.reference}
            options={stillOffered.map((option) => ({
              id: option.tutorRequestTimeOptionId,
              label: formatLessonDateTime(option.startAt, request.timeZone),
            }))}
          />
        </Card>
      ) : (
        <div className="mt-6">
          <Alert tone="information" title="This request is closed">
            There is nothing more to do here.
          </Alert>
        </div>
      )}
    </>
  );
}
