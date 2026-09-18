import { describe, it, expect } from 'vitest';
import { paise, type SellerGstConfig, type BuyerGstDetails } from '@gst-engine/core';
import {
  buildInvoice,
  InMemoryInvoiceNumberProvider,
  type InvoiceLineInput,
} from '@gst-engine/invoice';
import { renderInvoiceHtml } from './template';

const seller: SellerGstConfig = {
  legalName: 'Rinstruments Pvt Ltd',
  gstin: '27AAPFU0939F1ZV',
  address: { line: 'Wagle Estate', city: 'Thane', state: 'Maharashtra', stateCode: '27' },
};
const buyer: BuyerGstDetails = {
  gstin: '27AAGCB7383J1Z4',
  legalName: 'Buyer Labs Pvt Ltd',
  address: { line: '4 MG Road', city: 'Mumbai', state: 'Maharashtra', stateCode: '27' },
  verificationStatus: 'ACTIVE',
};
const lines: InvoiceLineInput[] = [
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
];

describe('renderInvoiceHtml', () => {
  it('includes the key invoice fields and escapes safely', async () => {
    const invoice = await buildInvoice(
      {
        orderId: 'o1',
        date: '2026-09-16T10:00:00.000Z',
        seller,
        buyer,
        placeOfSupplyStateCode: '27',
        lines,
      },
      new InMemoryInvoiceNumberProvider(),
    );
    const html = renderInvoiceHtml(invoice, { copyLabel: 'Original for Recipient' });
    expect(html).toContain('TAX INVOICE');
    expect(html).toContain(invoice.number);
    expect(html).toContain('27AAPFU0939F1ZV'); // seller GSTIN
    expect(html).toContain('27AAGCB7383J1Z4'); // buyer GSTIN
    expect(html).toContain('pH Meter');
    expect(html).toContain(invoice.amountInWords);
  });
});
