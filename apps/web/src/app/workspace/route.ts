import { NextResponse } from 'next/server';
import { WORKSPACE_ROUTE_SEGMENTS } from '@studdy/permissions';
import { resolveIdentity } from '@/lib/identity/resolve';

/**
 * Internal post-sign-in router: resolves the user's workspaces server-side
 * and redirects to the first available one (Blueprint §6.1). Users with no
 * workspace land on the student shell's restricted state.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const identity = await resolveIdentity();
  const base = new URL(request.url).origin;
  if (identity === null) {
    return NextResponse.redirect(new URL('/sign-in', base));
  }
  const [first] = identity.workspaces;
  if (first === undefined) {
    return NextResponse.redirect(new URL('/student', base));
  }
  return NextResponse.redirect(new URL(`/${WORKSPACE_ROUTE_SEGMENTS[first]}`, base));
}
