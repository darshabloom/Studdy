import { clsx } from 'clsx';
import type { ReactNode } from 'react';

export type AlertTone = 'information' | 'success' | 'warning' | 'risk' | 'critical';

const toneClasses: Record<AlertTone, string> = {
  information: 'text-status-information bg-status-information-bg border-status-information-border',
  success: 'text-status-success bg-status-success-bg border-status-success-border',
  warning: 'text-status-warning bg-status-warning-bg border-status-warning-border',
  risk: 'text-status-risk bg-status-risk-bg border-status-risk-border',
  critical: 'text-status-critical bg-status-critical-bg border-status-critical-border',
};

const toneLabels: Record<AlertTone, string> = {
  information: 'Information',
  success: 'Success',
  warning: 'Warning',
  risk: 'Attention needed',
  critical: 'Critical',
};

export interface AlertProps {
  tone: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Semantic alert. Colour is never the only signal — tone label text is always rendered. */
export function Alert({ tone, title, children, className }: AlertProps): ReactNode {
  return (
    <div
      role={tone === 'critical' || tone === 'risk' ? 'alert' : 'status'}
      className={clsx('rounded-[var(--radius-medium)] border p-4', toneClasses[tone], className)}
    >
      <p className="mb-1 text-sm font-semibold">{title ?? toneLabels[tone]}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
