import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CalendarBlock, CalendarWindow } from '@studdy/design-system';
import { JourneyTimePicker } from '@/components/journey/time-picker';

export interface AskTimePickerProps {
  readonly blocks: readonly CalendarBlock[];
  readonly window: CalendarWindow;
  readonly dayLabels: readonly string[];
  readonly rangeLabel: string;
  readonly summary: readonly string[];
  readonly todayIndex: number;
  readonly previousHref: string | null;
  readonly nextHref: string | null;
  readonly horizonDays: number;
  readonly lessonLengthLabel: string;
  readonly chosen: readonly string[];
  readonly reviewHref: string;
  readonly labelFor: Readonly<Record<string, string>>;
  /** Which of the family's own included tutors can do a chosen time. */
  readonly detailFor: Readonly<Record<string, string>>;
  /** How many tutors this request will actually reach. */
  readonly askingCount: number;
  /** Where to go to save another tutor onto this shortlist. */
  readonly addTutorHref: string;
}

/**
 * The multi-tutor journey's times step: the shared picker, said in the plural.
 *
 * ONE CALENDAR, SEVERAL TUTORS. The grid draws every start at least one
 * included tutor can offer, so a marker is always a time this request can
 * genuinely ask about — and it says only the time, exactly as the single-tutor
 * calendar does. A CHOSEN time then names who can do it: the family's OWN
 * included tutors, and never a word about the platform or about why anyone is
 * missing.
 */
export function AskTimePicker({
  askingCount,
  horizonDays,
  addTutorHref,
  ...rest
}: AskTimePickerProps): ReactNode {
  const plural = askingCount === 1 ? 'tutor' : 'tutors';

  return (
    <JourneyTimePicker
      {...rest}
      ariaSubject={`your ${String(askingCount)} ${plural}`}
      emptyWeekSentence={
        askingCount === 1
          ? 'The tutor this request would reach has nothing bookable'
          : `None of the ${String(askingCount)} tutors this request would reach has anything bookable`
      }
      /*
       * ONE of them, not all of them. Several chosen times are alternatives
       * AND several tutors are alternatives, and this is the sentence that has
       * to carry both without letting either read as more than one lesson.
       */
      alternativesSentence={`These are alternatives — one tutor can accept any one of them.`}
      /*
       * A PROMISE RATHER THAN A LEGEND. The grid itself says nothing about
       * tutors, so this tells the family where that answer arrives instead —
       * beneath the calendar, against the times they have actually chosen.
       * Said only where there is more than one tutor to tell apart.
       */
      gridNote={
        askingCount > 1
          ? "After you choose a time, we'll show which of your tutors can do it."
          : undefined
      }
      footer={
        <>
          Your {plural} publish availability {horizonDays} days ahead.{' '}
          <Link href={addTutorHref} className="text-brand-purple hover:underline">
            Add another tutor
          </Link>
        </>
      }
    />
  );
}
