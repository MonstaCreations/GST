/**
 * Amount in words using the Indian numbering system (thousand / lakh / crore).
 * Produces the wording expected on Indian GST invoices.
 */
import type { Paise } from './money';

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const tens = TENS[Math.floor(n / 10)] ?? '';
  const ones = ONES[n % 10] ?? '';
  return ones ? `${tens} ${ones}` : tens;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(belowHundred(rest));
  return parts.join(' ');
}

/** Convert a non-negative integer to Indian-system words. */
export function numberToIndianWords(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const below = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  if (below) parts.push(belowThousand(below));
  return parts.join(' ');
}

/** e.g. 123456 paise → "Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only". */
export function amountInWords(amount: Paise): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs / 100);
  const paiseRemainder = abs % 100;

  let words = `Rupees ${numberToIndianWords(rupees)}`;
  if (paiseRemainder > 0) {
    words += ` and ${belowHundred(paiseRemainder)} Paise`;
  }
  words += ' Only';
  return negative ? `Minus ${words}` : words;
}
