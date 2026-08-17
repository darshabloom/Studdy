import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { findRequestForStudents } from '@studdy/database';
import { Alert, Button, EmptyState } from '@studdy/design-system';
import { formatLessonDateTime, formatMoney } from '@/components/requests/request-status';
import { resolveDiscoveryContext } from '@/lib/discovery/context';
import { SelectionForm } from './selection-form';

export const metadata = { title: 'Choose your tutor' };

/**
 * Compare accepted tutor and time combinations, and choose one (design §3.1
 * step 10, D-5).
 *
 * Different tutors may have accepted different times, so this is a single
 * choice of a tutor AND a time together — not a tutor first and a time after.
 */
export default async function SelectTutorPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const context = await resolveDiscoveryContext();
  if (context === null) redirect(`/sign-in?next=%2Frequests%2F${reference}%2Fselect`);

  const request = await findRequestForStudents(
    reference,
    context.students.map((student) => student.studentProfileId),
  );
  if (request === null) notFound();

  const backHref = `/requests/${request.reference}`;

  // Only accepted requests can be chosen, and each carries the one time that
  // tutor claimed.
  const choices = request.tutorRequests.flatMap((entry) => {
    if (entry.statusCode !== 'accepted') return [];
    const claimed = entry.offeredTimes.find((option) => option.statusCode === 'claimed');
    return claimed === undefined ? [] : [{ entry, claimed }];
  });

  if (request.statusCode !== 'ready_for_selection' || choices.length === 0) {
    return (
      <>
        <Button variant="quiet" size="sm" asChild>
          <Link href={backHref}>← Back to the request</Link>
        </Button>
        <div className="mt-4">
          <EmptyState
            title={
              request.statusCode === 'awaiting_responses'
                ? 'No one has accepted yet'
                : 'There is nothing to choose here'
            }
            description={
              request.statusCode === 'awaiting_responses'
                ? 'When a tutor accepts one of your times, you will be able to choose them here. Nothing is held until then.'
                : 'This request has already moved on. Open it to see where things stand.'
            }
            action={
              <Button asChild>
                <Link href={backHref}>See the request</Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Button variant="quiet" size="sm" asChild>
        <Link href={backHref}>← Back to the request</Link>
      </Button>

      <div className="mt-4">
        <p className="text-sm text-text-muted">{request.reference}</p>
        <h1 className="font-display text-3xl font-semibold text-brand-purple-deep">
          Choose your tutor
        </h1>
        <p className="mt-2 text-text-secondary">
          {request.subjectDisplayName} for {request.studentPreferredName}. Each tutor below accepted
          the time shown, so you are choosing the tutor and the time together.
        </p>
      </div>

      <div className="mt-6">
        <Alert tone="information" title="What happens when you choose">
          The tutor you choose keeps the time on their calendar, and the others are told the request
          is closed. Payment setup comes next — nothing is charged yet, and the lesson is not booked
          until that is done.
        </Alert>
      </div>

      <SelectionForm
        reference={request.reference}
        choices={choices.map((candidate) => ({
          tutorRequestReference: candidate.entry.reference,
          tutorFirstName: candidate.entry.tutorFirstName,
          whenLabel: formatLessonDateTime(candidate.claimed.startAt, request.timeZone),
          priceLabel: formatMoney(candidate.entry.priceAmountMinor, candidate.entry.currencyCode),
        }))}
      />
    </>
  );
}
