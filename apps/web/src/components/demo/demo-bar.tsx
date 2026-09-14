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
      <div className="mx-auto flex max-w-[1180px] items-center gap-x-3 px-3 py-1.5 sm:flex-wrap sm:gap-x-4 sm:gap-y-2 sm:px-5 sm:py-2">
        {/* On a phone the wordmark and the honesty label stack into one small
            block, so the whole bar is a single row and the side switch stays
            within reach. */}
        <Link
          href="/demo"
          className="flex min-w-0 flex-col leading-none sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="font-display text-[16px] font-semibold sm:text-lg">Studdy</span>
          <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-brand-contrast/75 sm:mt-0 sm:rounded-full sm:border sm:border-brand-contrast/25 sm:bg-brand-contrast/10 sm:px-2.5 sm:py-0.5 sm:text-[11px] sm:text-brand-contrast">
            Demo &mdash; sample data
          </span>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <BarLink href="/demo/parent" active={side === 'parent'}>
            Parent
          </BarLink>
          <BarLink href="/demo/tutor" active={side === 'tutor'}>
            Tutor
          </BarLink>
          <span aria-hidden className="mx-1 h-4 w-px bg-brand-contrast/25" />
          <BarLink href="/demo" active={false}>
            <span className="sm:hidden" aria-hidden>
              &#x21BA;
            </span>
            <span className="sr-only sm:not-sr-only">Restart</span>
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
      className={`inline-flex min-h-[34px] items-center rounded-[4px] px-3 py-1 text-[13px] font-medium transition-colors sm:min-h-0 sm:px-2.5 sm:text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-contrast ${
        active
          ? 'bg-brand-contrast text-brand-strong'
          : 'text-brand-contrast/80 hover:bg-brand-contrast/15 hover:text-brand-contrast'
      }`}
    >
      {children}
    </Link>
  );
}
