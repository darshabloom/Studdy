'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * THE DEMO'S ONLY PERSISTENT CHROME.
 *
 * Three jobs and nothing else, because a control bar competing with the product
 * underneath it defeats the point of showing the product.
 *
 *   1. SAY WHAT THIS IS. A demo that looks this much like the real thing has an
 *      obligation to be obvious that the people in it are invented.
 *   2. Let a reviewer switch sides. The two-sidedness is the product, and it is
 *      lost if seeing the tutor's half means starting over.
 *   3. Let them start again — which, because the demo keeps no state, is a link.
 */
export function DemoBar(): ReactNode {
  const pathname = usePathname();
  const side = pathname.startsWith('/demo/tutor')
    ? 'tutor'
    : pathname.startsWith('/demo/parent')
      ? 'parent'
      : null;

  return (
    <div className="sticky top-0 z-[1030] border-b border-brand-strong bg-brand-strong text-brand-contrast">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2">
        <Link href="/demo" className="font-display text-lg font-semibold">
          Studdy
        </Link>
        <span className="rounded-full border border-brand-contrast/25 bg-brand-contrast/10 px-2.5 py-0.5 text-[11px] font-medium">
          Demo &mdash; sample data
        </span>

        <div className="ml-auto flex items-center gap-1">
          <BarLink href="/demo/parent" active={side === 'parent'}>
            Parent
          </BarLink>
          <BarLink href="/demo/tutor" active={side === 'tutor'}>
            Tutor
          </BarLink>
          <span aria-hidden className="mx-1 h-4 w-px bg-brand-contrast/25" />
          <BarLink href="/demo" active={false}>
            Restart
          </BarLink>
        </div>
      </div>
    </div>
  );
}

function BarLink({
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
      className={`rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-contrast ${
        active
          ? 'bg-brand-contrast text-brand-strong'
          : 'text-brand-contrast/80 hover:bg-brand-contrast/15 hover:text-brand-contrast'
      }`}
    >
      {children}
    </Link>
  );
}
