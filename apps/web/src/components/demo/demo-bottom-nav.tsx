'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * THE WORKSPACE, ON A PHONE.
 *
 * On desktop the sidebar is the product's structure; below `md` it disappears,
 * and a demo shown from a phone lost every way of moving around except the back
 * button. A bottom bar puts the four or five places that matter under a thumb
 * and keeps them there while the page scrolls.
 *
 * NOT A HAMBURGER. A menu behind an icon hides the very thing a reviewer needs
 * to see — that there IS a workspace with several parts — so the main
 * destinations are always visible and only the tutor's secondary pages sit
 * behind `More`.
 *
 * Fixed rather than sticky, padded by the safe-area inset so it clears the home
 * indicator, and the shell reserves matching space under the page so the last
 * card is never hidden behind it.
 */

export type NavIcon =
  'home' | 'student' | 'lessons' | 'search' | 'requests' | 'bookings' | 'students' | 'more';

export interface BottomNavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: NavIcon;
  readonly active: boolean;
  readonly count?: number;
}

export interface MoreItem {
  readonly label: string;
  readonly detail: string;
  readonly href: string;
  readonly active: boolean;
  readonly soon?: boolean;
}

export function DemoBottomNav({
  items,
  more,
}: {
  items: readonly BottomNavItem[];
  more?: readonly MoreItem[];
}): ReactNode {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A sheet left open across a navigation would cover the page just arrived at.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const moreActive = more?.some((item) => item.active) ?? false;
  const columns = items.length + (more === undefined ? 0 : 1);

  return (
    <div className="md:hidden">
      {open && more !== undefined ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => {
              setOpen(false);
            }}
            className="fixed inset-0 z-[1040] bg-text-primary/35"
          />
          <div
            id="demo-more-sheet"
            role="dialog"
            aria-label="More pages"
            className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[1045] rounded-t-[14px] border-t border-surface-border bg-surface-card px-3 pb-3 pt-2 shadow-[0_-8px_24px_rgb(20_51_42/0.12)]"
          >
            <span
              aria-hidden
              className="mx-auto mb-2 block h-[4px] w-[36px] rounded-full bg-surface-border"
            />
            <ul className="flex flex-col">
              {more.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.active ? 'page' : undefined}
                    className={`flex min-h-[56px] items-center gap-3 rounded-[8px] px-3 py-2 ${
                      item.active ? 'bg-brand-tint' : 'active:bg-surface-card-secondary'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[15px] font-medium ${
                          item.soon === true ? 'text-text-secondary' : 'text-text-primary'
                        } ${item.active ? 'text-brand-strong' : ''}`}
                      >
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-text-muted">
                        {item.detail}
                      </span>
                    </span>
                    {item.soon === true ? (
                      <span className="shrink-0 rounded-full border border-surface-border px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                        Coming soon
                      </span>
                    ) : (
                      <span aria-hidden className="shrink-0 text-brand">
                        &rarr;
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <nav
        aria-label="Workspace"
        className="fixed inset-x-0 bottom-0 z-[1050] border-t border-surface-border bg-surface-card/97 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className="flex h-[64px] flex-col items-center justify-center gap-1"
              >
                <Tab icon={item.icon} label={item.label} active={item.active} count={item.count} />
              </Link>
            </li>
          ))}
          {more === undefined ? null : (
            <li>
              <button
                type="button"
                aria-expanded={open}
                aria-controls="demo-more-sheet"
                onClick={() => {
                  setOpen((current) => !current);
                }}
                className="flex h-[64px] w-full flex-col items-center justify-center gap-1"
              >
                <Tab icon="more" label="More" active={moreActive || open} />
              </button>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}

function Tab({
  icon,
  label,
  active,
  count,
}: {
  icon: NavIcon;
  label: string;
  active: boolean;
  count?: number | undefined;
}): ReactNode {
  return (
    <>
      <span
        className={`relative flex h-[28px] w-[52px] items-center justify-center rounded-full transition-colors ${
          active ? 'bg-brand-tint text-brand-strong' : 'text-text-muted'
        }`}
      >
        <Glyph icon={icon} />
        {count === undefined || count === 0 ? null : (
          <span className="absolute -top-1 right-1 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10.5px] font-semibold leading-[18px] tabular-nums text-brand-contrast">
            {count}
          </span>
        )}
      </span>
      <span
        className={`max-w-full truncate px-1 text-[11.5px] leading-none ${
          active ? 'font-semibold text-brand-strong' : 'font-medium text-text-secondary'
        }`}
      >
        {label}
      </span>
    </>
  );
}

/** Line icons, drawn once, in currentColor so the active state is one class. */
function Glyph({ icon }: { icon: NavIcon }): ReactNode {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (icon) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'student':
    case 'students':
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
        </svg>
      );
    case 'lessons':
      return (
        <svg {...common}>
          <path d="M5 4.5h10.5L19 8v11.5H5z" />
          <path d="M8.5 11h7M8.5 14.5h7" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.5-4.5" />
        </svg>
      );
    case 'requests':
      return (
        <svg {...common}>
          <path d="M4 6.5h16v11H4z" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'bookings':
      return (
        <svg {...common}>
          <rect x="4" y="5.5" width="16" height="14" rx="1.5" />
          <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
        </svg>
      );
    case 'more':
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.2" fill="currentColor" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <circle cx="18" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
  }
}
