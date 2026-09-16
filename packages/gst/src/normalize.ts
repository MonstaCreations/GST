/**
 * Normalizes a provider's raw verification data into GSTVerificationResult.
 * The state code is always derived authoritatively from the GSTIN itself, and
 * the state name is filled from the canonical table when the provider omits it.
 */
import { stateNameForCode } from '@gst-engine/core';
import type { GSTVerificationResult, GstStatus } from './provider';
import { stateCodeFromGstin } from './gstin';

/** Provider-agnostic input to normalization (already mapped from a raw response). */
export interface RawVerification {
  gstin: string;
  legalName: string;
  tradeName?: string;
  registeredAddress: string;
  city: string;
  state?: string;
  pincode?: string;
  status: GstStatus;
  businessType?: string;
}

export function normalizeVerificationResult(
  raw: RawVerification,
  providerName: string,
  now: () => Date = () => new Date(),
): GSTVerificationResult {
  const stateCode = stateCodeFromGstin(raw.gstin);
  const state = raw.state ?? stateNameForCode(stateCode) ?? '';

  const result: GSTVerificationResult = {
    gstin: raw.gstin,
    legalName: raw.legalName,
    registeredAddress: raw.registeredAddress,
    city: raw.city,
    state,
    stateCode,
    status: raw.status,
    verifiedAt: now().toISOString(),
    provider: providerName,
  };
  if (raw.tradeName !== undefined) result.tradeName = raw.tradeName;
  if (raw.pincode !== undefined) result.pincode = raw.pincode;
  if (raw.businessType !== undefined) result.businessType = raw.businessType;
  return result;
}
