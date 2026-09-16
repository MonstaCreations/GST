/**
 * Invoice assembly and totals — pure functions over resolved order data.
 */
import { addPaise, sumPaise, mulPaise, amountInWords, type Paise } from '@gst-engine/core';
import { classifyTax } from '@gst-engine/tax';
import type { BuildInvoiceInput, Invoice, InvoiceItem, InvoiceLineInput } from './model';
import { financialYear, type InvoiceNumberProvider } from './numbering';

export function buildInvoiceItem(
  line: InvoiceLineInput,
  sellerStateCode: string,
  placeOfSupplyStateCode: string,
): InvoiceItem {
  const tax = classifyTax({
    taxable: line.taxableAmount,
    taxCharged: line.taxCharged,
    gstRatePercent: line.gstRatePercent,
    sellerStateCode,
    placeOfSupplyStateCode,
  });
  return {
    sku: line.sku,
    name: line.name,
    hsnCode: line.hsnCode,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    gstRatePercent: line.gstRatePercent,
    tax,
    lineTotal: addPaise(line.taxableAmount, line.taxCharged),
  };
}

export interface InvoiceTotals {
  subtotal: Paise;
  taxableTotal: Paise;
  cgstTotal: Paise;
  sgstTotal: Paise;
  igstTotal: Paise;
  grandTotal: Paise;
}

export function computeTotals(items: readonly InvoiceItem[]): InvoiceTotals {
  const subtotal = sumPaise(items.map((i) => mulPaise(i.unitPrice, i.quantity)));
  const taxableTotal = sumPaise(items.map((i) => i.tax.taxable));
  const cgstTotal = sumPaise(items.map((i) => i.tax.cgst));
  const sgstTotal = sumPaise(items.map((i) => i.tax.sgst));
  const igstTotal = sumPaise(items.map((i) => i.tax.igst));
  const grandTotal = addPaise(taxableTotal, cgstTotal, sgstTotal, igstTotal);
  return { subtotal, taxableTotal, cgstTotal, sgstTotal, igstTotal, grandTotal };
}

/** Assemble a fully-computed, numbered invoice from resolved order data. */
export async function buildInvoice(
  input: BuildInvoiceInput,
  numbering: InvoiceNumberProvider,
): Promise<Invoice> {
  const date = input.date ?? new Date().toISOString();
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
    placeOfSupplyStateCode: input.placeOfSupplyStateCode,
    seller: input.seller,
    buyer: input.buyer,
    items,
    ...totals,
    amountInWords: amountInWords(totals.grandTotal),
    status: 'issued',
  };
}
