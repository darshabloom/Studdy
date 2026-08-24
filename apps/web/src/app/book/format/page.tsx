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
 * Online or in person — asked only when it is genuinely a question.
 *
 * A tutor's service version may permit one format or both. Where it permits
 * one, `resolveBooking` has already settled the answer and the length step
 * links straight past this screen: showing a page with a single option and no
 * decision would be a step that exists to be clicked through.
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
      description={`${tutor.firstName} teaches this lesson either way.`}
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
          detail: COPY[format].detail,
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
