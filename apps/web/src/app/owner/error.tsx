'use client';

import { WorkspaceError } from '@/components/workspace/workspace-error';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <WorkspaceError reset={reset} />;
}
