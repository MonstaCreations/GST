/**
 * Credit note domain — reuses the invoice tax classification + totals so a credit
 * note is computed exactly like an invoice, against the refunded lines. The original
 * invoice stays immutable; a credit note is a separate document.
 */
import {
  amountInWords,
  type Iso8601,
  type Paise,
  type BuyerGstDetails,
  type SellerGstConfig,
} from '@gst-engine/core';
import type { InvoiceItem, InvoiceLineInput } from './model';
import { buildInvoiceItem, computeTotals } from './compute';
import { financialYear, type InvoiceNumberProvider } from './numbering';

export interface BuildCreditNoteInput {
  /** ISO timestamp; defaults to now. */
  creditNoteDate?: Iso8601;
  orderId: string;
  /** Shopify refund id — used for idempotency by the app layer. */
  refundId: string;
  originalInvoiceNumber: string;
  reason: string;
  seller: SellerGstConfig;
  buyer: BuyerGstDetails;
  placeOfSupplyStateCode: string;
  /** Refunded lines: taxableAmount + taxCharged are the refunded amounts. */
  lines: InvoiceLineInput[];
}

export interface CreditNote {
  number: string; // e.g. CN/2026-27/000001
  date: Iso8601;
  orderId: string;
  refundId: string;
  originalInvoiceNumber: string;
  reason: string;
  seller: SellerGstConfig;
  buyer: BuyerGstDetails;
  placeOfSupplyStateCode: string;
  items: InvoiceItem[];
  subtotal: Paise;
  taxableTotal: Paise;
  cgstTotal: Paise;
  sgstTotal: Paise;
  igstTotal: Paise;
  grandTotal: Paise;
  amountInWords: string;
}

/**
 * Build a numbered credit note from refunded lines. Pass an InvoiceNumberProvider
 * configured with a separate series (e.g. prefix "CN") to keep credit-note numbering
 * independent of invoice numbering.
 */
export async function buildCreditNote(
  input: BuildCreditNoteInput,
  numbering: InvoiceNumberProvider,
): Promise<CreditNote> {
  const date = input.creditNoteDate ?? new Date().toISOString();
  const sellerStateCode = input.seller.address.stateCode;
  const items = input.lines.map((line) =>
    buildInvoiceItem(line, sellerStateCode, input.placeOfSupplyStateCode),
  );
  const totals = computeTotals(items);
  const number = await numbering.next(financialYear(new Date(date)));

  return {
    number,
    date,
    orderId: input.orderId,
    refundId: input.refundId,
    originalInvoiceNumber: input.originalInvoiceNumber,
    reason: input.reason,
    seller: input.seller,
    buyer: input.buyer,
    placeOfSupplyStateCode: input.placeOfSupplyStateCode,
    items,
    ...totals,
    amountInWords: amountInWords(totals.grandTotal),
  };
}
