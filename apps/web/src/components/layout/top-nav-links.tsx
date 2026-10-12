'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isActiveNavItem, type TopNavItem } from '@/lib/parent/nav';

/**
 * The destinations themselves. A client component only because the active
 * item is a fact about the current path.
 *
 * ONE ROW AT EVERY WIDTH, with all five showing. On a phone the items spread
 * across the full width with tight padding, so the last destination is never
 * off the edge waiting to be scrolled to; nothing collapses into a menu.
 */
export function TopNavLinks({ items }: { items: readonly TopNavItem[] }): ReactNode {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Workspace"
      className="flex items-center justify-between overflow-x-auto md:justify-start md:gap-1"
    >
      {items.map((item) => {
        const active = isActiveNavItem(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'shrink-0 border-b-2 border-parent-gold px-1 py-3 text-[13px] font-semibold text-brand-purple-deep md:px-3 md:text-sm'
                : 'shrink-0 border-b-2 border-transparent px-1 py-3 text-[13px] font-medium text-text-secondary hover:border-surface-border hover:text-text-primary md:px-3 md:text-sm'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
