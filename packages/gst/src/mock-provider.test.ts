import { describe, it, expect } from 'vitest';
import { MockGSTProvider } from './mock-provider';
import { computeGstinCheckDigit } from './gstin';

const VALID = '27AAPFU0939F1ZV';

function validGstin(first14: string): string {
  return first14 + computeGstinCheckDigit(first14);
}

describe('MockGSTProvider', () => {
  it('returns the canonical fixture', async () => {
    const provider = new MockGSTProvider();
    const r = await provider.verifyGSTIN(VALID);
    expect(r.legalName).toBe('Universal Instruments Pvt Ltd');
    expect(r.city).toBe('Mumbai');
    expect(r.state).toBe('Maharashtra');
    expect(r.stateCode).toBe('27');
    expect(r.status).toBe('ACTIVE');
    expect(r.provider).toBe('mock');
    expect(r.verifiedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('synthesizes an ACTIVE result for an unknown valid GSTIN, deriving the state', async () => {
    const provider = new MockGSTProvider();
    const r = await provider.verifyGSTIN(validGstin('29AAGCB7383J1Z'));
    expect(r.status).toBe('ACTIVE');
    expect(r.stateCode).toBe('29');
    expect(r.state).toBe('Karnataka');
    expect(r.legalName.length).toBeGreaterThan(0);
  });

  it('honors a custom fixture status', async () => {
    const g = validGstin('27AAPFU0939F2Z');
    const provider = new MockGSTProvider({ [g]: { status: 'CANCELLED' } });
    const r = await provider.verifyGSTIN(g);
    expect(r.status).toBe('CANCELLED');
  });

  it('throws a timeout when the fixture requests it', async () => {
    const g = validGstin('27ZZPFU0939F1Z');
    const provider = new MockGSTProvider({ [g]: { status: 'ACTIVE', timeout: true } });
    await expect(provider.verifyGSTIN(g)).rejects.toThrow(/timed out/i);
  });
});
