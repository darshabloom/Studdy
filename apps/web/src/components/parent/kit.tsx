import Link from 'next/link';
import { StatusBadge } from '@studdy/design-system';
import type { FamilyBookingView } from '@studdy/database';
import type { ReactNode } from 'react';
import { bookingStatus, formatLabel } from '@/lib/parent/overview';

/**
 * The few shapes every Parent screen is made of: a page heading, a row of
 * view tabs, a titled section and a lesson row. Kept plain on purpose — white
 * surfaces, hairline borders, one accent — so the content is what reads.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-brand-purple-deep md:text-3xl">
          {title}
        </h1>
        {description !== undefined ? (
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action !== undefined ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export interface ViewTab {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly count?: number;
}

/**
 * Views of one page, as links. The open view is a fact about the URL, so the
 * back button, a reload and a shared link all land on the same one.
 */
export function ViewTabs({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: readonly ViewTab[];
  current: string;
}): ReactNode {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-surface-border">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? '-mb-px shrink-0 border-b-2 border-brand-purple px-3 py-2 text-sm font-semibold text-brand-purple-deep'
                : '-mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary'
            }
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 ? (
              <span className="ml-2 rounded-[var(--radius-pill)] bg-surface-card-secondary px-2 py-px text-xs tabular-nums text-text-secondary">
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A bordered white surface. Lists sit inside one as divided rows. */
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div
      className={`rounded-[var(--radius-medium)] border border-surface-border bg-surface-card ${className}`}
    >
      {children}
    </div>
  );
}

/** A quiet "nothing here" line, for a section rather than a whole page. */
export function Quiet({ children }: { children: ReactNode }): ReactNode {
  return <Panel className="px-4 py-5 text-sm text-text-secondary">{children}</Panel>;
}

export function TextLink({ href, children }: { href: string; children: ReactNode }): ReactNode {
  return (
    <Link href={href} className="text-sm font-medium text-brand-purple hover:underline">
      {children}
    </Link>
  );
}

export function lessonDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(at);
}

export function lessonTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(at);
}

export function lessonTimeRange(booking: FamilyBookingView): string {
  return `${lessonTime(booking.scheduledStartAt, booking.timeZone)} to ${lessonTime(
    booking.scheduledEndAt,
    booking.timeZone,
  )}`;
}

export function shortDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(at);
}

/** One of the family's own lessons, as a row. */
export function BookingRow({
  booking,
  now,
  showStudent = true,
}: {
  booking: FamilyBookingView;
  now: Date;
  showStudent?: boolean;
}): ReactNode {
  const status = bookingStatus(booking, now);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-text-primary">
          <Link href={`/parent/bookings/${booking.reference}`} className="hover:underline">
            {lessonDay(booking.scheduledStartAt, booking.timeZone)}, {lessonTimeRange(booking)}
          </Link>
        </p>
        <p className="mt-px text-sm text-text-secondary">
          {booking.subjectDisplayName} with {booking.tutorFirstName}
          {showStudent ? ` for ${booking.studentPreferredName}` : ''} ·{' '}
          {formatLabel(booking.lessonFormatCode)}
        </p>
      </div>
      <StatusBadge family={status.family}>{status.label}</StatusBadge>
    </li>
  );
}
