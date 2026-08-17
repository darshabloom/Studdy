/**
 * The zone lessons are scheduled and displayed in.
 *
 * Studdy is a New Zealand platform and a lesson happens on one clock. Showing
 * each viewer their own zone would mean a parent overseas and the tutor
 * comparing different times for the same lesson, so availability, request
 * composition and every rendered slot use this zone throughout.
 *
 * It is a constant rather than configuration for now. When Studdy serves a
 * second country this becomes per-tutor or per-region, and the compiler will
 * point at every place that has to change.
 */
export const PLATFORM_TIME_ZONE = 'Pacific/Auckland';

/** How far ahead family-facing availability is derived and shown. */
export const AVAILABILITY_WINDOW_DAYS = 14;

/** The window as a pair of instants, from now. */
export function availabilityWindow(now: Date = new Date()): { from: Date; to: Date } {
  return { from: now, to: new Date(now.getTime() + AVAILABILITY_WINDOW_DAYS * 86_400_000) };
}
