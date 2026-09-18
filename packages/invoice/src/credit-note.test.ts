import { describe, it, expect } from 'vitest';
import { paise, type SellerGstConfig, type BuyerGstDetails } from '@gst-engine/core';
import { buildCreditNote } from './credit-note';
import { InMemoryInvoiceNumberProvider } from './numbering';
import type { InvoiceLineInput } from './model';

const seller: SellerGstConfig = {
  legalName: 'Rinstruments Pvt Ltd',
  gstin: '27AAPFU0939F1ZV',
  address: { line: 'Wagle Estate', city: 'Thane', state: 'Maharashtra', stateCode: '27' },
};
const buyer: BuyerGstDetails = {
  gstin: '27AAGCB7383J1Z4',
  legalName: 'Buyer Labs',
  address: { line: 'x', city: 'y', state: 'Maharashtra', stateCode: '27' },
  verificationStatus: 'ACTIVE',
};

const fullRefund: InvoiceLineInput[] = [
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

function cnNumbering() {
  return new InMemoryInvoiceNumberProvider({ prefix: 'CN' });
}

describe('buildCreditNote', () => {
  it('numbers with a separate CN series and classifies intra-state tax', async () => {
    const cn = await buildCreditNote(
      {
        orderId: 'o1',
        refundId: 'r1',
        originalInvoiceNumber: 'INV/2026-27/000001',
        reason: 'Damaged item',
        creditNoteDate: '2026-09-20T10:00:00.000Z',
        seller,
        buyer,
        placeOfSupplyStateCode: '27',
        lines: fullRefund,
      },
      cnNumbering(),
    );
    expect(cn.number).toBe('CN/2026-27/000001');
    expect(cn.cgstTotal).toBe(27000);
    expect(cn.sgstTotal).toBe(27000);
    expect(cn.igstTotal).toBe(0);
    expect(cn.grandTotal).toBe(354000);
    expect(cn.originalInvoiceNumber).toBe('INV/2026-27/000001');
    expect(cn.amountInWords).toContain('Rupees');
  });

  it('handles a partial refund (reduced amounts)', async () => {
    const partial: InvoiceLineInput[] = [
      {
        sku: 'A',
        name: 'pH Meter',
        hsnCode: '9027',
        quantity: 1,
        unitPrice: paise(150000),
        taxableAmount: paise(150000),
        taxCharged: paise(27000),
        gstRatePercent: 18,
      },
    ];
    const cn = await buildCreditNote(
      {
        orderId: 'o1',
        refundId: 'r2',
        originalInvoiceNumber: 'INV/2026-27/000001',
        reason: 'Partial return',
        seller,
        buyer,
        placeOfSupplyStateCode: '29',
        lines: partial,
      },
      cnNumbering(),
    );
    // inter-state → IGST
    expect(cn.igstTotal).toBe(27000);
    expect(cn.cgstTotal).toBe(0);
    expect(cn.grandTotal).toBe(177000);
  });
});
