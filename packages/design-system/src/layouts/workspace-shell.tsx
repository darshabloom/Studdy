import type { ReactNode } from 'react';

/**
 * Workspace layout foundation (IA doc §3): persistent left sidebar plus a
 * compact universal top bar on desktop. Navigation content is provided by the
 * app per workspace; this shell owns the frame.
 */
export function WorkspaceShell({
  topBar,
  sidebar,
  children,
}: {
  topBar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex min-h-screen flex-col bg-surface-page text-text-primary">
      <div className="sticky top-0 z-[1020] border-b border-surface-border bg-surface-card">
        {topBar}
      </div>
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-surface-border bg-surface-card md:block">
          {sidebar}
        </aside>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

/**
 * Sidebar navigation item. Active destination: pale lavender background,
 * purple icon, stronger label weight (IA doc §3).
 */
export function SidebarItem({
  active = false,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <span
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'flex items-center gap-2 rounded-[var(--radius-gentle)] bg-brand-lavender px-3 py-2 text-sm font-semibold text-brand-purple'
          : 'flex items-center gap-2 rounded-[var(--radius-gentle)] px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-card-secondary hover:text-text-primary'
      }
    >
      {children}
    </span>
  );
}
