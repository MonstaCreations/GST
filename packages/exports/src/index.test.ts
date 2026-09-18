import { describe, it, expect } from 'vitest';
import { tableToCsv, toCsv, toTallyCsv } from './index';
import type { ReportTable } from '@gst-engine/reports';

const table: ReportTable = {
  columns: ['Invoice', 'Amount', 'Note'],
  rows: [
    ['INV/2026-27/000001', '4130.00', 'ok'],
    ['INV/2026-27/000002', '900.00', 'has, comma'],
  ],
};

describe('CSV export', () => {
  it('escapes cells containing commas', () => {
    const csv = tableToCsv(table);
    expect(csv).toContain('"has, comma"');
    expect(csv.split('\r\n')[0]).toBe('Invoice,Amount,Note');
  });

  it('produces a text/csv file with the right extension', () => {
    const file = toCsv(table, 'sales-register');
    expect(file.filename).toBe('sales-register.csv');
    expect(file.contentType).toContain('text/csv');
    expect(new TextDecoder().decode(file.content)).toContain('INV/2026-27/000001');
  });
});

describe('Tally CSV export', () => {
  it('remaps columns per the provided mapping', () => {
    const file = toTallyCsv(table, 'tally', [
      { source: 'Invoice', target: 'Voucher No' },
      { source: 'Amount', target: 'Debit' },
    ]);
    const text = new TextDecoder().decode(file.content);
    expect(text.split('\r\n')[0]).toBe('Voucher No,Debit');
    expect(text).toContain('4130.00');
    expect(text).not.toContain('Note');
  });
});
