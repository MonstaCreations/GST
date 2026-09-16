import { describe, it, expect } from 'vitest';
import { paise, type SellerGstConfig, type BuyerGstDetails } from '@gst-engine/core';
import { buildInvoice, computeTotals, buildInvoiceItem } from './compute';
import { InMemoryInvoiceNumberProvider } from './numbering';
import type { InvoiceLineInput } from './model';

const seller: SellerGstConfig = {
  legalName: 'Rinstruments Pvt Ltd',
  gstin: '27AAPFU0939F1ZV',
  address: {
    line: 'Plot 5, Wagle Estate',
    city: 'Thane',
    state: 'Maharashtra',
    stateCode: '27',
    pincode: '400604',
  },
};

function buyer(stateCode: string): BuyerGstDetails {
  return {
    gstin: `${stateCode}AAGCB7383J1Z4`,
    legalName: 'Buyer Labs Pvt Ltd',
    address: {
      line: '4 MG Road',
      city: 'Somewhere',
      state: 'Somewhere',
      stateCode,
    },
    verificationStatus: 'ACTIVE',
  };
}

const lines: InvoiceLineInput[] = [
  {
    sku: 'INSTR-1',
    name: 'pH Meter',
    hsnCode: '9027',
    quantity: 2,
    unitPrice: paise(150000),
    taxableAmount: paise(300000),
    taxCharged: paise(54000),
    gstRatePercent: 18,
  },
  {
    sku: 'INSTR-2',
    name: 'Test Probe',
    hsnCode: '9026',
    quantity: 1,
    unitPrice: paise(50000),
    taxableAmount: paise(50000),
    taxCharged: paise(9000),
    gstRatePercent: 18,
  },
];

describe('buildInvoiceItem', () => {
  it('classifies intra-state as CGST + SGST', () => {
    const item = buildInvoiceItem(lines[0]!, '27', '27');
    expect(item.tax).toEqual({ taxable: 300000, cgst: 27000, sgst: 27000, igst: 0 });
    expect(item.lineTotal).toBe(354000);
  });
  it('classifies inter-state as IGST', () => {
    const item = buildInvoiceItem(lines[0]!, '27', '29');
    expect(item.tax).toEqual({ taxable: 300000, cgst: 0, sgst: 0, igst: 54000 });
  });
});

describe('computeTotals', () => {
  it('reconciles grandTotal to taxable + all taxes', () => {
    const items = lines.map((l) => buildInvoiceItem(l, '27', '27'));
    const t = computeTotals(items);
    expect(t.subtotal).toBe(350000);
    expect(t.taxableTotal).toBe(350000);
    expect(t.cgstTotal).toBe(31500);
    expect(t.sgstTotal).toBe(31500);
    expect(t.igstTotal).toBe(0);
    expect(t.grandTotal).toBe(413000);
    expect(t.grandTotal).toBe(t.taxableTotal + t.cgstTotal + t.sgstTotal + t.igstTotal);
  });
});

describe('buildInvoice', () => {
  it('assembles a numbered intra-state invoice with words', async () => {
    const numbering = new InMemoryInvoiceNumberProvider();
    const invoice = await buildInvoice(
      {
        orderId: 'gid://shopify/Order/1',
        date: '2026-09-16T10:00:00.000Z',
        seller,
        buyer: buyer('27'),
        placeOfSupplyStateCode: '27',
        lines,
      },
      numbering,
    );
    expect(invoice.number).toBe('INV/2026-27/000001');
    expect(invoice.grandTotal).toBe(413000);
    expect(invoice.cgstTotal).toBe(31500);
    expect(invoice.igstTotal).toBe(0);
    expect(invoice.amountInWords).toBe('Rupees Four Thousand One Hundred Thirty Only');
    expect(invoice.status).toBe('issued');
    expect(invoice.items).toHaveLength(2);
  });

  it('assembles an inter-state invoice using IGST', async () => {
    const numbering = new InMemoryInvoiceNumberProvider();
    const invoice = await buildInvoice(
      {
        orderId: 'gid://shopify/Order/2',
        date: '2026-09-16T10:00:00.000Z',
        seller,
        buyer: buyer('29'),
        placeOfSupplyStateCode: '29',
        lines,
      },
      numbering,
    );
    expect(invoice.igstTotal).toBe(63000);
    expect(invoice.cgstTotal).toBe(0);
    expect(invoice.grandTotal).toBe(413000);
  });
});
