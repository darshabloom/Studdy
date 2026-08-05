/**
 * Money — integer minor units plus an ISO 4217 currency code.
 * Floats are prohibited for money (Database spec §3).
 */
export interface Money {
  readonly amountMinor: bigint;
  readonly currencyCode: string;
}

export class CurrencyMismatchError extends Error {
  override name = 'CurrencyMismatchError';
  constructor(a: string, b: string) {
    super(`Currency mismatch: ${a} vs ${b}`);
  }
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function money(amountMinor: bigint | number, currencyCode: string): Money {
  if (!CURRENCY_PATTERN.test(currencyCode)) {
    throw new TypeError(`Invalid ISO 4217 currency code: ${JSON.stringify(currencyCode)}`);
  }
  if (typeof amountMinor === 'number' && !Number.isSafeInteger(amountMinor)) {
    throw new TypeError('Money amounts must be integers in minor units — never floats.');
  }
  return { amountMinor: BigInt(amountMinor), currencyCode };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currencyCode !== b.currencyCode)
    throw new CurrencyMismatchError(a.currencyCode, b.currencyCode);
  return { amountMinor: a.amountMinor + b.amountMinor, currencyCode: a.currencyCode };
}

export function subtractMoney(a: Money, b: Money): Money {
  if (a.currencyCode !== b.currencyCode)
    throw new CurrencyMismatchError(a.currencyCode, b.currencyCode);
  return { amountMinor: a.amountMinor - b.amountMinor, currencyCode: a.currencyCode };
}

export function isZero(value: Money): boolean {
  return value.amountMinor === 0n;
}

export function equalMoney(a: Money, b: Money): boolean {
  return a.currencyCode === b.currencyCode && a.amountMinor === b.amountMinor;
}
