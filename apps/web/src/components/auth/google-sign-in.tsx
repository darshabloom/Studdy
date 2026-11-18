import Link from 'next/link';

/** Google is the recommended path; password access remains clearly available. */
export function GoogleSignIn({ next = '/workspace' }: { next?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/auth/google?next=${encodeURIComponent(next)}`}
        className="flex min-h-11 items-center justify-center rounded-[var(--radius-gentle)] border border-surface-border bg-surface-card px-4 py-3 text-center text-sm font-semibold text-text-primary hover:bg-surface-card-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
      >
        Continue with Google
      </Link>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-surface-border" />
        <span>or use email and password</span>
        <span aria-hidden="true" className="h-px flex-1 bg-surface-border" />
      </div>
    </div>
  );
}
