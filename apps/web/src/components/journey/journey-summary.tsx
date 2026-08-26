import Link from 'next/link';
import type { ReactNode } from 'react';
import { sectionIsAnswered, type JourneySection } from '@/lib/journey/section';

export interface JourneySummaryProps {
  readonly sections: readonly JourneySection[];
  /** Panel heading, e.g. 'Your request so far'. Also its accessible name. */
  readonly title: string;
  readonly caption: string;
  /** Rendered flat, without the panel chrome — for a review screen. */
  readonly bare?: boolean;
}

/**
 * The request as it stands, built up answer by answer.
 *
 * WHY THIS EXISTS. A wizard that shows one question at a time and then takes
 * the answer away asks a family to hold six decisions in their head and trust
 * that the seventh screen knows them. Keeping the answers on screen turns the
 * journey into something being assembled rather than a series of forms, and it
 * means the review screen is the finished state of a thing they have watched
 * grow rather than a summary appearing from nowhere at the end.
 *
 * EVERY ANSWERED ROW IS A LINK BACK, including one whose question had a single
 * option and one that arrived prefilled. Both are real choices, and a family
 * wanting to reconsider "the only option" is exactly who needs the way back.
 *
 * There is no client state here at all. The sections come from the same
 * resolution every screen is guarded by, so what the summary claims and what
 * the server would accept are the same thing by construction.
 */
export function JourneySummary({
  sections,
  title,
  caption,
  bare = false,
}: JourneySummaryProps): ReactNode {
  const list = (
    <ol className="flex flex-col">
      {sections.map((section) => {
        const answered = sectionIsAnswered(section);
        const isCurrent = section.state === 'current';

        return (
          <li
            key={section.key}
            className="flex items-baseline justify-between gap-3 border-b border-surface-border py-2 last:border-b-0"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                aria-hidden
                className={
                  answered || isCurrent
                    ? 'text-sm font-semibold text-brand-purple'
                    : 'text-sm text-text-muted'
                }
              >
                {answered ? '✓' : isCurrent ? '▸' : '·'}
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-text-muted">{section.label}</span>
                {answered ? (
                  <span className="block text-sm font-medium text-text-primary">
                    {section.values.length > 0 ? (
                      <>
                        {section.values.map((entry) => (
                          <span key={entry} className="block tabular-nums">
                            {entry}
                          </span>
                        ))}
                        {section.note !== null ? (
                          <span className="mt-0.5 block text-xs font-normal text-text-muted">
                            {section.note}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      section.value
                    )}
                  </span>
                ) : (
                  <span className="block text-sm text-text-muted">
                    {isCurrent ? 'Choosing now' : 'Not yet'}
                  </span>
                )}
              </span>
            </span>

            {section.href !== null ? (
              <Link
                href={section.href}
                className="shrink-0 rounded-[var(--radius-gentle)] text-xs font-medium text-brand-purple underline underline-offset-2 hover:text-brand-purple-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple"
              >
                Change<span className="sr-only"> {section.label}</span>
              </Link>
            ) : null}
          </li>
        );
      })}
    </ol>
  );

  if (bare) return list;

  return (
    <aside
      aria-label={title}
      className="rounded-[var(--radius-medium)] border border-surface-border bg-surface-card p-4"
    >
      <h2 className="mb-1 text-sm font-semibold text-text-primary">{title}</h2>
      <p className="mb-2 text-xs text-text-muted">{caption}</p>
      {list}
    </aside>
  );
}
