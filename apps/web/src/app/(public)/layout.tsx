import Link from 'next/link';
import { Button, PublicShell } from '@studdy/design-system';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/tutors', label: 'Find a Tutor' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/for-tutors', label: 'For Tutors' },
  { href: '/trust-and-safety', label: 'Trust and Safety' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/help', label: 'Help' },
] as const;

function Header() {
  return (
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
      <Link href="/" className="font-display text-2xl font-semibold text-brand-purple-deep">
        Studdy
      </Link>
      <nav aria-label="Main" className="hidden items-center gap-5 lg:flex">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Button variant="quiet" size="sm" asChild>
          <Link href="/sign-in">Log in</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/sign-up">Join Studdy</Link>
        </Button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="font-display text-lg font-semibold text-brand-purple-deep">Studdy</p>
        <p className="mt-2 text-sm text-text-secondary">The platform for better tutoring.</p>
      </div>
      <nav aria-label="Families" className="text-sm">
        <p className="mb-2 font-semibold text-text-primary">For families</p>
        <ul className="space-y-1 text-text-secondary">
          <li>
            <Link href="/tutors" className="hover:text-text-primary">
              Find a Tutor
            </Link>
          </li>
          <li>
            <Link href="/how-it-works" className="hover:text-text-primary">
              How It Works
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="hover:text-text-primary">
              Pricing
            </Link>
          </li>
        </ul>
      </nav>
      <nav aria-label="Tutors" className="text-sm">
        <p className="mb-2 font-semibold text-text-primary">For tutors</p>
        <ul className="space-y-1 text-text-secondary">
          <li>
            <Link href="/for-tutors" className="hover:text-text-primary">
              Join as a Tutor
            </Link>
          </li>
        </ul>
      </nav>
      <nav aria-label="Support" className="text-sm">
        <p className="mb-2 font-semibold text-text-primary">Support</p>
        <ul className="space-y-1 text-text-secondary">
          <li>
            <Link href="/trust-and-safety" className="hover:text-text-primary">
              Trust and Safety
            </Link>
          </li>
          <li>
            <Link href="/help" className="hover:text-text-primary">
              Help
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PublicShell header={<Header />} footer={<Footer />}>
      {children}
    </PublicShell>
  );
}
