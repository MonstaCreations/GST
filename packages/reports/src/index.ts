/**
 * @gst-engine/reports — GST report datasets (compute only; no I/O).
 * Consumes invoice rows (sourced via Shopify Bulk Operations by apps/shopify).
 * Phase 0: types + stubs. Real logic in M8.
 *
 * NOTE: these are reporting aids, NOT government filings (see DECISIONS.md).
 */
import type { Invoice } from '@gst-engine/invoice';

export interface ReportFilter {
  fromDate: string;
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

/** TODO(M8): flat sales register. */
export declare function salesRegister(invoices: Invoice[], filter: ReportFilter): ReportTable;

/** TODO(M8): tax summary grouped by rate. */
export declare function taxSummary(invoices: Invoice[], filter: ReportFilter): ReportTable;

/** TODO(M8): GSTR-1-oriented B2B dataset. */
export declare function gstr1(invoices: Invoice[], filter: ReportFilter): ReportTable;

/** TODO(M8): GSTR-3B sales/tax summary. */
export declare function gstr3bSummary(invoices: Invoice[], filter: ReportFilter): ReportTable;
