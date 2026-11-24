import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import logo from '@/assets/brand/studdy-logo-approved.webp';

/** Public navigation follows the approved Studdy navy/yellow brand kit. */
export const PUBLIC_NAV_ITEMS = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/tutors', label: 'Tutors' },
  { href: '/for-tutors', label: 'For tutors' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/trust-and-safety', label: 'Trust & safety' },
] as const;

export function PublicHeader(): ReactNode {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <Link href="/" className="flex shrink-0 items-center rounded-md" aria-label="Studdy home">
        <Image src={logo} alt="Studdy" priority unoptimized className="h-11 w-auto" />
      </Link>
      <nav aria-label="Main" className="order-3 flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold text-[#0B2D5C] lg:order-2 lg:w-auto lg:gap-7">
        {PUBLIC_NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-md py-2 hover:text-[#F36F2B] focus-visible:outline-offset-4">
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="order-2 ml-auto flex shrink-0 items-center gap-2 lg:order-3">
        <Link href="/sign-in" className="rounded-full border border-[#0B2D5C] px-4 py-2 text-sm font-bold text-[#0B2D5C] hover:bg-[#DDEBFF]">
          Log in
        </Link>
        <Link href="/sign-up" className="rounded-full bg-[#F6B61C] px-5 py-2.5 text-sm font-bold text-[#0B2D5C] hover:bg-[#ffd049]">
          Get started
        </Link>
      </div>
    </div>
  );
}

export function PublicFooter(): ReactNode {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 text-[#0B2D5C] sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
      <div>
        <Link href="/" aria-label="Studdy home"><Image src={logo} alt="Studdy" unoptimized className="h-10 w-auto" /></Link>
        <p className="mt-3 text-sm text-[#435772]">The platform for better tutoring.</p>
      </div>
      <nav aria-label="Families" className="text-sm">
        <p className="mb-3 font-bold">For families</p>
        <ul className="space-y-2 text-[#435772]">
          <li><Link href="/tutors" className="hover:underline">Find a tutor</Link></li>
          <li><Link href="/how-it-works" className="hover:underline">How it works</Link></li>
          <li><Link href="/pricing" className="hover:underline">Pricing</Link></li>
        </ul>
      </nav>
      <nav aria-label="Tutors" className="text-sm">
        <p className="mb-3 font-bold">For tutors</p>
        <ul className="space-y-2 text-[#435772]">
          <li><Link href="/for-tutors" className="hover:underline">Join as a tutor</Link></li>
          <li><Link href="/sign-in" className="hover:underline">Tutor log in</Link></li>
        </ul>
      </nav>
      <nav aria-label="Support" className="text-sm">
        <p className="mb-3 font-bold">Support</p>
        <ul className="space-y-2 text-[#435772]">
          <li><Link href="/trust-and-safety" className="hover:underline">Trust and safety</Link></li>
          <li><Link href="/help" className="hover:underline">Help</Link></li>
        </ul>
      </nav>
    </div>
  );
}
