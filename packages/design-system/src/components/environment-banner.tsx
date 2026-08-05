import type { ReactNode } from 'react';

/**
 * Clear Development environment indication (brief §5). Rendered on every
 * page outside production.
 */
export function EnvironmentBanner({ environment }: { environment: string }): ReactNode {
  if (environment === 'production') return null;
  return (
    <div className="bg-status-warning-bg border-b border-status-warning-border px-4 py-1 text-center text-xs font-semibold text-status-warning">
      {environment === 'local' ? 'Local development' : `${environment} environment`} — synthetic
      data only. Example tutors are not real tutors.
    </div>
  );
}
