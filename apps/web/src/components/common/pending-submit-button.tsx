'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@studdy/design-system';

export function PendingSubmitButton({
  label,
  pendingLabel,
  variant,
  size,
}: {
  label: string;
  pendingLabel: string;
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      {...(variant === undefined ? {} : { variant })}
      {...(size === undefined ? {} : { size })}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
