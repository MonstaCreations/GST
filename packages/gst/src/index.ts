/**
 * @gst-engine/gst — GST verification provider abstraction + normalization.
 * The ONLY external dependency of the system lives behind this interface.
 * Phase 0: contract + provider stubs. Real logic in M2 (mock) and M10 (real).
 * See docs/GST_PROVIDER.md.
 */
import type { Iso8601 } from '@gst-engine/shared';
import { ProviderError } from '@gst-engine/shared';

// ---------------------------------------------------------------------------
// Normalized result — every provider maps its raw response into this shape.
// No provider-specific field names leak past this module.
// ---------------------------------------------------------------------------

export type GstStatus = 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'NOT_FOUND';

export interface GSTVerificationResult {
  gstin: string;
  legalName: string;
  tradeName?: string;
  registeredAddress: string;
  city: string;
  state: string;
  /** 2-digit; must equal gstin.slice(0, 2). */
  stateCode: string;
  pincode?: string;
  status: GstStatus;
  businessType?: string;
  verifiedAt: Iso8601;
  /** provider.name that produced this result. */
  provider: string;
}

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export interface GSTVerificationProvider {
  readonly name: string;
  verifyGSTIN(gstin: string): Promise<GSTVerificationResult>;
}

/** Thrown by a provider adapter that has no credentials configured yet. */
export class ProviderNotConfiguredError extends ProviderError {
  constructor(providerName: string) {
    super(`GST provider "${providerName}" is not configured`, 'PROVIDER_NOT_CONFIGURED');
  }
}

// ---------------------------------------------------------------------------
// GSTIN validation — TODO(M2): implement format + checksum.
// ---------------------------------------------------------------------------

/** TODO(M2): 15-char format regex + Luhn-mod-36 checksum validation. */
export declare function isValidGstinFormat(gstin: string): boolean;

// ---------------------------------------------------------------------------
// Implementations (stubs)
// ---------------------------------------------------------------------------

/** Deterministic fixtures for development/tests. TODO(M2): implement. */
export class MockGSTProvider implements GSTVerificationProvider {
  readonly name = 'mock';
  verifyGSTIN(_gstin: string): Promise<GSTVerificationResult> {
    throw new Error('MockGSTProvider.verifyGSTIN not implemented — M2');
  }
}

/** Real provider. Inert until credentials arrive. TODO(M10): implement mapping. */
export class GSTVerifyProvider implements GSTVerificationProvider {
  readonly name = 'gstverify';
  verifyGSTIN(_gstin: string): Promise<GSTVerificationResult> {
    throw new ProviderNotConfiguredError(this.name);
  }
}
