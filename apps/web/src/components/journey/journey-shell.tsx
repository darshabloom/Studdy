import Link from 'next/link';
import type { ReactNode } from 'react';
import { CollapsedSection, CurrentSectionHeader } from './journey-accordion';
import { JourneySummary } from './journey-summary';
import type { JourneySection } from '@/lib/journey/section';

export interface JourneyShellProps {
  /** Already computed by the journey, in the order it asks its questions. */
  readonly sections: readonly JourneySection[];
  readonly title: string;
  readonly description?: string | undefined;
  /** Panel heading and its caption. */
  readonly summaryTitle: string;
  readonly summaryCaption: string;
  /** Where Back goes, or null when this is the first question. */
  readonly backHref?: string | null;
  readonly children: ReactNode;
}

/**
 * The frame a multi-step journey sits in, and the reason the answers stay on
 * screen.
 *
 * ONE DOM, TWO SHAPES. On a wide screen the current question sits beside a
 * persistent panel holding everything decided so far. On a narrow one the same
 * answers become an accordion: completed sections collapsed above, the open
 * question beneath its own section header, the rest waiting below. Only the
 * static summary markup differs between the two, and each copy is hidden by
 * `display: none` at the other width, so nothing is read twice. THE QUESTION IS
 * RENDERED ONCE; duplicating it would double-mount its form.
 *
 * Shared by the single-tutor booking journey and the optional multi-tutor one
 * ON PURPOSE. They ask different questions in a different order and build their
 * own hrefs, but a family moving between them should not feel they have changed
 * product — and two copies of this layout is how that starts.
 */
export function JourneyShell({
  sections,
  title,
  description,
  summaryTitle,
  summaryCaption,
  backHref = null,
  children,
}: JourneyShellProps): ReactNode {
  const currentIndex = sections.findIndex((section) => section.state === 'current');

  /**
   * A review screen renders the summary itself, as its whole content.
   *
   * Showing the panel there too would put the same answers on screen twice,
   * side by side — which reads less like a reminder than like two things that
   * might disagree, at exactly the moment a family is checking they agree.
   */
  const ownsItsSummary = currentIndex === -1;
  const before = ownsItsSummary ? [] : sections.slice(0, currentIndex);
  const current = ownsItsSummary ? null : (sections[currentIndex] ?? null);
  const after = ownsItsSummary ? [] : sections.slice(currentIndex + 1);

  return (
    // Wide enough that the summary panel does not squeeze the question. A times
    // step draws a seven-column week with a real minimum width; at a narrower
    // container the last day falls off the edge behind a scrollbar.
    <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold text-brand-purple-deep md:text-3xl">
          {title}
        </h1>
        {description !== undefined ? (
          <p className="mt-2 max-w-2xl text-text-secondary">{description}</p>
        ) : null}
      </header>

      <div
        className={
          ownsItsSummary ? '' : 'md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-8'
        }
      >
        {/* Mobile: the sections already answered, collapsed above the question. */}
        {before.length > 0 ? (
          <div className="mb-3 flex flex-col gap-2 md:hidden">
            {before.map((section) => (
              <CollapsedSection key={section.key} section={section} />
            ))}
          </div>
        ) : null}

        {/*
         * The open section. On mobile it is a card carrying its own header, so
         * the question reads as one expanded accordion panel rather than as a
         * form that happens to follow a receipt. Above `md` the card chrome is
         * dropped and this is simply the first grid column.
         */}
        <div className="min-w-0 rounded-[var(--radius-medium)] border border-brand-purple/40 bg-surface-card p-3 shadow-sm md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          {current !== null ? (
            <div className="md:hidden">
              <CurrentSectionHeader section={current} />
            </div>
          ) : null}
          <main className="min-w-0">{children}</main>
        </div>

        {/* Mobile: the questions still to come, waiting below. */}
        {after.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2 md:hidden">
            {after.map((section) => (
              <CollapsedSection key={section.key} section={section} />
            ))}
          </div>
        ) : null}

        {/* Desktop: the whole request, always in view. */}
        {ownsItsSummary ? null : (
          <div className="hidden md:sticky md:top-6 md:block">
            <JourneySummary sections={sections} title={summaryTitle} caption={summaryCaption} />
          </div>
        )}
      </div>

      {backHref !== null ? (
        <div className="mt-6 border-t border-surface-border pt-4">
          <Link href={backHref} className="text-sm text-brand-purple hover:underline">
            ← Back
          </Link>
        </div>
      ) : null}
    </section>
  );
}
