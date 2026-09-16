import { describe, it, expect } from 'vitest';
import { GST_STATE_CODES, stateNameForCode, isValidStateCode } from './state-codes';

describe('GST state codes', () => {
  it('maps the seller state (Maharashtra = 27)', () => {
    expect(stateNameForCode('27')).toBe('Maharashtra');
  });

  it('covers the common states used in tests', () => {
    expect(stateNameForCode('29')).toBe('Karnataka');
    expect(stateNameForCode('07')).toBe('Delhi');
    expect(stateNameForCode('24')).toBe('Gujarat');
  });

  it('recognizes valid codes and rejects unknown ones', () => {
    expect(isValidStateCode('27')).toBe(true);
    expect(isValidStateCode('37')).toBe(true); // Andhra Pradesh (current)
    expect(isValidStateCode('88')).toBe(false);
    expect(isValidStateCode('00')).toBe(false);
  });

  it('returns undefined for an unknown code', () => {
    expect(stateNameForCode('88')).toBeUndefined();
  });

  it('has no empty names', () => {
    for (const [code, name] of Object.entries(GST_STATE_CODES)) {
      expect(code).toMatch(/^[0-9]{2}$/);
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
