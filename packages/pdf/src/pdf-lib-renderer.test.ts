import { describe, it, expect } from 'vitest';
import { paise, type SellerGstConfig, type BuyerGstDetails } from '@gst-engine/core';
import {
  buildInvoice,
  InMemoryInvoiceNumberProvider,
  type InvoiceLineInput,
} from '@gst-engine/invoice';
import { PdfLibRenderer } from './pdf-lib-renderer';

const seller: SellerGstConfig = {
  legalName: 'Rinstruments Pvt Ltd',
  gstin: '27AAPFU0939F1ZV',
  address: {
    line: 'Wagle Estate',
    city: 'Thane',
    state: 'Maharashtra',
    stateCode: '27',
    pincode: '400604',
  },
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
  {
    sku: 'B',
    name: 'Calibration Probe',
    hsnCode: '9026',
    quantity: 1,
    unitPrice: paise(50000),
    taxableAmount: paise(50000),
    taxCharged: paise(9000),
    gstRatePercent: 18,
  },
];

async function sample() {
  return buildInvoice(
    {
      orderId: 'gid://shopify/Order/1',
      date: '2026-09-16T10:00:00.000Z',
      seller,
      buyer,
      placeOfSupplyStateCode: '27',
      lines,
    },
    new InMemoryInvoiceNumberProvider(),
  );
}

describe('PdfLibRenderer', () => {
  it('renders a valid PDF byte buffer', async () => {
    const invoice = await sample();
    const bytes = await new PdfLibRenderer().renderInvoice(invoice, {
      copyLabel: 'ORIGINAL FOR RECIPIENT',
      bank: { name: 'HDFC Bank', account: '000111222', ifsc: 'HDFC0000123', branch: 'Thane' },
    });
    expect(bytes.length).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('does not throw on inter-state (IGST) invoices', async () => {
    const invoice = await buildInvoice(
      {
        orderId: 'o2',
        date: '2026-09-16T10:00:00.000Z',
        seller,
        buyer: { ...buyer, address: { ...buyer.address, stateCode: '29', state: 'Karnataka' } },
        placeOfSupplyStateCode: '29',
        lines,
      },
      new InMemoryInvoiceNumberProvider(),
    );
    const bytes = await new PdfLibRenderer().renderInvoice(invoice);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });
});
