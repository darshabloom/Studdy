import { groupSlotsByDay, type Interval } from '@studdy/domain/availability';
import type { ReactNode } from 'react';

export interface TutorSlotsProps {
  slots: readonly Interval[];
  timeZone: string;
  /** Days to render. The rest still exist; this only limits the display. */
  maxDays?: number;
  /** Cap per day so one very open tutor does not dominate a card. */
  maxSlotsPerDay?: number;
}

/**
 * Bookable times for one tutor.
 *
 * Everything rendered here comes from derived positive slots. There is
 * deliberately no way to express *why* a time is missing — no "booked", no
 * "unavailable", no greyed-out cells implying something was there. A gap is
 * simply absent, which is what makes it indistinguishable between a full
 * calendar, a private block, a holiday and ordinary non-working time.
 */
export function TutorSlots({
  slots,
  timeZone,
  maxDays = 3,
  maxSlotsPerDay = 4,
}: TutorSlotsProps): ReactNode {
  const days = groupSlotsByDay(slots, timeZone, maxDays);

  if (days.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No bookable times in the next two weeks. Try another tutor, or check back later.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {days.map((day) => (
        <div key={day.date} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="w-20 shrink-0 text-xs font-medium text-text-muted">{day.label}</span>
          <span className="flex flex-wrap gap-1">
            {day.slots.slice(0, maxSlotsPerDay).map((slot) => (
              <span
                key={slot.startAt.toISOString()}
                className="rounded-md bg-surface-muted px-2 py-0.5 text-xs tabular-nums text-text-secondary"
              >
                {slot.label}
              </span>
            ))}
            {day.slots.length > maxSlotsPerDay ? (
              <span className="px-1 py-0.5 text-xs text-text-muted">
                +{day.slots.length - maxSlotsPerDay} more
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
