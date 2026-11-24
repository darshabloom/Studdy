import { describe, expect, it } from 'vitest';
import { safeAuthNext } from './safe-next';

describe('safeAuthNext', () => {
  it('keeps valid local destinations', () => {
    expect(safeAuthNext('/parent/bookings?tab=upcoming')).toBe('/parent/bookings?tab=upcoming');
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/parent\nother',
  ])('rejects external or malformed redirects', (input) => {
    expect(safeAuthNext(input)).toBe('/workspace');
  });
});
