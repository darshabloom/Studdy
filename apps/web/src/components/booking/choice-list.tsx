import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState } from '@studdy/design-system';

export interface Choice {
  readonly key: string;
  readonly href: string;
  readonly title: string;
  readonly detail?: string | undefined;
  /** Right-aligned, e.g. a price. */
  readonly meta?: string | undefined;
  readonly selected?: boolean | undefined;
}

export interface ChoiceListProps {
  readonly ariaLabel: string;
  readonly choices: readonly Choice[];
  readonly empty: ReactNode;
}

/**
 * One answer per row, and the row IS the link.
 *
 * Links rather than a form with a Next button: each step has exactly one
 * decision, so making the choice and moving on are the same act. It also means
 * every step works without JavaScript, keeps the back button honest, and leaves
 * a shareable URL at every point — which is what lets a tutor card drop a
 * family into the middle of the journey.
 */
export function ChoiceList({ ariaLabel, choices, empty }: ChoiceListProps): ReactNode {
  if (choices.length === 0) return <>{empty}</>;

  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-2">
      {choices.map((choice) => (
        <li key={choice.key}>
          <Link
            href={choice.href}
            aria-current={choice.selected === true ? 'true' : undefined}
            className={[
              'flex items-center justify-between gap-4 rounded-[var(--radius-medium)] border px-4 py-3 transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple',
              choice.selected === true
                ? 'border-brand-purple bg-brand-lavender/60'
                : 'border-surface-border bg-surface-card hover:border-brand-purple/50 hover:bg-brand-lavender/30',
            ].join(' ')}
          >
            <span className="min-w-0">
              <span className="block font-medium text-text-primary">{choice.title}</span>
              {choice.detail !== undefined ? (
                <span className="mt-0.5 block text-sm text-text-secondary">{choice.detail}</span>
              ) : null}
            </span>
            {choice.meta !== undefined ? (
              <span className="shrink-0 text-sm font-medium tabular-nums text-text-primary">
                {choice.meta}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ChoiceEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}): ReactNode {
  return <EmptyState title={title} description={description} action={action} />;
}
