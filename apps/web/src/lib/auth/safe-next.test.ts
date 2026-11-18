import { describe, expect, it } from 'vitest';
import { safeAuthNext } from './safe-next';

describe('safeAuthNext', () => {
  it('returns workspace for absent, external or ambiguous destinations', () => {
    for (const candidate of [
      null,
      undefined,
      '',
      'https://outside.test',
      '//outside.test',
      '/\\outside.test',
      '/\\\\outside.test',
      'javascript:alert(1)',
    ]) {
      expect(safeAuthNext(candidate)).toBe('/workspace');
    }
  });

  it('retains same-origin workspace destinations and their query strings', () => {
    expect(safeAuthNext('/tutor/calendar?show=lessons')).toBe(
      '/tutor/calendar?show=lessons',
    );
    expect(safeAuthNext('/parent')).toBe('/parent');
  });
});
