import type { TopNavItem } from '@/lib/parent/nav';

/**
 * The Tutor workspace's navigation: six destinations, across the top.
 *
 * Requests and Availability are views of the Calendar, so their routes light
 * Calendar; payout setup belongs to Earnings. Profile and Services are setup
 * rather than day-to-day work and sit beside the account, not in the main row.
 */
export const TUTOR_NAV: readonly TopNavItem[] = [
  { label: 'Home', href: '/tutor', exact: true },
  {
    label: 'Calendar',
    href: '/tutor/calendar',
    matches: ['/tutor/requests', '/tutor/availability'],
  },
  { label: 'Students', href: '/tutor/students' },
  { label: 'Lessons', href: '/tutor/lessons' },
  { label: 'Earnings', href: '/tutor/earnings', matches: ['/tutor/payments'] },
  { label: 'Resources', href: '/tutor/resources' },
];

export const TUTOR_SECONDARY_NAV: readonly { label: string; href: string }[] = [
  { label: 'Profile', href: '/tutor/profile' },
  { label: 'Services', href: '/tutor/services' },
];
