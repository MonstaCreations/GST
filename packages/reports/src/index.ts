/**
 * @gst-engine/reports — GST report datasets (pure compute; no I/O).
 * Consumes Invoice rows (sourced via Shopify by apps/shopify) and returns tables.
 * These are reporting aids, NOT government filings (see docs/DECISIONS.md).
 */
import { paiseToRupees, type Paise } from '@gst-engine/core';
import type { Invoice, InvoiceItem } from '@gst-engine/invoice';

export interface ReportFilter {
  /** inclusive, YYYY-MM-DD */
  fromDate: string;
  /** inclusive, YYYY-MM-DD */
  toDate: string;
  stateCode?: string;
  gstin?: string;
  gstRatePercent?: number;
  hsnCode?: string;
}

export interface ReportTable {
  columns: string[];
  rows: (string | number)[][];
}

const rupees = (paise: number): string => paiseToRupees(paise as Paise);

function inRange(dateIso: string, from: string, to: string): boolean {
  const day = dateIso.slice(0, 10);
  return day >= from && day <= to;
}

function filterInvoices(invoices: readonly Invoice[], f: ReportFilter): Invoice[] {
  return invoices.filter(
    (inv) =>
      inRange(inv.date, f.fromDate, f.toDate) &&
      (!f.gstin || inv.buyer.gstin === f.gstin) &&
      (!f.stateCode || inv.placeOfSupplyStateCode === f.stateCode),
  );
}

function matchesLine(item: InvoiceItem, f: ReportFilter): boolean {
  return (
    (f.gstRatePercent === undefined || item.gstRatePercent === f.gstRatePercent) &&
    (f.hsnCode === undefined || item.hsnCode === f.hsnCode)
  );
}

/** One row per invoice + a TOTAL row. */
export function salesRegister(invoices: readonly Invoice[], filter: ReportFilter): ReportTable {
  const rows: (string | number)[][] = [];
  let tTaxable = 0,
    tCgst = 0,
    tSgst = 0,
    tIgst = 0,
    tGrand = 0;

  for (const inv of filterInvoices(invoices, filter)) {
    tTaxable += inv.taxableTotal;
    tCgst += inv.cgstTotal;
    tSgst += inv.sgstTotal;
    tIgst += inv.igstTotal;
    tGrand += inv.grandTotal;
    rows.push([
      inv.number,
      inv.date.slice(0, 10),
      inv.orderId,
      inv.buyer.gstin,
      inv.buyer.legalName,
      inv.placeOfSupplyStateCode,
      rupees(inv.taxableTotal),
      rupees(inv.cgstTotal),
      rupees(inv.sgstTotal),
      rupees(inv.igstTotal),
      rupees(inv.grandTotal),
    ]);
  }

  rows.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    rupees(tTaxable),
    rupees(tCgst),
    rupees(tSgst),
    rupees(tIgst),
    rupees(tGrand),
  ]);

  return {
    columns: [
      'Invoice No',
      'Date',
      'Order',
      'Buyer GSTIN',
      'Legal Name',
      'Place of Supply',
      'Taxable',
      'CGST',
      'SGST',
      'IGST',
      'Grand Total',
    ],
    rows,
  };
}

interface RateAcc {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/** Grouped by GST rate across all matching invoice lines. */
export function taxSummary(invoices: readonly Invoice[], filter: ReportFilter): ReportTable {
  const byRate = new Map<number, RateAcc>();
  for (const inv of filterInvoices(invoices, filter)) {
    for (const item of inv.items) {
      if (!matchesLine(item, filter)) continue;
      const acc = byRate.get(item.gstRatePercent) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      acc.taxable += item.tax.taxable;
      acc.cgst += item.tax.cgst;
      acc.sgst += item.tax.sgst;
      acc.igst += item.tax.igst;
      byRate.set(item.gstRatePercent, acc);
    }
  }

  const rows: (string | number)[][] = [];
  let tTaxable = 0,
    tCgst = 0,
    tSgst = 0,
    tIgst = 0;
  for (const [rate, acc] of Array.from(byRate.entries()).sort((a, b) => a[0] - b[0])) {
    tTaxable += acc.taxable;
    tCgst += acc.cgst;
    tSgst += acc.sgst;
    tIgst += acc.igst;
    rows.push([
      rate,
      rupees(acc.taxable),
      rupees(acc.cgst),
      rupees(acc.sgst),
      rupees(acc.igst),
      rupees(acc.cgst + acc.sgst + acc.igst),
    ]);
  }
  rows.push([
    'TOTAL',
    rupees(tTaxable),
    rupees(tCgst),
    rupees(tSgst),
    rupees(tIgst),
    rupees(tCgst + tSgst + tIgst),
  ]);

  return {
    columns: ['GST Rate %', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax'],
    rows,
  };
}

/** GSTR-1-oriented B2B rows: one row per (invoice, rate). */
export function gstr1(invoices: readonly Invoice[], filter: ReportFilter): ReportTable {
  const rows: (string | number)[][] = [];
  for (const inv of filterInvoices(invoices, filter)) {
    const byRate = new Map<number, RateAcc>();
    for (const item of inv.items) {
      if (!matchesLine(item, filter)) continue;
      const acc = byRate.get(item.gstRatePercent) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      acc.taxable += item.tax.taxable;
      acc.cgst += item.tax.cgst;
      acc.sgst += item.tax.sgst;
      acc.igst += item.tax.igst;
      byRate.set(item.gstRatePercent, acc);
    }
    for (const [rate, acc] of Array.from(byRate.entries()).sort((a, b) => a[0] - b[0])) {
      rows.push([
        inv.buyer.gstin,
        inv.number,
        inv.date.slice(0, 10),
        rupees(inv.grandTotal),
        inv.placeOfSupplyStateCode,
        rate,
        rupees(acc.taxable),
        rupees(acc.cgst),
        rupees(acc.sgst),
        rupees(acc.igst),
      ]);
    }
  }
  return {
    columns: [
      'Recipient GSTIN',
      'Invoice No',
      'Invoice Date',
      'Invoice Value',
      'Place of Supply',
      'Rate %',
      'Taxable Value',
      'CGST',
      'SGST',
      'IGST',
    ],
    rows,
  };
}

/** GSTR-3B-oriented summary of outward taxable supplies (section 3.1(a)). */
export function gstr3bSummary(invoices: readonly Invoice[], filter: ReportFilter): ReportTable {
  let taxable = 0,
    cgst = 0,
    sgst = 0,
    igst = 0;
  for (const inv of filterInvoices(invoices, filter)) {
    taxable += inv.taxableTotal;
    cgst += inv.cgstTotal;
    sgst += inv.sgstTotal;
    igst += inv.igstTotal;
  }
  return {
    columns: ['Nature of Supplies', 'Taxable Value', 'IGST', 'CGST', 'SGST'],
    rows: [
      [
        'Outward taxable supplies (other than zero-rated, nil-rated and exempted)',
        rupees(taxable),
        rupees(igst),
        rupees(cgst),
        rupees(sgst),
      ],
    ],
  };
}
