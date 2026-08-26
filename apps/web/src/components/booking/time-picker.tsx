import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CalendarBlock, CalendarWindow } from '@studdy/design-system';
import { JourneyTimePicker } from '@/components/journey/time-picker';

export interface TimePickerProps {
  readonly tutorName: string;
  /** Derived positive slots, UNMERGED: each is one bookable start. */
  readonly blocks: readonly CalendarBlock[];
  readonly window: CalendarWindow;
  readonly dayLabels: readonly string[];
  readonly rangeLabel: string;
  readonly summary: readonly string[];
  readonly todayIndex: number;
  readonly previousHref: string | null;
  readonly nextHref: string | null;
  readonly horizonDays: number;
  /** e.g. "Lessons are 90 minutes long." Stated once, not redrawn per block. */
  readonly lessonLengthLabel: string;
  /** Already-chosen starts as ISO strings, from the URL. */
  readonly chosen: readonly string[];
  /**
   * Where Continue goes, WITHOUT the chosen times.
   *
   * A string rather than a function: props from a server component have to be
   * serialisable, and a callback would fail at runtime rather than at build.
   */
  readonly reviewHref: string;
  /** Labels for the chosen times, keyed by ISO string. */
  readonly labelFor: Readonly<Record<string, string>>;
}

/**
 * The single-tutor journey's times step: this tutor's name, the shared picker.
 *
 * The interaction itself lives in `JourneyTimePicker`, which the optional
 * multi-tutor journey now uses too — the same relationship `BookingShell` has
 * with `JourneyShell`, and for the same reason. What belongs here is the
 * wording that only one already-chosen tutor makes sense of.
 */
export function TimePicker({ tutorName, horizonDays, ...rest }: TimePickerProps): ReactNode {
  return (
    <JourneyTimePicker
      {...rest}
      ariaSubject={tutorName}
      emptyWeekSentence={`${tutorName} has nothing bookable`}
      alternativesSentence={`These are alternatives — ${tutorName} can accept any one of them.`}
      footer={
        <>
          {tutorName} publishes availability {horizonDays} days ahead.{' '}
          <Link href="/tutors" className="text-brand-purple hover:underline">
            Browse other tutors
          </Link>
        </>
      }
    />
  );
}
