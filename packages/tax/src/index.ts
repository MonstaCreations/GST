/**
 * @gst-engine/tax — GST tax classification (CGST/SGST vs IGST).
 *
 * Per DECISIONS.md D5, the tax *amount* comes from Shopify's order tax_lines;
 * this module CLASSIFIES that charged amount by place of supply and offers a
 * validation helper to flag amounts that diverge from the nominal rate.
 */
import { paise, percentagePaise, splitTaxHalf, type Paise } from '@gst-engine/core';

/** GST components (paise). Intra-state fills cgst+sgst; inter-state fills igst. */
export interface TaxBreakup {
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
}

export interface TaxClassificationInput {
  /** taxable value for the line/order (paise) */
  taxable: Paise;
  /** total GST charged by Shopify (paise) — the authority for the amount */
  taxCharged: Paise;
  gstRatePercent: number;
  sellerStateCode: string;
  placeOfSupplyStateCode: string;
}

/** True when seller and place of supply are in the same state. */
export function isIntraState(sellerStateCode: string, placeOfSupplyStateCode: string): boolean {
  return sellerStateCode === placeOfSupplyStateCode;
}

/**
 * Split the charged tax into GST components. Intra-state → CGST + SGST (halves
 * summing exactly to the charged amount); inter-state → IGST (= charged amount).
 */
export function classifyTax(input: TaxClassificationInput): TaxBreakup {
  const { taxable, taxCharged } = input;
  if (isIntraState(input.sellerStateCode, input.placeOfSupplyStateCode)) {
    const [cgst, sgst] = splitTaxHalf(taxCharged);
    return { taxable, cgst, sgst, igst: paise(0) };
  }
  return { taxable, cgst: paise(0), sgst: paise(0), igst: taxCharged };
}

/** Nominal tax for a taxable amount at a GST rate (rounded to paise). */
export function expectedTax(taxable: Paise, gstRatePercent: number): Paise {
  return percentagePaise(taxable, gstRatePercent);
}

export interface TaxValidation {
  ok: boolean;
  expected: Paise;
  actual: Paise;
  diffPaise: number;
}

/**
 * Sanity-check the charged tax against the nominal rate. Small differences from
 * rounding are tolerated; larger ones are flagged for review (never auto-corrected).
 */
export function validateChargedTax(
  taxable: Paise,
  gstRatePercent: number,
  taxCharged: Paise,
  tolerancePaise = 2,
): TaxValidation {
  const expected = expectedTax(taxable, gstRatePercent);
  const diffPaise = Math.abs(taxCharged - expected);
  return { ok: diffPaise <= tolerancePaise, expected, actual: taxCharged, diffPaise };
}
