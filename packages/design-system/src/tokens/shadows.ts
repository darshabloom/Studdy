/**
 * Depth tokens (doc 01 §6): cards and tables generally carry no shadow;
 * medium shadow is reserved for menus, popovers, date pickers, drawers and
 * dialogues.
 */
export const shadows = {
  none: 'none',
  /** Menus, popovers, date pickers, drawers, dialogues. */
  overlay: '0 8px 24px rgba(28, 25, 23, 0.14), 0 2px 6px rgba(28, 25, 23, 0.08)',
} as const;
