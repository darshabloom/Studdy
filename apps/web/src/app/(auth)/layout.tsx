import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import logo from '@/assets/brand/studdy-logo-approved.webp';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <header className="border-b border-surface-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Studdy home">
            <Image src={logo} alt="Studdy" className="h-10 w-auto" priority unoptimized />
          </Link>
          <Link href="/" className="text-sm font-medium text-parent-navy hover:underline">
            Back to Studdy
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
