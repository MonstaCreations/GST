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

/** One order line, as resolved from Shopify (taxable + charged tax come from the order). */
export interface InvoiceLineInput {
  sku: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unitPrice: Paise;
  taxableAmount: Paise;
  taxCharged: Paise;
  gstRatePercent: number;
}

export interface BuildInvoiceInput {
  orderId: string;
  /** ISO timestamp; defaults to now. Determines the financial-year series. */
  date?: Iso8601;
  seller: SellerGstConfig;
  buyer: BuyerGstDetails;
  placeOfSupplyStateCode: string;
  lines: InvoiceLineInput[];
}
