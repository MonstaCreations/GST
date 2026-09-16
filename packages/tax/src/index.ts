/**
 * @gst-engine/tax — GST tax classification (CGST/SGST vs IGST).
 * Per DECISIONS.md D5, the tax *amount* comes from Shopify's order tax_lines;
 * this module CLASSIFIES and VALIDATES that amount by place of supply.
 * Phase 0: types + stubs. Real logic in M5.
 */
import type { Paise } from '@gst-engine/core';

/** Split of a taxable amount into GST components (paise). Exactly one of the
 * intra-state pair (cgst+sgst) or inter-state (igst) is non-zero. */
export interface TaxBreakup {
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
}

export interface TaxClassificationInput {
  /** taxable value for the line/order (paise) */
  taxable: Paise;
  /** total GST charged by Shopify for it (paise) — the authority for the amount */
  taxCharged: Paise;
  gstRatePercent: number;
  sellerStateCode: string;
  placeOfSupplyStateCode: string;
}

/**
 * TODO(M5): if sellerStateCode === placeOfSupplyStateCode → CGST+SGST (split
 * taxCharged in half), else → IGST (= taxCharged). Validate the split matches
 * gstRatePercent within a rounding tolerance; flag mismatches.
 */
export declare function classifyTax(input: TaxClassificationInput): TaxBreakup;
