'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * THE DEMO'S ONLY PERSISTENT CHROME.
 *
 * Three jobs, and nothing else, because a control bar competing with the
 * product underneath it defeats the point of showing the product.
 *
 * 1. SAY WHAT THIS IS. Every screen states that the data is invented. A demo
 *    that looks this much like the real thing has an obligation to be obvious
 *    about it — nobody should have to wonder whether they are looking at real
 *    families and real tutors.
 * 2. Let the viewer switch sides. The two-sidedness is the product, and it is
 *    lost if seeing the tutor's half means starting over.
 * 3. Let the viewer start again — which, because the demo keeps no state, is
 *    simply a link home.
 */
export function DemoBar(): ReactNode {
  const pathname = usePathname();
  const side = pathname.startsWith('/demo/tutor')
    ? 'tutor'
    : pathname.startsWith('/demo/parent')
      ? 'parent'
      : null;

  return (
    <div className="sticky top-0 z-[1030] border-b border-brand-purple/20 bg-brand-purple-deep text-text-on-brand">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Link href="/demo" className="font-display text-lg font-semibold">
          Studdy
        </Link>
        <span className="rounded-[var(--radius-pill)] border border-white/25 bg-white/10 px-2.5 py-0.5 text-xs font-medium">
          Demo mode — sample data
        </span>

        <div className="ml-auto flex items-center gap-1">
          <SideLink href="/demo/parent/tutors" active={side === 'parent'}>
            Parent
          </SideLink>
          <SideLink href="/demo/tutor" active={side === 'tutor'}>
            Tutor
          </SideLink>
          <span aria-hidden className="mx-1 h-4 w-px bg-white/25" />
          <SideLink href="/demo" active={false}>
            Restart
          </SideLink>
        </div>
      </div>
    </div>
  );
}

function SideLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={[
        'rounded-[var(--radius-gentle)] px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'bg-white text-brand-purple-deep' : 'text-white/80 hover:bg-white/15 hover:text-white',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
