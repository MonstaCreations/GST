import { describe, it, expect } from 'vitest';
import { GST_METAFIELD_DEFINITIONS } from './definitions';

describe('GST metafield definitions', () => {
  it('defines the full customer GST profile (10 keys)', () => {
    const customer = GST_METAFIELD_DEFINITIONS.filter((d) => d.ownerType === 'CUSTOMER');
    const keys = customer.map((d) => d.key).sort();
    expect(keys).toEqual(
      [
        'city',
        'gstin',
        'legal_name',
        'pincode',
        'registered_address',
        'state',
        'state_code',
        'trade_name',
        'verification_status',
        'verified_at',
      ].sort(),
    );
    expect(customer.every((d) => d.namespace === 'gst')).toBe(true);
  });

  it('defines product HSN + GST rate with correct types', () => {
    const product = GST_METAFIELD_DEFINITIONS.filter((d) => d.ownerType === 'PRODUCT');
    expect(product).toHaveLength(2);
    const rate = product.find((d) => d.key === 'gst_rate');
    expect(rate?.type).toBe('number_decimal');
    expect(product.find((d) => d.key === 'hsn_code')?.type).toBe('single_line_text_field');
  });

  it('defines order invoice/gst/credit_note metafields', () => {
    const order = GST_METAFIELD_DEFINITIONS.filter((d) => d.ownerType === 'ORDER');
    const byNsKey = order.map((d) => `${d.namespace}.${d.key}`).sort();
    expect(byNsKey).toEqual(
      [
        'credit_note.reference',
        'gst.snapshot',
        'invoice.date',
        'invoice.number',
        'invoice.status',
        'invoice.url',
      ].sort(),
    );
    expect(order.find((d) => d.key === 'url')?.type).toBe('url');
    expect(order.find((d) => d.key === 'snapshot')?.type).toBe('json');
  });

  it('has no duplicate ownerType+namespace+key entries', () => {
    const ids = GST_METAFIELD_DEFINITIONS.map((d) => `${d.ownerType}:${d.namespace}.${d.key}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
