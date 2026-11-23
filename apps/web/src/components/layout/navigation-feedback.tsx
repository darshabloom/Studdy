'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Accessible acknowledgement for navigation and form submission across all
 * workspaces, including links outside workspace navigation.
 *
 * This is deliberately informational: it does not interfere with native
 * navigation, browser back/forward, authentication, or server actions.
 */
export function NavigationFeedback() {
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      setMessage(null);
      setSlow(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (message === null) return;
    const delayed = window.setTimeout(() => setSlow(true), 8000);
    const expiry = window.setTimeout(() => {
      setMessage(null);
      setSlow(false);
    }, 30000);
    return () => {
      window.clearTimeout(delayed);
      window.clearTimeout(expiry);
    };
  }, [message]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      setSlow(false);
      setMessage('Opening page…');
    };

    const onSubmit = (event: Event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      setSlow(false);
      setMessage('Saving…');
    };

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
    };
  }, []);

  if (message === null) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[2000] flex max-w-[min(92vw,22rem)] items-center gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-3 text-sm font-semibold text-text-primary shadow-lg"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-purple border-t-transparent"
      />
      <span>{slow ? 'Still working…' : message}</span>
    </div>
  );
}
