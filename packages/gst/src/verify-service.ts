/**
 * Verification service — the provider-agnostic entry point used by the app.
 *
 * Pipeline: normalize input → server-side format/state/checksum validation →
 * call the provider → derive authoritative state code → map to an outcome.
 *
 * Any provider failure becomes `unavailable` rather than throwing, so the caller
 * (storefront) can let checkout continue — verification must never block a sale.
 */
import { stateNameForCode } from '@gst-engine/core';
import type { GSTVerificationProvider, GSTVerificationResult } from './provider';
import { normalizeGstinInput, stateCodeFromGstin, validateGstin } from './gstin';
import type { GstinInvalidReason } from './gstin';

export type VerificationOutcome =
  | { kind: 'verified'; result: GSTVerificationResult }
  | { kind: 'inactive'; result: GSTVerificationResult }
  | { kind: 'not_found'; gstin: string }
  | { kind: 'invalid'; gstin: string; reason: GstinInvalidReason }
  | { kind: 'unavailable'; gstin: string; message: string };

export interface VerificationService {
  verify(rawInput: string): Promise<VerificationOutcome>;
}

export function createVerificationService(provider: GSTVerificationProvider): VerificationService {
  return {
    async verify(rawInput: string): Promise<VerificationOutcome> {
      const gstin = normalizeGstinInput(rawInput);

      const validation = validateGstin(gstin);
      if (!validation.valid) {
        return { kind: 'invalid', gstin, reason: validation.reason };
      }

      let result: GSTVerificationResult;
      try {
        result = await provider.verifyGSTIN(gstin);
      } catch (err) {
        return {
          kind: 'unavailable',
          gstin,
          message: err instanceof Error ? err.message : 'verification failed',
        };
      }

      // The GSTIN itself is authoritative for the state code.
      const stateCode = stateCodeFromGstin(gstin);
      const corrected: GSTVerificationResult = {
        ...result,
        stateCode,
        state: result.state || stateNameForCode(stateCode) || result.state,
      };

      switch (corrected.status) {
        case 'ACTIVE':
          return { kind: 'verified', result: corrected };
        case 'INACTIVE':
        case 'CANCELLED':
          return { kind: 'inactive', result: corrected };
        case 'NOT_FOUND':
          return { kind: 'not_found', gstin };
        default:
          return { kind: 'not_found', gstin };
      }
    },
  };
}
