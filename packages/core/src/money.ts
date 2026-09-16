/**
 * Money — decimal-safe. All monetary amounts are integer **paise** (100 = ₹1) to
 * avoid floating-point drift. Construct with `paise()` / `rupeesToPaise()` and do
 * arithmetic only with the helpers here.
 */
import { ValidationError } from '@gst-engine/shared';

/** A monetary amount in integer paise (100 paise = ₹1). */
export type Paise = number & { readonly __brand: 'Paise' };

/** Brand an integer as Paise (throws on non-integers). */
export function paise(value: number): Paise {
  if (!Number.isInteger(value)) {
    throw new ValidationError(`paise must be an integer, got ${value}`);
  }
  return value as Paise;
}

export const ZERO_PAISE = 0 as Paise;

/**
 * Convert a rupee amount to paise. Strings are parsed digit-by-digit (no float
 * multiplication) and rounded half-up on the third decimal; numbers are rounded.
 */
export function rupeesToPaise(rupees: number | string): Paise {
  if (typeof rupees === 'number') {
    if (!Number.isFinite(rupees)) {
      throw new ValidationError(`invalid rupee amount: ${rupees}`);
    }
    return Math.round(rupees * 100) as Paise;
  }

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(rupees.trim());
  if (!match) {
    throw new ValidationError(`invalid rupee amount: "${rupees}"`);
  }
  const [, signStr = '', wholeStr = '', fracStr = ''] = match;
  const sign = signStr === '-' ? -1 : 1;
  const frac2 = fracStr.slice(0, 2).padEnd(2, '0');
  let value = Number(wholeStr) * 100 + Number(frac2);
  const thirdDigit = fracStr.charAt(2);
  if (thirdDigit !== '' && Number(thirdDigit) >= 5) {
    value += 1; // round half-up
  }
  return (sign * value) as Paise;
}

/** Format paise as a plain rupee string with two decimals (e.g. "1234.56"). */
export function paiseToRupees(amount: Paise): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${negative ? '-' : ''}${rupees}.${remainder.toString().padStart(2, '0')}`;
}

export function addPaise(...amounts: Paise[]): Paise {
  return amounts.reduce((total, x) => total + x, 0) as Paise;
}

export function subPaise(a: Paise, b: Paise): Paise {
  return (a - b) as Paise;
}

export function sumPaise(amounts: readonly Paise[]): Paise {
  return amounts.reduce((total, x) => total + x, 0) as Paise;
}

/** Multiply a unit amount by a quantity, rounding to whole paise. */
export function mulPaise(unit: Paise, quantity: number): Paise {
  return Math.round(unit * quantity) as Paise;
}

/** `percent`% of a base amount, rounded to whole paise. */
export function percentagePaise(base: Paise, percent: number): Paise {
  return Math.round((base * percent) / 100) as Paise;
}

/**
 * Split a total into two halves that sum exactly to the total (used for CGST/SGST).
 * The remainder paise, if any, goes to the second half.
 */
export function splitTaxHalf(total: Paise): [Paise, Paise] {
  const first = Math.floor(total / 2);
  const second = total - first;
  return [first as Paise, second as Paise];
}
