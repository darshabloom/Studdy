import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <header className="border-b border-surface-border">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <Link href="/" className="font-display text-2xl font-semibold text-brand-purple-deep">
            Studdy
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
