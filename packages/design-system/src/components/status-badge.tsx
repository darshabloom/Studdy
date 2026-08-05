import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/**
 * Status system (doc 01 §10.2) — ten families. Each badge pairs colour with
 * text (never colour alone). Pill shape is approved for compact statuses.
 */
export const STATUS_FAMILIES = [
  'active',
  'pending',
  'awaiting_action',
  'complete',
  'paused',
  'restricted',
  'overdue',
  'failed',
  'cancelled',
  'archived',
] as const;

export type StatusFamily = (typeof STATUS_FAMILIES)[number];

const familyClasses: Record<StatusFamily, string> = {
  active: 'text-status-success bg-status-success-bg border-status-success-border',
  pending: 'text-status-information bg-status-information-bg border-status-information-border',
  awaiting_action: 'text-status-warning bg-status-warning-bg border-status-warning-border',
  complete: 'text-status-success bg-status-success-bg border-status-success-border',
  paused: 'text-status-neutral bg-status-neutral-bg border-status-neutral-border',
  restricted: 'text-status-restricted bg-status-restricted-bg border-status-restricted-border',
  overdue: 'text-status-risk bg-status-risk-bg border-status-risk-border',
  failed: 'text-status-critical bg-status-critical-bg border-status-critical-border',
  cancelled: 'text-status-neutral bg-status-neutral-bg border-status-neutral-border',
  archived: 'text-status-neutral bg-status-neutral-bg border-status-neutral-border',
};

export interface StatusBadgeProps {
  family: StatusFamily;
  children: ReactNode;
  className?: string;
}

export function StatusBadge({ family, children, className }: StatusBadgeProps): ReactNode {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-medium',
        familyClasses[family],
        className,
      )}
    >
      {children}
    </span>
  );
}
