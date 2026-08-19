import Link from 'next/link';
import {
  bookableSlotsForTutors,
  listAvailabilityExceptions,
  listAvailabilityRules,
  listTutorReservations,
  tutorProfileForUser,
} from '@studdy/database';
import { Alert, Button, RestrictedState, WeekCalendar } from '@studdy/design-system';
import { zonedClockTime } from '@studdy/domain/availability';
import { resolveIdentity } from '@/lib/identity/resolve';
import { PLATFORM_TIME_ZONE } from '@/lib/time';
import {
  familyPreviewBlocks,
  teachingWindow,
  tutorWeekBlocks,
} from '@/lib/availability/calendar-projection';
import { clockToMinutes, mondayOf, shiftDate, weekDays } from '@/lib/availability/calendar-time';
import { AvailabilityCalendar } from './availability-calendar';

export const metadata = { title: 'Your availability' };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * TUTOR AVAILABILITY MANAGEMENT, as a calendar.
 *
 * This is the tutor's own workspace, so the editing calendar shows everything:
 * recurring hours, one-off changes, the private notes on blocked time, and the
 * holds and lessons that have taken time out of the week.
 *
 * "PREVIEW AS FAMILY" IS A SEPARATE SERVER RENDER, NOT A CLIENT TOGGLE, and
 * that distinction is the whole point. Next.js serialises a client component's
 * props into the HTML, so a preview switched in the browser would still carry
 * every private note and blocked period in the page payload — visually hidden,
 * genuinely present. Driving it from the URL instead means that in preview the
 * server never loads the private rows at all: no exceptions, no reservations,
 * nothing to hide. The only availability on the page is the derived,
 * positive-only projection a family actually receives.
 */
export default async function TutorAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; preview?: string }>;
}) {
  const identity = await resolveIdentity();
  if (identity === null || identity.studdyUserId === null) {
    return <RestrictedState title="Sign in to manage your availability" />;
  }

  const profile = await tutorProfileForUser(identity.studdyUserId);
  if (profile === null) {
    return (
      <RestrictedState
        title="Your tutor profile is not active yet"
        description="Availability opens once your tutor application is approved."
      />
    );
  }

  const params = await searchParams;
  const now = new Date();
  const currentWeek = mondayOf(now, PLATFORM_TIME_ZONE);
  const weekStart =
    params.week !== undefined && DATE_PATTERN.test(params.week) ? params.week : currentWeek;
  const isPreview = params.preview === '1';

  const days = weekDays(weekStart, PLATFORM_TIME_ZONE);
  const first = days[0];
  const last = days[6];
  if (first === undefined || last === undefined) {
    return <RestrictedState title="That week could not be shown" />;
  }

  const [rules, slotsByTutor] = await Promise.all([
    listAvailabilityRules(profile.id),
    bookableSlotsForTutors({
      tutorProfileIds: [profile.id],
      from: first.startAt,
      to: last.endAt,
      // An hour is the common lesson length and keeps the preview legible. The
      // real journey derives slots against the tutor's published service
      // duration; this previews the shape of the week, it is not an offer.
      durationMinutes: 60,
      now,
    }),
  ]);

  const slots = slotsByTutor.get(profile.id) ?? [];
  const familyBlocks = familyPreviewBlocks(slots, days, PLATFORM_TIME_ZONE);
  const weekLabel = `${first.label} – ${last.label}`;

  const nav = (
    <WeekNav
      weekStart={weekStart}
      weekLabel={weekLabel}
      currentWeek={currentWeek}
      isCurrentWeek={weekStart === currentWeek}
      isPreview={isPreview}
    />
  );

  // The current-time line, only when today is actually in the week on screen.
  const todayIndex = days.findIndex((day) => day.startAt <= now && now < day.endAt);
  const nowMarker =
    todayIndex >= 0
      ? {
          dayIndex: todayIndex,
          minutes: clockToMinutes(zonedClockTime(now, PLATFORM_TIME_ZONE)),
        }
      : undefined;

  const weeklyMinutes = rules.reduce((total, rule) => {
    const start =
      Number(rule.localStartTime.slice(0, 2)) * 60 + Number(rule.localStartTime.slice(3, 5));
    const end = Number(rule.localEndTime.slice(0, 2)) * 60 + Number(rule.localEndTime.slice(3, 5));
    return total + (end - start);
  }, 0);

  const title = (
    <div>
      <h1 className="font-display text-2xl font-semibold text-brand-purple-deep">
        Your availability
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        Families can only ask you for times you are free.
      </p>
    </div>
  );

  const noAvailabilityAlert =
    rules.length === 0 ? (
      <div className="mt-4">
        <Alert tone="warning" title="Families cannot request you yet">
          You have no availability set, so you will not appear as bookable and no family can send
          you a lesson request. Adding your regular hours is all it takes.
        </Alert>
      </div>
    ) : null;

  // PREVIEW: the private rows are never queried, so there is nothing on this
  // page to leak — not in the markup, and not in the serialised payload either.
  if (isPreview) {
    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          {title}
          <dl className="flex items-center gap-6 text-right">
            <Stat label="Bookable this week" value={String(slots.length)} />
          </dl>
        </div>
        {noAvailabilityAlert}
        <div className="mt-6">{nav}</div>
        <p className="mt-4 text-sm text-text-secondary">
          Exactly what a family sees: your hours, minus anything blocked, minus time already held or
          booked. A family is never shown a gap, and never told what caused one.
        </p>
        <div className="mt-4">
          <WeekCalendar
            blocks={familyBlocks}
            window={teachingWindow(familyBlocks)}
            mode="read"
            familySafe
            dayLabels={days.map((day) => day.label)}
            ariaLabel={`Bookable times a family can see, week of ${weekLabel}`}
            {...(nowMarker === undefined ? {} : { now: nowMarker })}
          />
        </div>
        {familyBlocks.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            Nothing bookable this week. If that is a surprise, check whether a one-off change is
            covering your regular hours.
          </p>
        ) : null}
      </>
    );
  }

  const [exceptions, reservations] = await Promise.all([
    // From the start of the displayed week rather than from now, so navigating
    // back still shows the one-off changes that were in that week.
    listAvailabilityExceptions(profile.id, first.startAt),
    listTutorReservations(profile.id, first.startAt, last.endAt),
  ]);

  const { blocks, segments } = tutorWeekBlocks({
    rules,
    exceptions,
    reservations,
    days,
    timeZone: PLATFORM_TIME_ZONE,
  });

  // The standard teaching window, widened by anything already on the calendar,
  // and computed across both projections so switching to the preview does not
  // make the grid jump to a different height and re-read as a different week.
  const window = teachingWindow([...blocks, ...familyBlocks]);

  const inThisWeek = exceptions.filter(
    (exception) => exception.startsAt < last.endAt && exception.endsAt > first.startAt,
  );
  const notedBlocks = inThisWeek.filter((exception) => exception.privateNote !== null);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {title}
        {/*
         * The numbers sit beside the title rather than in a row of large cards.
         * They are context for the calendar, not the subject of the screen, and
         * three full-width cards pushed the week itself below the fold.
         */}
        <dl className="flex items-center gap-6 text-right">
          <Stat label="Regular hours a week" value={(weeklyMinutes / 60).toFixed(1)} />
          <Stat label="Bookable this week" value={String(slots.length)} />
          <Stat label="One-off changes" value={String(inThisWeek.length)} />
        </dl>
      </div>
      {noAvailabilityAlert}

      <div className="mt-6">{nav}</div>

      <AvailabilityCalendar
        weekLabel={weekLabel}
        dayLabels={days.map((day) => day.label)}
        dayDates={days.map((day) => day.date)}
        blocks={blocks}
        segments={segments}
        window={window}
        timeZone={PLATFORM_TIME_ZONE}
        hasAnyRules={rules.length > 0}
        isPastWeek={last.endAt <= now}
        {...(nowMarker === undefined ? {} : { now: nowMarker })}
        notedBlocks={notedBlocks.map((exception) => ({
          id: exception.id,
          when: `${formatDateTime(exception.startsAt)} – ${formatDateTime(exception.endsAt)}`,
          note: exception.privateNote ?? '',
        }))}
      />
    </>
  );
}

