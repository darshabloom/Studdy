import { describe, expect, it } from 'vitest';
import { addMoney, CurrencyMismatchError, equalMoney, isZero, money, subtractMoney } from './money';

describe('money', () => {
  it('creates money from integer minor units', () => {
    const value = money(4500, 'NZD');
    expect(value.amountMinor).toBe(4500n);
    expect(value.currencyCode).toBe('NZD');
  });

  it('rejects non-integer amounts — floats are prohibited', () => {
    expect(() => money(45.5, 'NZD')).toThrow(TypeError);
  });

  it('rejects invalid currency codes', () => {
    expect(() => money(100, 'nz')).toThrow(TypeError);
    expect(() => money(100, 'NZDX')).toThrow(TypeError);
  });

  it('adds and subtracts amounts of the same currency', () => {
    const a = money(4500, 'NZD');
    const b = money(500, 'NZD');
    expect(addMoney(a, b).amountMinor).toBe(5000n);
    expect(subtractMoney(a, b).amountMinor).toBe(4000n);
  });

  it('refuses cross-currency arithmetic', () => {
    expect(() => addMoney(money(100, 'NZD'), money(100, 'AUD'))).toThrow(CurrencyMismatchError);
  });

  it('supports zero and equality checks', () => {
    expect(isZero(money(0, 'NZD'))).toBe(true);
    expect(equalMoney(money(100, 'NZD'), money(100, 'NZD'))).toBe(true);
    expect(equalMoney(money(100, 'NZD'), money(100, 'AUD'))).toBe(false);
  });
});
