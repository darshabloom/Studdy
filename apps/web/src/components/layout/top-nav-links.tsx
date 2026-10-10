'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isActiveNavItem, type TopNavItem } from '@/lib/parent/nav';

/**
 * The destinations themselves. A client component only because the active
 * item is a fact about the current path.
 *
 * ONE ROW AT EVERY WIDTH. On a phone the row scrolls sideways rather than
 * collapsing into a menu or moving to a sidebar: five short words fit most
 * phones outright, and a parent should not have to open something to see
 * where they can go.
 */
export function TopNavLinks({ items }: { items: readonly TopNavItem[] }): ReactNode {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="-mx-1 flex items-center gap-1 overflow-x-auto px-1">
      {items.map((item) => {
        const active = isActiveNavItem(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'shrink-0 border-b-2 border-brand-purple px-3 py-3 text-sm font-semibold text-brand-purple-deep'
                : 'shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-text-secondary hover:border-surface-border hover:text-text-primary'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
