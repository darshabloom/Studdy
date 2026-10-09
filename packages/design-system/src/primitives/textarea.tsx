import { clsx } from 'clsx';
import { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/** Multi-line text. Same border, radius and invalid treatment as `Input`. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={clsx(
        'w-full rounded-[var(--radius-gentle)] border bg-surface-card px-3 py-2 text-base text-text-primary',
        'placeholder:text-text-muted',
        'disabled:cursor-not-allowed disabled:bg-surface-card-secondary disabled:text-text-muted',
        invalid ? 'border-status-critical' : 'border-surface-border hover:border-text-muted',
        className,
      )}
      {...props}
    />
  );
});
