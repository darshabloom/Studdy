'use client';

import { Button, ErrorState } from '@studdy/design-system';

/** Shared client error boundary body for workspace routes. */
export function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Something went wrong"
      description="We could not load this page. Your data is safe — try again, and contact support if it keeps happening."
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
