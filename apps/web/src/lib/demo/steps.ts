/**
 * THE SHAPE OF EACH DEMO JOURNEY.
 *
 * The demo has no state store, no session and no reducer: the URL IS the state.
 * Every step is its own server-rendered route, so the same click always reaches
 * the same screen, every screen is directly linkable for a screenshot, and
 * "restart" is a link rather than a reset.
 *
 * This file is the single place that knows the order. The progress rail, the
 * Back links and the Continue buttons all read it, so a step cannot be added in
 * one place and forgotten in another.
 */

export interface DemoStep {
  readonly key: string;
  /** Rail label — one or two words, because nine of them share a row. */
  readonly label: string;
  readonly href: string;
}

export const DEMO_PARENT_STEPS: readonly DemoStep[] = [
  { key: 'find', label: 'Find', href: '/demo/parent/tutors' },
  { key: 'profile', label: 'Profile', href: '/demo/parent/tutors/aroha' },
  { key: 'lesson', label: 'Lesson', href: '/demo/parent/book/format' },
  { key: 'times', label: 'Times', href: '/demo/parent/book/times' },
  { key: 'review', label: 'Review', href: '/demo/parent/book/review' },
  { key: 'request', label: 'Request', href: '/demo/parent/request' },
  { key: 'choose', label: 'Choose', href: '/demo/parent/request/accepted' },
  { key: 'pay', label: 'Pay', href: '/demo/parent/pay' },
  { key: 'booked', label: 'Booked', href: '/demo/parent/booked' },
];

export const DEMO_TUTOR_STEPS: readonly DemoStep[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/demo/tutor' },
  { key: 'request', label: 'Request', href: '/demo/tutor/requests' },
  { key: 'inspect', label: 'Inspect', href: '/demo/tutor/requests/aroha-maths' },
  { key: 'accepted', label: 'Accepted', href: '/demo/tutor/accepted' },
  { key: 'calendar', label: 'Confirmed', href: '/demo/tutor/calendar' },
];

/** The step after `key`, or null at the end of the journey. */
export function nextStep(steps: readonly DemoStep[], key: string): DemoStep | null {
  const index = steps.findIndex((step) => step.key === key);
  return index === -1 ? null : (steps[index + 1] ?? null);
}

/** The step before `key`, or null at the start. */
export function previousStep(steps: readonly DemoStep[], key: string): DemoStep | null {
  const index = steps.findIndex((step) => step.key === key);
  return index <= 0 ? null : (steps[index - 1] ?? null);
}
