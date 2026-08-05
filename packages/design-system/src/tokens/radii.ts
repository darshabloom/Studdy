/**
 * Shape tokens (doc 01 §6): moderate rounding — gentle for buttons and
 * inputs, medium for cards and dialogues, pills only for compact statuses,
 * filters and segmented controls. Tables are not rounded per cell.
 */
export const radii = {
  /** Buttons, inputs. */
  gentle: '6px',
  /** Cards, dialogues. */
  medium: '10px',
  /** Compact statuses, filters, segmented controls only. */
  pill: '999px',
  none: '0px',
} as const;
