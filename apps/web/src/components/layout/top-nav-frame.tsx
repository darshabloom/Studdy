import type { ReactNode } from 'react';

/**
 * The frame of a top-navigation workspace: one bar, then the page. No sidebar.
 *
 * Carries the Parent theme scope and the two soft shapes at the page corners.
 * The shapes are decoration and nothing else: fixed to the viewport so they
 * never add scroll, behind everything, low in contrast, and hidden from
 * assistive technology.
 */
export function TopNavFrame({
  bar,
  children,
  mainClassName = 'mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:py-6',
}: {
  bar: ReactNode;
  children: ReactNode;
  mainClassName?: string;
}): ReactNode {
  return (
    <div className="parent-theme relative isolate flex min-h-screen flex-col">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[120px] -right-[140px] h-[360px] w-[420px] rounded-[58%_42%_47%_53%/52%_45%_55%_48%] bg-parent-sky opacity-70" />
        <div className="absolute -bottom-[150px] -left-[160px] h-[380px] w-[440px] rounded-[45%_55%_60%_40%/48%_58%_42%_52%] bg-parent-cream" />
      </div>
      <header className="sticky top-0 z-[1020] border-b border-surface-border bg-surface-card">
        {bar}
      </header>
      <main className={mainClassName}>{children}</main>
    </div>
  );
}
