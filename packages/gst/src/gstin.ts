/**
 * GSTIN structure, format, and checksum validation.
 *
 * A GSTIN is 15 characters:
 *   [2] state code   [10] PAN (5 letters, 4 digits, 1 letter)
 *   [1] entity code  [1] default 'Z'   [1] checksum
 *
 * The checksum is the standard GSTN mod-36 algorithm over the first 14 characters.
 */
import { isValidStateCode } from '@gst-engine/core';

const GSTN_CODEPOINT_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Trim, upper-case, and strip whitespace from raw user input. */
export function normalizeGstinInput(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

/** Structural check only (does not validate the checksum). */
export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin);
}

/** Compute the GSTN check character for the first 14 characters of a GSTIN. */
export function computeGstinCheckDigit(first14: string): string {
  const mod = GSTN_CODEPOINT_CHARS.length; // 36
  let factor = 2;
  let sum = 0;
  for (let i = first14.length - 1; i >= 0; i--) {
    const codePoint = GSTN_CODEPOINT_CHARS.indexOf(first14.charAt(i));
    if (codePoint < 0) return ''; // invalid character
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / mod) + (addend % mod);
    sum += addend;
  }
  const checkCodePoint = (mod - (sum % mod)) % mod;
  return GSTN_CODEPOINT_CHARS.charAt(checkCodePoint);
}

/** True if the 15th character matches the checksum of the first 14. */
export function isValidGstinChecksum(gstin: string): boolean {
  if (gstin.length !== 15) return false;
  const expected = computeGstinCheckDigit(gstin.slice(0, 14));
  return expected !== '' && expected === gstin.charAt(14);
}

/** Full validity: format + known state code + checksum. */
export function isValidGstin(gstin: string): boolean {
  return (
    isValidGstinFormat(gstin) &&
    isValidStateCode(stateCodeFromGstin(gstin)) &&
    isValidGstinChecksum(gstin)
  );
}

export type GstinInvalidReason = 'format' | 'state_code' | 'checksum';

export type GstinValidation = { valid: true } | { valid: false; reason: GstinInvalidReason };

/** Validate and report the first failing reason (format → state_code → checksum). */
export function validateGstin(gstin: string): GstinValidation {
  if (!isValidGstinFormat(gstin)) return { valid: false, reason: 'format' };
  if (!isValidStateCode(stateCodeFromGstin(gstin))) return { valid: false, reason: 'state_code' };
  if (!isValidGstinChecksum(gstin)) return { valid: false, reason: 'checksum' };
  return { valid: true };
}

/** The 2-digit state code (first two characters). */
export function stateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2);
}

/** The 10-character PAN embedded in the GSTIN (characters 3–12). */
export function panFromGstin(gstin: string): string {
  return gstin.slice(2, 12);
}
