import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/** Shared loading / empty / error / restricted patterns (doc 01 §17 patterns). */

export function Skeleton({ className }: { className?: string }): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'animate-pulse rounded-[var(--radius-gentle)] bg-surface-card-secondary',
        className,
      )}
    />
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }): ReactNode {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 p-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export interface StateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: StateProps): ReactNode {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-medium)] border border-dashed border-surface-border bg-surface-card p-12 text-center">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {description !== undefined ? (
        <p className="max-w-md text-sm text-text-secondary">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, description, action }: StateProps): ReactNode {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-[var(--radius-medium)] border border-status-critical-border bg-status-critical-bg p-12 text-center"
    >
      <h2 className="text-lg font-semibold text-status-critical">{title}</h2>
      {description !== undefined ? (
        <p className="max-w-md text-sm text-text-primary">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Restricted access is a first-class state with honest copy, e.g.
 * "You do not have access to family payment information" (doc 01 §16).
 */
export function RestrictedState({ title, description, action }: StateProps): ReactNode {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-medium)] border border-status-restricted-border bg-status-restricted-bg p-12 text-center">
      <p className="text-xs font-semibold tracking-wide text-status-restricted uppercase">
        Restricted access
      </p>
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {description !== undefined ? (
        <p className="max-w-md text-sm text-text-secondary">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
