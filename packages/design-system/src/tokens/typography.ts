/**
 * Typography tokens — the ten type roles from doc 01 §5.
 *
 * Two-font system: a modern sans for app and body text plus a distinctive
 * display face for public headings. No families are named in the pack; the
 * proposed pairing (pending approval) is Inter (sans) + Fraunces (display),
 * loaded via next/font in the app with system fallbacks here.
 * Tabular numerals are required for finance, time and statistics.
 */

export const fontFamilies = {
  sans: "var(--font-inter, 'Inter'), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: "var(--font-fraunces, 'Fraunces'), 'Georgia', ui-serif, serif",
} as const;

export interface TypeRole {
  fontFamily: 'sans' | 'display';
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}

export const typeRoles: Record<string, TypeRole> = {
  display1: {
    fontFamily: 'display',
    fontSize: '3.5rem',
    lineHeight: '1.1',
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  display2: {
    fontFamily: 'display',
    fontSize: '2.75rem',
    lineHeight: '1.15',
    fontWeight: 600,
    letterSpacing: '-0.015em',
  },
  heading1: {
    fontFamily: 'sans',
    fontSize: '2rem',
    lineHeight: '1.2',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  heading2: { fontFamily: 'sans', fontSize: '1.5rem', lineHeight: '1.25', fontWeight: 600 },
  heading3: { fontFamily: 'sans', fontSize: '1.25rem', lineHeight: '1.3', fontWeight: 600 },
  bodyLarge: { fontFamily: 'sans', fontSize: '1.125rem', lineHeight: '1.6', fontWeight: 400 },
  body: { fontFamily: 'sans', fontSize: '1rem', lineHeight: '1.6', fontWeight: 400 },
  bodySmall: { fontFamily: 'sans', fontSize: '0.875rem', lineHeight: '1.5', fontWeight: 400 },
  label: { fontFamily: 'sans', fontSize: '0.875rem', lineHeight: '1.2', fontWeight: 500 },
  caption: { fontFamily: 'sans', fontSize: '0.75rem', lineHeight: '1.4', fontWeight: 400 },
} as const;

/** CSS for tabular numerals in finance, time and statistics contexts. */
export const tabularNumerals = 'font-variant-numeric: tabular-nums;' as const;
