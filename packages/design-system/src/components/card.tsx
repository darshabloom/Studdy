import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Surface tone (doc 01 §7.1). Cards carry no shadow. */
  tone?: 'primary' | 'secondary' | 'brand' | 'progress';
}

const toneClasses = {
  primary: 'bg-surface-card border-surface-border',
  secondary: 'bg-surface-card-secondary border-surface-border',
  brand: 'bg-brand-lavender border-brand-purple/20',
  progress: 'bg-brand-green-pale border-brand-green/20',
} as const;

export function Card({ tone = 'primary', className, ...props }: CardProps): ReactNode {
  return (
    <div
      className={clsx('rounded-[var(--radius-medium)] border p-6', toneClasses[tone], className)}
      {...props}
    />
  );
}
