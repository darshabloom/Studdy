import Link from 'next/link';
import { RestrictedState, StatusBadge } from '@studdy/design-system';
import type { TutorBookingView } from '@studdy/database';
import type { ReactNode } from 'react';
import { ViewTabs, lessonDay, lessonTime } from '@/components/parent/kit';
import { formatLabel, lessonStatus } from '@/lib/tutor/overview';

/** Shown by every tutor page when there is no tutor profile to show it for. */
export function TutorUnavailable(): ReactNode {
  return (
    <RestrictedState
      title="Your tutor profile is not active yet"
      description="Your workspace opens once your tutor application is approved."
    />
  );
}

/**
 * The Calendar's four views. Requests and Availability are their own routes —
 * the same screens that already handled them — so this strip is what makes
 * them read as parts of one Calendar rather than as separate destinations.
 */
export function CalendarTabs({
  current,
  openRequests,
}: {
  current: 'calendar' | 'requests' | 'availability' | 'recurring';
  openRequests?: number;
}): ReactNode {
  return (
    <ViewTabs
      label="Calendar views"
      current={current}
      tabs={[
        { key: 'calendar', label: 'Calendar', href: '/tutor/calendar' },
        {
          key: 'requests',
          label: 'Requests',
          href: '/tutor/requests',
          ...(openRequests === undefined ? {} : { count: openRequests }),
        },
        { key: 'availability', label: 'Availability', href: '/tutor/availability' },
        { key: 'recurring', label: 'Recurring', href: '/tutor/calendar?view=recurring' },
      ]}
    />
  );
}

export function timeRange(booking: TutorBookingView): string {
  return `${lessonTime(booking.scheduledStartAt, booking.timeZone)} to ${lessonTime(
    booking.scheduledEndAt,
    booking.timeZone,
  )}`;
}

/** One of the tutor's own lessons, as a row. */
export function LessonRow({
  booking,
  now,
  showStudent = true,
}: {
  booking: TutorBookingView;
  now: Date;
  showStudent?: boolean;
}): ReactNode {
  const status = lessonStatus(booking, now);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-text-primary">
          <Link
            prefetch={false}
            href={`/tutor/lessons/${booking.reference}`}
            className="hover:underline"
          >
            {lessonDay(booking.scheduledStartAt, booking.timeZone)}, {timeRange(booking)}
          </Link>
        </p>
        <p className="mt-px text-sm text-text-secondary">
          {booking.subjectDisplayName}
          {showStudent ? ` with ${booking.studentPreferredName}` : ''} ·{' '}
          {formatLabel(booking.lessonFormatCode)}
        </p>
      </div>
      <StatusBadge family={status.family}>{status.label}</StatusBadge>
    </li>
  );
}
