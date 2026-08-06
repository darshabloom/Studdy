import { redirect } from 'next/navigation';
import { Button, Card } from '@studdy/design-system';
import { decideWorkspaceEntry } from '@studdy/domain/identity';
import type { WorkspaceCode } from '@studdy/permissions';
import { chooseWorkspaceAction } from '@/lib/auth/actions';
import { resolveIdentity } from '@/lib/identity/resolve';

export const metadata = { title: 'Choose a workspace' };

const WORKSPACE_LABELS: Record<WorkspaceCode, { title: string; description: string }> = {
  parent: {
    title: 'Parent',
    description: 'Students, bookings, progress and payments for your family.',
  },
  tutor: { title: 'Tutor', description: 'Your bookings, students, services and earnings.' },
  dependent_student: { title: 'Student', description: 'Your lessons, homework and progress.' },
  independent_student: { title: 'Student', description: 'Your lessons, bookings and progress.' },
  organisation: {
    title: 'Organisation',
    description: 'Organisation tutors, students and programmes.',
  },
  platform_manager: {
    title: 'Platform Manager',
    description: 'Cases, tasks and marketplace administration.',
  },
  platform_owner: {
    title: 'Platform Owner',
    description: 'Platform-wide configuration and oversight.',
  },
};

/** Shown only when several workspaces are available and none is saved. */
export default async function ChooseWorkspacePage() {
  const identity = await resolveIdentity();
  if (identity === null) redirect('/sign-in');
  const decision = decideWorkspaceEntry(identity.roleAssignments, identity.lastActiveWorkspaceCode);
  if (decision.kind !== 'choose') redirect('/workspace');

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold text-text-primary">Where would you like to go?</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your account has more than one workspace. We&rsquo;ll remember your choice for next time —
          you can switch whenever you like.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {decision.options.map((workspace) => (
            <form key={workspace} action={chooseWorkspaceAction}>
              <input type="hidden" name="workspace" value={workspace} />
              <Card className="p-0">
                <button
                  type="submit"
                  className="flex w-full flex-col items-start gap-1 rounded-[var(--radius-medium)] p-5 text-left hover:bg-brand-lavender/40"
                >
                  <span className="font-semibold text-brand-purple">
                    {WORKSPACE_LABELS[workspace].title}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {WORKSPACE_LABELS[workspace].description}
                  </span>
                </button>
              </Card>
            </form>
          ))}
        </div>
        <div className="mt-6">
          <Button variant="quiet" asChild>
            <a href="/">Back to Studdy home</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
