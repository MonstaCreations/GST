import { describe, it, expect } from 'vitest';
import {
  isValidGstinFormat,
  isValidGstinChecksum,
  isValidGstin,
  computeGstinCheckDigit,
  validateGstin,
  normalizeGstinInput,
  stateCodeFromGstin,
  panFromGstin,
} from './gstin';

// Canonical valid GSTIN (Maharashtra) widely used as a reference sample.
const VALID = '27AAPFU0939F1ZV';

/** Build a checksum-valid GSTIN from a 14-char body. */
function validGstin(first14: string): string {
  return first14 + computeGstinCheckDigit(first14);
}

describe('GSTIN format', () => {
  it('accepts a well-formed GSTIN', () => {
    expect(isValidGstinFormat(VALID)).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidGstinFormat('27AAPFU0939F1Z')).toBe(false);
  });

  it('rejects a structurally wrong string', () => {
    expect(isValidGstinFormat('AA27APFU0939F1ZV')).toBe(false);
  });

  it('rejects lowercase (caller must normalize first)', () => {
    expect(isValidGstinFormat('27aapfu0939f1zv')).toBe(false);
  });
});

describe('GSTIN checksum', () => {
  it('validates the canonical sample', () => {
    expect(isValidGstinChecksum(VALID)).toBe(true);
  });

  it('recomputes the canonical check digit', () => {
    expect(computeGstinCheckDigit(VALID.slice(0, 14))).toBe('V');
  });

  it('detects a tampered check digit', () => {
    expect(isValidGstinChecksum('27AAPFU0939F1ZX')).toBe(false);
  });

  it('detects a tampered body', () => {
    expect(isValidGstinChecksum('27AAPFU0939F2ZV')).toBe(false);
  });
});

describe('validateGstin', () => {
  it('passes a fully valid GSTIN', () => {
    expect(validateGstin(VALID)).toEqual({ valid: true });
    expect(isValidGstin(VALID)).toBe(true);
  });

  it('flags a format failure first', () => {
    expect(validateGstin('nonsense')).toEqual({ valid: false, reason: 'format' });
  });

  it('flags an unknown state code', () => {
    const g = validGstin('88AAPFU0939F1Z'); // 88 is not a real state code
    expect(isValidGstinFormat(g)).toBe(true);
    expect(validateGstin(g)).toEqual({ valid: false, reason: 'state_code' });
  });

  it('flags a checksum failure', () => {
    expect(validateGstin('27AAPFU0939F1ZX')).toEqual({ valid: false, reason: 'checksum' });
  });
});

describe('GSTIN helpers', () => {
  it('normalizes raw input', () => {
    expect(normalizeGstinInput('  27aapfu0939f1zv ')).toBe(VALID);
  });

  it('extracts the state code and PAN', () => {
    expect(stateCodeFromGstin(VALID)).toBe('27');
    expect(panFromGstin(VALID)).toBe('AAPFU0939F');
  });
});
