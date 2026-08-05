/**
 * Spacing scale (doc 01 §7.2): 4, 8, 12, 16, 24, 32, 48, 64, 96 px.
 * Semantic tokens are required at call sites rather than raw values.
 */
export const spaceScale = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px',
  7: '48px',
  8: '64px',
  9: '96px',
} as const;

export const semanticSpace = {
  controlGap: spaceScale[2],
  fieldGap: spaceScale[4],
  cardPadding: spaceScale[5],
  sectionGap: spaceScale[6],
  /** Public page sections (64px). */
  publicSection: spaceScale[8],
  /** Major marketing separation (96px). */
  marketingSeparation: spaceScale[9],
} as const;