/**
 * Week navigation and the preview switch, as links.
 *
 * Links rather than buttons because both are genuinely navigations: the week
 * and the preview live in the URL, so a reload keeps the tutor where they were,
 * and the preview can only be entered by asking the server for it.
 */
function WeekNav({
  weekStart,
  weekLabel,
  currentWeek,
  isCurrentWeek,
  isPreview,
}: {
  weekStart: string;
  weekLabel: string;
  currentWeek: string;
  isCurrentWeek: boolean;
  isPreview: boolean;
}) {
  const suffix = isPreview ? '&preview=1' : '';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex items-center gap-3">
        {/* Paired arrows read as one control, the way every calendar does it. */}
        <div className="inline-flex overflow-hidden rounded-[var(--radius-medium)] border border-surface-border">
          <Link
            href={`/tutor/availability?week=${shiftDate(weekStart, -7)}${suffix}`}
            aria-label="Previous week"
            className="px-2.5 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-card-secondary hover:text-text-primary"
          >
            ←
          </Link>
          <Link
            href={`/tutor/availability?week=${shiftDate(weekStart, 7)}${suffix}`}
            aria-label="Next week"
            className="border-l border-surface-border px-2.5 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-card-secondary hover:text-text-primary"
          >
            →
          </Link>
        </div>

        <h2 className="font-display text-lg font-semibold text-text-primary">{weekLabel}</h2>

        {isCurrentWeek ? (
          <span className="rounded-full bg-brand-lavender px-2 py-0.5 text-xs font-medium text-brand-purple-deep">
            This week
          </span>
        ) : (
          <Button asChild variant="quiet" size="sm">
            <Link href={`/tutor/availability?week=${currentWeek}${suffix}`}>Back to this week</Link>
          </Button>
        )}
      </div>

      <Button asChild variant={isPreview ? 'primary' : 'secondary'} size="sm">
        <Link
          href={
            isPreview
              ? `/tutor/availability?week=${weekStart}`
              : `/tutor/availability?week=${weekStart}&preview=1`
          }
        >
          {isPreview ? 'Back to editing' : 'Preview as family'}
        </Link>
      </Button>
    </div>
  );
}

/** A number and its label, sized as context rather than as a headline. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="font-display text-lg font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PLATFORM_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}
