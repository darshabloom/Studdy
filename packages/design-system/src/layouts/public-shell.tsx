import type { ReactNode } from 'react';

/**
 * Public layout: spacious and expressive (doc 01 §3.1). Header/footer content
 * is provided by the app; this shell owns structure, width and rhythm.
 */
export function PublicShell({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-text-primary">
      <header className="sticky top-0 z-[1020] border-b border-surface-border bg-surface-page/95 backdrop-blur">
        {header}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-surface-border bg-surface-card-secondary">{footer}</footer>
    </div>
  );
}
