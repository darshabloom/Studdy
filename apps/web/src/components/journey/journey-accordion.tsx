import Link from 'next/link';
import type { ReactNode } from 'react';
import { sectionIsAnswered, type JourneySection } from '@/lib/journey/section';

/**
 * The narrow-screen shape of a multi-step journey: one accordion, one section
 * open.
 *
 * There is no client state and no toggle handler. Each route already IS one
 * section expanded, so "open that section" is a link and "close this one" is
 * what happens when the next page renders. That keeps the journey
 * server-authoritative, and keeps reload, deep links and the back button
 * behaving exactly as they do everywhere else in the product.
 *
 * Rendered only below `md`. The wide layout keeps its persistent receipt beside
 * the question instead, and hides these — so the same values are never in the
 * accessibility tree twice.
 */

function Chevron({ open }: { open: boolean }): ReactNode {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={[
        'size-4 shrink-0 text-text-muted transition-transform',
        open ? 'rotate-180' : '',
      ].join(' ')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

function SectionLabel({ section }: { section: JourneySection }): ReactNode {
  return (
    <span className="min-w-0 text-left">
      <span className="block text-xs text-text-muted">{section.label}</span>
      {sectionIsAnswered(section) ? (
        <span className="block text-sm font-medium text-text-primary">
          {section.values.length > 0 ? (
            <>
              {/*
               * One line each, never joined. Two intervals on one line read as
               * a lesson running from the first to the second, or as two
               * lessons being asked for — and this is neither.
               */}
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
            <span className="block truncate">{section.value}</span>
          )}
        </span>
      ) : (
        <span className="block text-sm text-text-muted">Not yet</span>
      )}
    </span>
  );
}

const SHELL =
  'flex w-full items-center justify-between gap-3 rounded-[var(--radius-medium)] border px-3 py-2.5 text-left';

/**
 * One collapsed section: its question, its answer, and whether it reopens.
 *
 * Every answered section behind the current one reopens. A question not yet
 * reached gets no chevron and no link, because there is nothing there yet.
 */
export function CollapsedSection({ section }: { section: JourneySection }): ReactNode {
  if (section.href !== null) {
    return (
      <Link
        href={section.href}
        aria-expanded={false}
        className={[
          SHELL,
          'border-surface-border bg-surface-card transition-colors hover:border-brand-purple/50 hover:bg-brand-lavender/30',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple',
        ].join(' ')}
      >
        <SectionLabel section={section} />
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs font-medium text-brand-purple">Change</span>
          <Chevron open={false} />
        </span>
      </Link>
    );
  }

  return (
    <div
      className={[
        SHELL,
        section.state === 'upcoming'
          ? 'border-dashed border-surface-border bg-transparent'
          : 'border-surface-border bg-surface-card',
      ].join(' ')}
    >
      <SectionLabel section={section} />
    </div>
  );
}

/**
 * The open section's header, sitting directly above its question.
 *
 * Not a link and not a button: this section is already open, so there is
 * nothing for a control here to do. It is a heading, which also gives the
 * question below it a name in the document outline.
 */
export function CurrentSectionHeader({ section }: { section: JourneySection }): ReactNode {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-surface-border pb-2.5">
      <h2 className="text-sm font-semibold text-brand-purple-deep">{section.label}</h2>
      <Chevron open />
    </div>
  );
}
