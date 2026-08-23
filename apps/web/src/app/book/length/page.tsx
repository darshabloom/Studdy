import { redirect } from 'next/navigation';
import { BookingShell } from '@/components/booking/booking-shell';
import { ChoiceEmpty, ChoiceList } from '@/components/booking/choice-list';
import { formatsForVersion } from '@studdy/database';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
import { resolveBooking, stepIsReachable } from '@/lib/booking/resolve';

export const metadata = { title: 'How long should the lesson be?' };

function money(amountMinor: bigint, currencyCode: string): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: currencyCode }).format(
    Number(amountMinor) / 100,
  );
}

/**
 * Lesson length, from what this tutor actually publishes.
 *
 * NOT A FREE CHOICE OF MINUTES. Every option here is one of the tutor's own
 * priced service versions, and what travels forward is that version's id — so
 * the price a family is shown is the price the request is created at, and there
 * is no number in the URL for anyone to edit into a cheaper lesson.
 */
export default async function BookLengthPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const booking = await resolveBooking(raw);
  if (booking === null) redirect('/sign-in?next=%2Fbook');
  if (!stepIsReachable('length', booking.nextStep)) {
    redirect(bookingHref(booking.nextStep, booking.params));
  }

  const { tutor, params } = booking;
  if (tutor === null)
    redirect(bookingHref('tutor', { child: params.child, subject: params.subject }));

  // Knowable here, and worth knowing: if not one of this tutor's versions can
  // be delivered both ways, the format question will never be asked, and the
  // rail should not promise a step that is not coming.
  const formatAlwaysSettled = tutor.versions.every(
    (candidate) => formatsForVersion(candidate).length === 1,
  );

  return (
    <BookingShell
      step="length"
      nextStep={booking.nextStep}
      params={params}
      skipped={formatAlwaysSettled ? ['format'] : []}
      title={`How long should the lesson with ${tutor.firstName} be?`}
      description={`These are the lessons ${tutor.firstName} offers for this subject.`}
    >
      <ChoiceList
        ariaLabel="Lesson lengths"
        choices={tutor.versions.map((version) => {
          const formats = formatsForVersion(version);
          return {
            key: version.serviceVersionId,
            // Where the tutor delivers this version only one way, the format
            // answer is settled here and the format step never appears.
            href: bookingHref(formats.length === 1 ? 'times' : 'format', {
              child: params.child,
              subject: params.subject,
              tutor: params.tutor,
              version: version.serviceVersionId,
              format: formats.length === 1 ? (formats[0] ?? null) : null,
            }),
            title: `${String(version.durationMinutes)} minutes`,
            detail:
              formats.length === 1
                ? formats[0] === 'online'
                  ? 'Online'
                  : 'In person'
                : 'Online or in person',
            meta: money(version.priceAmountMinor, version.currencyCode),
            selected: version.serviceVersionId === params.version,
          };
        })}
        empty={
          <ChoiceEmpty
            title={`${tutor.firstName} is not offering this subject at the moment`}
            description="Go back and choose another tutor."
          />
        }
      />
    </BookingShell>
  );
}
