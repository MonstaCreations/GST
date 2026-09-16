/**
 * @gst-engine/invoice — invoice model, math, and numbering contract.
 * Phase 0: models + interface + stubs. Real logic in M5.
 */
import type { Iso8601, Paise, BuyerGstDetails, SellerGstConfig } from '@gst-engine/core';
import type { TaxBreakup } from '@gst-engine/tax';

export interface InvoiceItem {
  sku: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unitPrice: Paise;
  gstRatePercent: number;
  tax: TaxBreakup;
  lineTotal: Paise;
}

export type InvoiceStatus = 'pending' | 'issued' | 'emailed' | 'failed';

export interface Invoice {
  number: string; // e.g. INV/2026-27/000001
  date: Iso8601;
  orderId: string;
  placeOfSupplyStateCode: string;
  seller: SellerGstConfig;
  buyer: BuyerGstDetails;
  items: InvoiceItem[];
  subtotal: Paise;
  taxableTotal: Paise;
  cgstTotal: Paise;
  sgstTotal: Paise;
  igstTotal: Paise;
  grandTotal: Paise;
  amountInWords: string;
  status: InvoiceStatus;
}

/**
 * Invoice numbering behind an interface (DECISIONS.md D4). Phase 1 impl is an
 * app-installation metafield counter, called only by the single-concurrency
 * cron reconciler (D3) so allocation is serialized.
 */
export interface InvoiceNumberProvider {
  /** Allocate the next number for a financial-year series, atomically w.r.t. the caller. */
  next(financialYear: string): Promise<string>;
}

export interface BuildInvoiceInput {
  orderId: string;
  seller: SellerGstConfig;
  buyer: BuyerGstDetails;
  // order lines + tax_lines from Shopify, resolved HSN/rate, etc. — shaped in M5.
}

/** TODO(M5): assemble a fully-computed Invoice from order + seller/buyer data. */
export declare function buildInvoice(
  input: BuildInvoiceInput,
  numbering: InvoiceNumberProvider,
): Promise<Invoice>;
