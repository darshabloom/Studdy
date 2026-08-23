import { redirect } from 'next/navigation';
import { bookingHref, paramsUpTo, type RawSearchParams } from '@/lib/booking/draft';
import { resolveBooking } from '@/lib/booking/resolve';

export const metadata = { title: 'Book a lesson' };

/**
 * The way in, from anywhere.
 *
 * A tutor card links here with whatever it already knows — the tutor always,
 * and the child and subject when the family was browsing in a subject context.
 * This resolves those answers, discards any that no longer hold, and sends the
 * family to the first question that is actually still open. So one URL serves a
 * cold start, a prefilled entry and a returning half-finished journey, and no
 * caller has to work out which it is.
 */
export default async function BookEntryPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const booking = await resolveBooking(raw);
  if (booking === null) {
    const query = new URLSearchParams(
      Object.entries(raw).flatMap(([key, value]) =>
        value === undefined
          ? []
          : Array.isArray(value)
            ? value.map((v) => [key, v] as [string, string])
            : [[key, value] as [string, string]],
      ),
    ).toString();
    redirect(`/sign-in?next=${encodeURIComponent(query === '' ? '/book' : `/book?${query}`)}`);
  }

  redirect(bookingHref(booking.nextStep, paramsUpTo(booking.nextStep, booking.params)));
}
