import { describe, it, expect } from 'vitest';
import { financialYear, InMemoryInvoiceNumberProvider } from './numbering';

describe('financialYear', () => {
  it('starts the year in April', () => {
    expect(financialYear(new Date(2026, 8, 16))).toBe('2026-27'); // September
    expect(financialYear(new Date(2026, 3, 1))).toBe('2026-27'); // 1 April
    expect(financialYear(new Date(2026, 2, 31))).toBe('2025-26'); // 31 March
    expect(financialYear(new Date(2026, 0, 10))).toBe('2025-26'); // January
  });
});

describe('InMemoryInvoiceNumberProvider', () => {
  it('formats numbers with prefix, FY, and zero-padding', async () => {
    const provider = new InMemoryInvoiceNumberProvider();
    expect(await provider.next('2026-27')).toBe('INV/2026-27/000001');
    expect(await provider.next('2026-27')).toBe('INV/2026-27/000002');
  });

  it('honors custom prefix, padding, and start', async () => {
    const provider = new InMemoryInvoiceNumberProvider({ prefix: 'RIN', pad: 4, start: 100 });
    expect(await provider.next('2026-27')).toBe('RIN/2026-27/0100');
  });

  it('keeps separate series per financial year', async () => {
    const provider = new InMemoryInvoiceNumberProvider();
    expect(await provider.next('2025-26')).toBe('INV/2025-26/000001');
    expect(await provider.next('2026-27')).toBe('INV/2026-27/000001');
    expect(await provider.next('2025-26')).toBe('INV/2025-26/000002');
  });

  it('allocates unique, gap-free numbers under concurrent access', async () => {
    const provider = new InMemoryInvoiceNumberProvider();
    const numbers = await Promise.all(Array.from({ length: 100 }, () => provider.next('2026-27')));
    const unique = new Set(numbers);
    expect(unique.size).toBe(100);
    const seqs = numbers.map((n) => Number(n.split('/')[2])).sort((a, b) => a - b);
    expect(seqs[0]).toBe(1);
    expect(seqs[99]).toBe(100);
    for (let i = 0; i < seqs.length; i++) {
      expect(seqs[i]).toBe(i + 1); // no gaps
    }
  });
});
