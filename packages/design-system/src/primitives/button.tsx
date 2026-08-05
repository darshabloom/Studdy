import { Slot } from '@radix-ui/react-slot';
import { clsx } from 'clsx';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

/**
 * Button hierarchy per doc 01 §9.1: primary (purple fill, normally one per
 * decision region), secondary, tertiary, quiet, destructive.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'quiet' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as the child element (e.g. a Next.js Link) via Radix Slot. */
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-action-primary text-text-on-brand hover:bg-action-primary-hover active:bg-action-primary-active border border-transparent',
  secondary:
    'bg-surface-card text-brand-purple border border-brand-purple hover:bg-brand-lavender active:bg-brand-lavender',
  tertiary:
    'bg-surface-card-secondary text-text-primary border border-surface-border hover:bg-surface-border/60',
  quiet: 'bg-transparent text-brand-purple hover:bg-brand-lavender border border-transparent',
  destructive: 'bg-status-critical text-text-on-brand hover:opacity-90 border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', asChild = false, className, type, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      // Explicit type prevents accidental form submission (only for real buttons).
      {...(asChild ? {} : { type: type ?? 'button' })}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-gentle)] font-medium',
        'transition-colors duration-[var(--duration-fast)]',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});
