/**
 * Breakpoints. Mobile is designed separately, not as a shrunk desktop
 * (IA doc §3). Visual regression runs at desktop, medium and mobile widths.
 */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;
