import { useId, type ReactNode } from 'react';
import { Label } from './label';
import { Textarea, type TextareaProps } from './textarea';

export interface TextareaFieldProps extends Omit<TextareaProps, 'id'> {
  label: string;
  /** Helper text below the field. */
  helper?: string | undefined;
  /** Field-level error, announced to assistive technology. */
  error?: string | undefined;
}

/** Labelled multi-line field: visible label, textarea, helper and error slots. */
export function TextareaField({
  label,
  helper,
  error,
  ...textareaProps
}: TextareaFieldProps): ReactNode {
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
      <Textarea
        id={id}
        invalid={error !== undefined}
        aria-describedby={describedBy}
        {...textareaProps}
      />
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
