import { clsx } from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(
        'h-10 w-full rounded-[var(--radius-gentle)] border bg-surface-card px-3 text-base text-text-primary',
        'placeholder:text-text-muted',
        'disabled:cursor-not-allowed disabled:bg-surface-card-secondary disabled:text-text-muted',
        invalid ? 'border-status-critical' : 'border-surface-border hover:border-text-muted',
        className,
      )}
      {...props}
    />
  );
});
