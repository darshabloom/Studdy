import 'server-only';
import { bookingIntervalLabel } from '@/lib/booking/time-labels';
import type { AskRow } from './sections';
import type { ResolvedAsk } from './resolve';

/**
 * The multi-tutor request as it stands.
 *
 * WHO IS BEING ASKED IS ONE OF THE ANSWERS. It sits in the receipt beside the
 * length and the times, and not only on the review screen, because it is the
 * one part of this request that changes as a CONSEQUENCE of the others — a
 * family choosing ninety minutes should see the effect on their shortlist at
 * the moment they choose it, not two screens later.
 *
 * TIMES ARE INTERVALS, AND THEY ARE ALTERNATIVES, exactly as in `/book`. Every
 * included tutor shares one duration, so a start means one interval for all of
 * them — which is the whole reason the length is asked first.
 */
export function askRows(ask: ResolvedAsk): readonly AskRow[] {
  const { params, eligibility, times } = ask;
  const duration = params.duration;

  const included = eligibility?.included ?? [];
  const excluded = eligibility?.excluded ?? [];

  return [
    {
      step: 'length',
      label: 'Lesson length',
      value: duration === null ? null : `${String(duration)} minutes`,
    },
    {
      step: 'format',
      label: 'Online or in person',
      value: params.format === null ? null : params.format === 'online' ? 'Online' : 'In person',
    },
    {
      step: 'times',
      label: times.length === 1 ? 'Preferred time' : 'Preferred times',
      value: null,
      values:
        times.length === 0 || duration === null
          ? undefined
          : times.map((at) => bookingIntervalLabel(at, duration)),
      note: times.length > 1 ? 'Any one of these' : undefined,
    },
    {
      step: 'review',
      label: 'Tutors being asked',
      value:
        eligibility === null
          ? null
          : included.length === 0
            ? 'Nobody yet'
            : included.map((entry) => entry.firstName).join(', '),
      // Said in the receipt rather than only on review: a family watching their
      // shortlist shrink as they choose should be told so as it happens.
      note:
        excluded.length === 0
          ? undefined
          : `${String(excluded.length)} shortlisted ${excluded.length === 1 ? 'tutor is' : 'tutors are'} not included`,
    },
  ];
}
