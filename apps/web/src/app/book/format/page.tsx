import { redirect } from 'next/navigation';
import { BookingShell } from '@/components/booking/booking-shell';
import { ChoiceEmpty, ChoiceList } from '@/components/booking/choice-list';
import { bookingHref, type RawSearchParams } from '@/lib/booking/draft';
import { summaryRows } from '@/lib/booking/summary';
import { resolveBooking, stepIsReachable } from '@/lib/booking/resolve';

export const metadata = { title: 'Online or in person?' };

const COPY = {
  online: {
    title: 'Online',
    detail: 'A video lesson. Nobody travels, and the lesson can happen anywhere.',
  },
  in_person: {
    title: 'In person',
    detail: 'You and the tutor arrange where, once the lesson is confirmed.',
  },
} as const;

/**
 * Online or in person — always asked, even when the answer can only be one.
 *
 * A tutor's service version may permit one format or both, and where it permits
 * one this screen shows that one and says why. It is deliberately NOT skipped:
 * "online only" is a condition of the lesson, and a family who needs someone in
 * the room should meet that fact here, while going back is cheap, rather than
 * discover it after a request has been sent. One eligible option is a fact
 * about the tutor; accepting it is still the parent's to do.
 *
 * The answer is always CONCRETE. `either` is a tutor's permission, never a
 * family's choice, and `validateFanOut` refuses it — a lesson happens one way
 * or the other and somebody has to know which.
 */
export default async function BookFormatPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const booking = await resolveBooking(raw);
  if (booking === null) redirect('/sign-in?next=%2Fbook');
  if (!stepIsReachable('format', booking.nextStep)) {
    redirect(bookingHref(booking.nextStep, booking.params));
  }

  const { tutor, version, formats, params } = booking;
  if (tutor === null || version === null) {
    redirect(
      bookingHref('length', { child: params.child, subject: params.subject, tutor: params.tutor }),
    );
  }

  return (
    <BookingShell
      step="format"
      params={params}
      rows={summaryRows(booking)}
      title="Online or in person?"
      description={
        formats.length === 1
          ? `This is the only way ${tutor.firstName} teaches this lesson. Confirm it works for you, or go back and choose a different length or tutor.`
          : `${tutor.firstName} teaches this lesson either way.`
      }
    >
      <ChoiceList
        ariaLabel="Lesson format"
        choices={formats.map((format) => ({
          key: format,
          href: bookingHref('times', {
            child: params.child,
            subject: params.subject,
            tutor: params.tutor,
            version: params.version,
            format,
          }),
          title: COPY[format].title,
          // Where it is the only option, the row says so itself — the choice
          // and the reason for it should not be a paragraph apart.
          detail:
            formats.length === 1
              ? `${tutor.firstName} offers this lesson ${format === 'online' ? 'online' : 'in person'} only. ${COPY[format].detail}`
              : COPY[format].detail,
          selected: format === params.format,
        }))}
        empty={
          <ChoiceEmpty
            title="This lesson has no available format"
            description="Go back and choose a different lesson length."
          />
        }
      />
    </BookingShell>
  );
}
