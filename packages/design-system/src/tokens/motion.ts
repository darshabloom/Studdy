/** Motion tokens. Respect prefers-reduced-motion at every call site. */
export const motion = {
  durationFast: '120ms',
  durationBase: '200ms',
  durationSlow: '320ms',
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const zIndex = {
  sticky: 1020,
  overlay: 1030,
  modal: 1040,
  popover: 1050,
  toast: 1060,
} as const;
