import { describe, it, expect } from 'vitest';
import {
  paise,
  rupeesToPaise,
  paiseToRupees,
  addPaise,
  subPaise,
  sumPaise,
  mulPaise,
  percentagePaise,
  splitTaxHalf,
} from './money';

describe('rupeesToPaise', () => {
  it('parses two-decimal strings exactly', () => {
    expect(rupeesToPaise('1234.56')).toBe(123456);
  });
  it('pads a single decimal', () => {
    expect(rupeesToPaise('1234.5')).toBe(123450);
  });
  it('handles whole rupees', () => {
    expect(rupeesToPaise('1234')).toBe(123400);
  });
  it('rounds half-up on the third decimal', () => {
    expect(rupeesToPaise('0.005')).toBe(1);
    expect(rupeesToPaise('0.004')).toBe(0);
  });
  it('accepts numbers', () => {
    expect(rupeesToPaise(1234.56)).toBe(123456);
  });
  it('is decimal-safe (0.1 + 0.2 === 0.3)', () => {
    const sum = addPaise(rupeesToPaise('0.1'), rupeesToPaise('0.2'));
    expect(sum).toBe(rupeesToPaise('0.3'));
  });
  it('rejects garbage', () => {
    expect(() => rupeesToPaise('abc')).toThrow(/invalid rupee amount/);
  });
});

describe('paiseToRupees', () => {
  it('formats with two decimals', () => {
    expect(paiseToRupees(paise(123456))).toBe('1234.56');
    expect(paiseToRupees(paise(5))).toBe('0.05');
    expect(paiseToRupees(paise(-123456))).toBe('-1234.56');
  });
});

describe('arithmetic', () => {
  it('adds, subtracts, and sums', () => {
    expect(addPaise(paise(100), paise(250))).toBe(350);
    expect(subPaise(paise(350), paise(100))).toBe(250);
    expect(sumPaise([paise(100), paise(200), paise(300)])).toBe(600);
  });
  it('multiplies by quantity', () => {
    expect(mulPaise(paise(1500), 3)).toBe(4500);
  });
  it('takes a percentage', () => {
    expect(percentagePaise(paise(10000), 18)).toBe(1800);
  });
  it('rejects non-integer paise', () => {
    expect(() => paise(1.5)).toThrow(/integer/);
  });
});

describe('splitTaxHalf', () => {
  it('splits evenly', () => {
    expect(splitTaxHalf(paise(1800))).toEqual([900, 900]);
  });
  it('gives the remainder to the second half and sums exactly', () => {
    const [a, b] = splitTaxHalf(paise(101));
    expect([a, b]).toEqual([50, 51]);
    expect(a + b).toBe(101);
  });
});
