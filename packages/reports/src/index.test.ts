import { describe, it, expect, beforeAll } from 'vitest';
import { paise, type SellerGstConfig, type BuyerGstDetails } from '@gst-engine/core';
import {
  buildInvoice,
  InMemoryInvoiceNumberProvider,
  type Invoice,
  type InvoiceLineInput,
} from '@gst-engine/invoice';
import { salesRegister, taxSummary, gstr1, gstr3bSummary } from './index';

const seller: SellerGstConfig = {
  legalName: 'Rinstruments Pvt Ltd',
  gstin: '27AAPFU0939F1ZV',
  address: { line: 'Wagle Estate', city: 'Thane', state: 'Maharashtra', stateCode: '27' },
};

function buyer(stateCode: string): BuyerGstDetails {
  return {
    gstin: `${stateCode}AAGCB7383J1Z4`,
    legalName: `Buyer ${stateCode}`,
    address: { line: 'x', city: 'y', state: 'z', stateCode },
    verificationStatus: 'ACTIVE',
  };
}

const lines18: InvoiceLineInput[] = [
  {
    sku: 'A',
    name: 'pH Meter',
    hsnCode: '9027',
    quantity: 2,
    unitPrice: paise(150000),
    taxableAmount: paise(300000),
    taxCharged: paise(54000),
    gstRatePercent: 18,
  },
  {
    sku: 'B',
    name: 'Probe',
    hsnCode: '9026',
    quantity: 1,
    unitPrice: paise(50000),
    taxableAmount: paise(50000),
    taxCharged: paise(9000),
    gstRatePercent: 18,
  },
];
const lines12: InvoiceLineInput[] = [
  {
    sku: 'C',
    name: 'Reagent',
    hsnCode: '3822',
    quantity: 1,
    unitPrice: paise(100000),
    taxableAmount: paise(100000),
    taxCharged: paise(12000),
    gstRatePercent: 12,
  },
];

let invoices: Invoice[];
const filter = { fromDate: '2026-09-01', toDate: '2026-09-30' };

beforeAll(async () => {
  const numbering = new InMemoryInvoiceNumberProvider();
  const intra = await buildInvoice(
    {
      orderId: 'o1',
      date: '2026-09-16T10:00:00.000Z',
      seller,
      buyer: buyer('27'),
      placeOfSupplyStateCode: '27',
      lines: lines18,
    },
    numbering,
  );
  const inter = await buildInvoice(
    {
      orderId: 'o2',
      date: '2026-09-20T10:00:00.000Z',
      seller,
      buyer: buyer('29'),
      placeOfSupplyStateCode: '29',
      lines: lines12,
    },
    numbering,
  );
  invoices = [intra, inter];
});

describe('salesRegister', () => {
  it('lists invoices with a TOTAL row', () => {
    const t = salesRegister(invoices, filter);
    expect(t.rows).toHaveLength(3); // 2 invoices + TOTAL
    const total = t.rows[2]!;
    expect(total[0]).toBe('TOTAL');
    expect(total[10]).toBe('5250.00'); // 4130.00 + 1120.00
  });
  it('respects the date filter', () => {
    const t = salesRegister(invoices, { fromDate: '2026-09-01', toDate: '2026-09-18' });
    expect(t.rows).toHaveLength(2); // only the 16th invoice + TOTAL
  });
});

describe('taxSummary', () => {
  it('groups by rate', () => {
    const t = taxSummary(invoices, filter);
    const rate18 = t.rows.find((r) => r[0] === 18)!;
    const rate12 = t.rows.find((r) => r[0] === 12)!;
    expect(rate18.slice(1)).toEqual(['3500.00', '315.00', '315.00', '0.00', '630.00']);
    expect(rate12.slice(1)).toEqual(['1000.00', '0.00', '0.00', '120.00', '120.00']);
  });
});

describe('gstr1', () => {
  it('emits one row per invoice+rate', () => {
    const t = gstr1(invoices, filter);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]![0]).toBe('27AAGCB7383J1Z4');
  });
});

describe('gstr3bSummary', () => {
  it('summarizes outward supplies', () => {
    const t = gstr3bSummary(invoices, filter);
    expect(t.rows[0]!.slice(1)).toEqual(['4500.00', '120.00', '315.00', '315.00']);
  });
});
