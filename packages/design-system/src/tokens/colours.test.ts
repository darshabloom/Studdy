import { describe, expect, it } from 'vitest';
import { brand, interactive, status, surface, text } from './colours';

/** WCAG 2.2 relative luminance + contrast ratio. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match || match[1] === undefined) throw new Error(`Invalid hex colour: ${hex}`);
  const value = parseInt(match[1], 16);
  return (
    0.2126 * channel((value >> 16) & 0xff) +
    0.7152 * channel((value >> 8) & 0xff) +
    0.0722 * channel(value & 0xff)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_TEXT = 4.5;
const AA_LARGE_TEXT_AND_UI = 3.0;

describe('WCAG 2.2 AA — text on surfaces', () => {
  const textPairs: Array<[string, string, string]> = [
    ['text.primary on surface.page', text.primary, surface.page],
    ['text.primary on surface.card', text.primary, surface.card],
    ['text.primary on surface.cardSecondary', text.primary, surface.cardSecondary],
    ['text.secondary on surface.page', text.secondary, surface.page],
    ['text.secondary on surface.card', text.secondary, surface.card],
    ['text.muted on surface.card', text.muted, surface.card],
    ['text.onBrand on actionPrimary', text.onBrand, interactive.actionPrimary],
    ['text.onBrand on actionPrimaryHover', text.onBrand, interactive.actionPrimaryHover],
    ['text.onDark on purpleDeep', text.onDark, brand.purpleDeep],
    ['text.primary on lavenderPale', text.primary, brand.lavenderPale],
    ['text.primary on greenPale', text.primary, brand.greenPale],
    ['purplePrimary on surface.card', brand.purplePrimary, surface.card],
    ['purplePrimary on lavenderPale', brand.purplePrimary, brand.lavenderPale],
    ['greenMid on surface.card', brand.greenMid, surface.card],
  ];

  it.each(textPairs)('%s ≥ 4.5:1', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('WCAG 2.2 AA — semantic status foregrounds on their tints', () => {
  const tones = Object.entries(status);

  it.each(tones)('status.%s foreground on its background ≥ 4.5:1', (_tone, palette) => {
    expect(contrastRatio(palette.foreground, palette.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(tones)('status.%s foreground on white card ≥ 4.5:1', (_tone, palette) => {
    expect(contrastRatio(palette.foreground, surface.card)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('WCAG 2.2 AA — non-text UI contrast', () => {
  it('focus ring vs page background ≥ 3:1', () => {
    expect(contrastRatio(interactive.focusRing, surface.page)).toBeGreaterThanOrEqual(
      AA_LARGE_TEXT_AND_UI,
    );
  });

  it('focus ring vs white card ≥ 3:1', () => {
    expect(contrastRatio(interactive.focusRing, surface.card)).toBeGreaterThanOrEqual(
      AA_LARGE_TEXT_AND_UI,
    );
  });
});
