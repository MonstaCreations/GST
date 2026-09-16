import { describe, it, expect } from 'vitest';
import { paise } from '@gst-engine/core';
import { classifyTax, isIntraState, expectedTax, validateChargedTax } from './index';

// ₹1000 taxable at 18% GST = ₹180 tax = 18000 paise.
const TAXABLE = paise(100000);
const TAX_18 = paise(18000);

describe('classifyTax', () => {
  it('splits into CGST + SGST for an intra-state supply', () => {
    const b = classifyTax({
      taxable: TAXABLE,
      taxCharged: TAX_18,
      gstRatePercent: 18,
      sellerStateCode: '27',
      placeOfSupplyStateCode: '27',
    });
    expect(b).toEqual({ taxable: 100000, cgst: 9000, sgst: 9000, igst: 0 });
  });

  it('assigns IGST for an inter-state supply', () => {
    const b = classifyTax({
      taxable: TAXABLE,
      taxCharged: TAX_18,
      gstRatePercent: 18,
      sellerStateCode: '27',
      placeOfSupplyStateCode: '29',
    });
    expect(b).toEqual({ taxable: 100000, cgst: 0, sgst: 0, igst: 18000 });
  });

  it('splits an odd charged amount without losing a paisa', () => {
    const b = classifyTax({
      taxable: TAXABLE,
      taxCharged: paise(18001),
      gstRatePercent: 18,
      sellerStateCode: '27',
      placeOfSupplyStateCode: '27',
    });
    expect(b.cgst + b.sgst).toBe(18001);
    expect([b.cgst, b.sgst]).toEqual([9000, 9001]);
  });
});

describe('isIntraState', () => {
  it('compares state codes', () => {
    expect(isIntraState('27', '27')).toBe(true);
    expect(isIntraState('27', '29')).toBe(false);
  });
});

describe('validateChargedTax', () => {
  it('accepts a charge matching the nominal rate', () => {
    const v = validateChargedTax(TAXABLE, 18, TAX_18);
    expect(v).toMatchObject({ ok: true, expected: 18000, actual: 18000, diffPaise: 0 });
  });
  it('flags a charge outside tolerance', () => {
    const v = validateChargedTax(TAXABLE, 18, paise(18010));
    expect(v.ok).toBe(false);
    expect(v.diffPaise).toBe(10);
  });
  it('exposes the expected amount', () => {
    expect(expectedTax(TAXABLE, 12)).toBe(12000);
  });
});
