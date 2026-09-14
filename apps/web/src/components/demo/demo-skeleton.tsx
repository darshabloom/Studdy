import type { ReactNode } from 'react';

/**
 * A PICTURE OF A PAGE THAT DOES NOT EXIST YET.
 *
 * A "Coming soon" page with one sentence on it tells a tutor nothing about what
 * is coming. A faded, inert mock-up tells them at a glance — and is honest,
 * because nothing in it responds to a click.
 *
 * Inert three ways, deliberately: `pointer-events-none` so nothing can be
 * clicked, `aria-hidden` and `inert` so nothing can be reached by keyboard or
 * announced by a screen reader, and reduced contrast so it never reads as a
 * working control. The explanation above it is the part that is real.
 */
export function SkeletonPreview({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="relative mt-6">
      <div
        aria-hidden
        // `inert` is what makes the mock-up unreachable by keyboard as well as
        // by pointer. React 19 takes it as a boolean; older typings do not
        // declare it at all.
        inert
        className="pointer-events-none select-none opacity-55 blur-[0.2px] saturate-[0.75]"
      >
        {children}
      </div>
      {/* Sits over the mock-up so it cannot be mistaken for a working page. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end pr-3 sm:justify-center sm:pr-0">
        <span className="rounded-b-[5px] bg-brand px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand-contrast">
          Not built yet
        </span>
      </div>
    </div>
  );
}

/** A grey bar standing in for text nobody has written. */
export function Bar({ w = 'w-32' }: { w?: string }): ReactNode {
  return <span className={`block h-[9px] rounded-full bg-text-muted/25 ${w}`} />;
}
