import { useId, type ReactNode } from 'react';
import { Input, type InputProps } from './input';
import { Label } from './label';

export interface FieldProps extends Omit<InputProps, 'id'> {
  label: string;
  /** Helper text below the field. */
  helper?: string | undefined;
  /** Field-level error, announced to assistive technology. */
  error?: string | undefined;
}

/** Labelled form field: visible label, input, helper and error slots. */
export function Field({ label, helper, error, ...inputProps }: FieldProps): ReactNode {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy =
    [error !== undefined ? errorId : null, helper !== undefined ? helperId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="flex flex-col">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} invalid={error !== undefined} aria-describedby={describedBy} {...inputProps} />
      {helper !== undefined && error === undefined ? (
        <p id={helperId} className="mt-1 text-sm text-text-secondary">
          {helper}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-status-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}
