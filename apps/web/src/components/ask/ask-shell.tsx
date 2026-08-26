import type { ReactNode } from 'react';
import { JourneyShell } from '@/components/journey/journey-shell';
import { askSections, previousAskHref, type AskRow } from '@/lib/ask/sections';
import type { AskParams, AskStep } from '@/lib/ask/draft';

export interface AskShellProps {
  readonly step: AskStep;
  readonly subjectSectionId: string;
  readonly params: AskParams;
  readonly rows: readonly AskRow[];
  readonly title: string;
  readonly description?: string | undefined;
  readonly children: ReactNode;
}

/**
 * The optional multi-tutor journey, in the same frame as `/book`.
 *
 * All of the layout, the persistent receipt and the mobile accordion come from
 * `JourneyShell`; what belongs here is this journey's own ordering and its own
 * hrefs. Back from the first question returns to the shortlist rather than
 * nowhere, because the shortlist is where this journey was entered from and
 * leaving it is a perfectly reasonable thing to want.
 */
export function AskShell({
  step,
  subjectSectionId,
  params,
  rows,
  title,
  description,
  children,
}: AskShellProps): ReactNode {
  return (
    <JourneyShell
      // Null on review: nothing is being asked there, so no section is open and
      // the persistent panel steps aside for the finished summary.
      sections={askSections(rows, step === 'review' ? null : step, subjectSectionId, params)}
      title={title}
      description={description}
      summaryTitle="Your request so far"
      summaryCaption="Nothing is sent until you review it."
      backHref={previousAskHref(subjectSectionId, step, params) ?? `/shortlist/${subjectSectionId}`}
    >
      {children}
    </JourneyShell>
  );
}
