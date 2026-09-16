import { describe, it, expect } from 'vitest';
import { amountInWords, numberToIndianWords } from './amount-in-words';
import { paise } from './money';

describe('numberToIndianWords', () => {
  it('handles zero and small numbers', () => {
    expect(numberToIndianWords(0)).toBe('Zero');
    expect(numberToIndianWords(19)).toBe('Nineteen');
    expect(numberToIndianWords(234)).toBe('Two Hundred Thirty Four');
  });
  it('uses the Indian grouping (thousand / lakh / crore)', () => {
    expect(numberToIndianWords(1000)).toBe('One Thousand');
    expect(numberToIndianWords(100000)).toBe('One Lakh');
    expect(numberToIndianWords(10000000)).toBe('One Crore');
    expect(numberToIndianWords(45500)).toBe('Forty Five Thousand Five Hundred');
  });
});

describe('amountInWords', () => {
  it('renders rupees and paise', () => {
    expect(amountInWords(paise(123456))).toBe(
      'Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only',
    );
  });
  it('omits paise when zero', () => {
    expect(amountInWords(paise(100000))).toBe('Rupees One Thousand Only');
  });
  it('handles zero', () => {
    expect(amountInWords(paise(0))).toBe('Rupees Zero Only');
  });
});
