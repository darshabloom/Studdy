import Link from 'next/link';
import { safeAuthNext } from '@/lib/auth/safe-next';

export function GoogleSignIn({ next }: { next?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-4">
      <Link
        href={`/auth/google?next=${encodeURIComponent(safeAuthNext(next))}`}
        className="flex min-h-12 items-center justify-center rounded-xl border-2 border-[#0B2D5C] bg-white px-4 text-sm font-bold text-[#0B2D5C] hover:bg-[#DDEBFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F36F2B]"
      >
        Continue with Google
      </Link>
      <div className="flex items-center gap-3 text-xs text-[#435772]">
        <span aria-hidden="true" className="h-px flex-1 bg-surface-border" />
        <span>or use email and password</span>
        <span aria-hidden="true" className="h-px flex-1 bg-surface-border" />
      </div>
    </div>
  );
}
