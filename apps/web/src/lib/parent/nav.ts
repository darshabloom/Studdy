/**
 * The Parent workspace's navigation: five destinations, across the top.
 *
 * `matches` lists the route prefixes that belong to a destination without
 * living under it — the shared request, booking and discovery routes a parent
 * reaches from here — so the bar keeps saying where they are.
 */
export interface TopNavItem {
  readonly label: string;
  readonly href: string;
  /** Home matches only itself; everything else matches its subtree. */
  readonly exact?: boolean;
  readonly matches?: readonly string[];
}

export const PARENT_NAV: readonly TopNavItem[] = [
  { label: 'Home', href: '/parent', exact: true },
  { label: 'Students', href: '/parent/students', matches: ['/parent/subjects'] },
  { label: 'Bookings', href: '/parent/bookings', matches: ['/requests', '/parent/book', '/book'] },
  { label: 'Payments', href: '/parent/payments' },
  { label: 'Tutors', href: '/parent/tutors', matches: ['/tutors', '/shortlist'] },
];

export function isActiveNavItem(item: TopNavItem, pathname: string): boolean {
  if (item.exact === true) return pathname === item.href;
  return [item.href, ...(item.matches ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
