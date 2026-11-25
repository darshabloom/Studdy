import Link from 'next/link';
import {
  bookableSlotsForTutors,
  listConfirmedBookingsForTutorWeek,
  listTutorReservations,
  tutorProfileForUser,
} from '@studdy/database';
import { RestrictedState, WeekCalendar, type CalendarBlock } from '@studdy/design-system';
import { resolveIdentity } from '@/lib/identity/resolve';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import { bookableSlotBlocks, teachingWindow } from '@/lib/availability/calendar-projection';
import { minutesWithinDay, mondayOf, shiftDate, weekDays } from '@/lib/availability/calendar-time';

export const metadata = { title: 'Tutor calendar' };

export default async function TutorCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const identity = await resolveIdentity();
  if (
    identity === null ||
    identity.studdyUserId === null ||
    !identity.databaseAvailable ||
    !identity.workspaces.includes('tutor')
  ) {
    return <RestrictedState title="Sign in to see your tutor calendar" />;
  }
  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) {
    return <RestrictedState title="Your tutor profile is not active yet" />;
  }

  const now = new Date();
  const zone = PLATFORM_TIME_ZONE;
  const current = mondayOf(now, zone);
  const requested = (await searchParams).week;
  const parsed =
    typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? new Date(`${requested}T12:00:00Z`)
      : null;
  const week =
    parsed !== null &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === requested
      ? mondayOf(parsed, zone)
      : current;
  const days = weekDays(week, zone);
  const from = days[0]!.startAt;
  const to = days[6]!.endAt;
  const [lessons, reservations, slotsByTutor] = await Promise.all([
    listConfirmedBookingsForTutorWeek(profile.id, from, to),
    listTutorReservations(profile.id, from, to),
    bookableSlotsForTutors({
      tutorProfileIds: [profile.id],
      from,
      to,
      durationMinutes: 60,
      now,
    }),
  ]);
  const slots = slotsByTutor.get(profile.id) ?? [];
  const holds = reservations.filter(
    (row) =>
      row.reservationTypeCode === 'request_hold' &&
      (row.expiresAt === null || row.expiresAt > now),
  );
  const blocks: CalendarBlock[] = [...bookableSlotBlocks(slots, days, zone)];
  for (const [dayIndex, day] of days.entries()) {
    for (const lesson of lessons) {
      const span = minutesWithinDay(
        { startAt: lesson.scheduledStartAt, endAt: lesson.scheduledEndAt },
        day,
        zone,
      );
      if (span === null) continue;
      blocks.push({
        id: `lesson:${lesson.reference}:${day.date}`,
        dayIndex,
        ...span,
        role: 'lesson',
        label: `${lesson.subjectDisplayName} with ${lesson.studentPreferredName}`,
      });
    }
    for (const hold of holds) {
      const span = minutesWithinDay(hold, day, zone);
      if (span === null) continue;
      blocks.push({
        id: `hold:${hold.id}:${day.date}`,
        dayIndex,
        ...span,
        role: 'hold',
        label: 'Request hold',
      });
    }
  }
  const label = `${days[0]!.label} – ${days[6]!.label}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-text-secondary">Your weekly schedule · {zone}</p>
        </div>
        <Link href="/tutor/availability" className="font-semibold underline">
          Manage availability
        </Link>
      </div>
      <nav aria-label="Calendar week" className="flex flex-wrap items-center gap-4 text-sm">
        <Link href={`/tutor/calendar?week=${shiftDate(week, -7)}`}>← Previous week</Link>
        <h2 className="font-semibold">{label}</h2>
        <Link href={`/tutor/calendar?week=${shiftDate(week, 7)}`}>Next week →</Link>
        <Link href="/tutor/calendar">This week</Link>
      </nav>
      <p className="text-sm text-text-secondary">
        Confirmed lessons, available one-hour openings and temporary request holds are separate.
      </p>
      <WeekCalendar
        blocks={blocks}
        window={teachingWindow(blocks)}
        mode="read"
        dayLabels={days.map((day) => day.label)}
        ariaLabel={`Tutor schedule, ${label}`}
      />
      {lessons.length === 0 ? (
        <p className="text-sm text-text-secondary">No confirmed lessons this week.</p>
      ) : null}
      <Link href="/tutor/requests" className="text-sm font-semibold underline">
        View booking requests
      </Link>
    </div>
  );
}
