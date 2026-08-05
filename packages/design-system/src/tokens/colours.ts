/**
 * Studdy colour tokens.
 *
 * The planning pack specifies colour ROLES only (doc 01 §4) — no document
 * contains a hex value. These concrete values are authored for PR1 and are
 * pending Darsha's approval via the preview deployment. Every text/surface
 * pairing is proven against WCAG 2.2 AA (≥ 4.5:1) in colours.test.ts.
 *
 * Rules from doc 01:
 * - Brand green is never the only success treatment.
 * - Every semantic state also uses text, icons or patterns — never colour alone.
 */

export const brand = {
  /** High-contrast brand moments, dark feature surfaces. */
  purpleDeep: '#2E1065',
  /** Main actions, selected navigation. */
  purplePrimary: '#6D28D9',
  /** Interactive emphasis (hover, active accents). */
  purpleMid: '#7C3AED',
  /** Selected states, highlighted cards, branded surfaces. */
  lavenderPale: '#EDE9FE',
  /** Supporting brand moments. */
  greenDeep: '#14532D',
  /** Secondary emphasis, progress interactions. */
  greenMid: '#15803D',
  /** Learning growth, achievements, supportive surfaces. */
  greenPale: '#DCFCE7',
} as const;

export const surface = {
  /** Page background — warm off-white (doc 01 §7.1). */
  page: '#FAF8F5',
  /** Primary card. */
  card: '#FFFFFF',
  /** Secondary card — very light warm neutral tint. */
  cardSecondary: '#F5F2ED',
  /** Brand feature surface. */
  brandFeature: '#EDE9FE',
  /** Progress feature surface. */
  progressFeature: '#DCFCE7',
  /** Warning / restricted soft tint. */
  warningTint: '#FEF3C7',
  /** Critical — very pale red. */
  criticalTint: '#FEE2E2',
  /** Default border on warm surfaces. */
  border: '#E7E2DA',
} as const;

export const text = {
  primary: '#1C1917',
  secondary: '#57534E',
  muted: '#6F6862',
  onDark: '#FFFFFF',
  onBrand: '#FFFFFF',
} as const;

/**
 * Semantic status colours (doc 01 §4.3): information, success, warning, risk,
 * critical, neutral, restricted. Each has an AA-compliant foreground on its tint.
 */
export const status = {
  information: { foreground: '#1D4ED8', background: '#DBEAFE', border: '#93C5FD' },
  success: { foreground: '#15803D', background: '#DCFCE7', border: '#86EFAC' },
  warning: { foreground: '#B45309', background: '#FEF3C7', border: '#FCD34D' },
  risk: { foreground: '#C2410C', background: '#FFEDD5', border: '#FDBA74' },
  critical: { foreground: '#B91C1C', background: '#FEE2E2', border: '#FCA5A5' },
  neutral: { foreground: '#57534E', background: '#F5F5F4', border: '#D6D3D1' },
  restricted: { foreground: '#475569', background: '#F1F5F9', border: '#CBD5E1' },
} as const;

export type StatusTone = keyof typeof status;

export const interactive = {
  /** Focus ring — must read visually stronger than hover (doc 01 §6). */
  focusRing: '#7C3AED',
  actionPrimary: brand.purplePrimary,
  actionPrimaryHover: '#5B21B6',
  actionPrimaryActive: '#4C1D95',
} as const;
