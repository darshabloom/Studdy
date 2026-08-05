import * as LabelPrimitive from '@radix-ui/react-label';
import { clsx } from 'clsx';
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react';

/**
 * Visible label above every control — placeholder-only forms are prohibited
 * (doc 01 §16).
 */
export const Label = forwardRef<
  ComponentRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={clsx('mb-1 block text-sm font-medium text-text-primary', className)}
      {...props}
    />
  );
});
