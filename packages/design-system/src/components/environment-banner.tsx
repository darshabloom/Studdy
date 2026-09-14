import type { ReactNode } from 'react';

/**
 * Clear Development environment indication (brief §5). Rendered on every
 * page outside production.
 */
export function EnvironmentBanner({ environment }: { environment: string }): ReactNode {
  if (environment === 'production') return null;
  return (
    <div className="bg-status-warning-bg border-b border-status-warning-border px-4 py-0.5 text-center text-[11px] font-semibold text-status-warning sm:py-1 sm:text-xs">
      {environment === 'local' ? 'Local development' : `${environment} environment`} — synthetic
      data only.<span className="hidden sm:inline"> Example tutors are not real tutors.</span>
    </div>
  );
}
