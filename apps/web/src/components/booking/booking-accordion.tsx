import Link from 'next/link';
import type { ReactNode } from 'react';
import type { BookingSection } from '@/lib/booking/sections';

/**
 * The narrow-screen shape of the booking journey: one accordion, one section
 * open.
 *
 * There is no client state and no toggle handler. Each route already IS one
 * section expanded, so "open that section" is a link and "close this one" is
 * what happens when the next page renders. That keeps the whole journey
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

function SectionLabel({ section }: { section: BookingSection }): ReactNode {
  return (
    <span className="min-w-0 text-left">
      <span className="block text-xs text-text-muted">{section.label}</span>
      <span
        className={
          section.value === null
            ? 'block text-sm text-text-muted'
            : 'block truncate text-sm font-medium text-text-primary'
        }
      >
        {section.value ?? 'Not yet'}
        {section.value !== null && section.settled ? (
          <span className="ml-1 font-normal text-text-muted">(only option)</span>
        ) : null}
      </span>
    </span>
  );
}

const SHELL =
  'flex w-full items-center justify-between gap-3 rounded-[var(--radius-medium)] border px-3 py-2.5 text-left';

/**
 * One collapsed section: its question, its answer, and whether it reopens.
 *
 * A settled answer gets no chevron and no link — there is nothing behind it to
 * disclose, and offering the affordance would promise a choice that does not
 * exist. A question not yet reached gets neither either, for the same reason in
 * the other direction.
 */
export function CollapsedSection({ section }: { section: BookingSection }): ReactNode {
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
export function CurrentSectionHeader({ section }: { section: BookingSection }): ReactNode {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-surface-border pb-2.5">
      <h2 className="text-sm font-semibold text-brand-purple-deep">{section.label}</h2>
      <Chevron open />
    </div>
  );
}
