/**
 * GST verification provider contract + normalized result model.
 * No provider-specific field names leak past this module.
 */
import type { Iso8601 } from '@gst-engine/shared';
import { ProviderError } from '@gst-engine/shared';

export type GstStatus = 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'NOT_FOUND';

export interface GSTVerificationResult {
  gstin: string;
  legalName: string;
  tradeName?: string;
  registeredAddress: string;
  city: string;
  state: string;
  /** 2-digit; authoritative value is derived from gstin.slice(0, 2). */
  stateCode: string;
  pincode?: string;
  status: GstStatus;
  businessType?: string;
  verifiedAt: Iso8601;
  /** provider.name that produced this result. */
  provider: string;
}

export interface GSTVerificationProvider {
  readonly name: string;
  verifyGSTIN(gstin: string): Promise<GSTVerificationResult>;
}

/** A provider adapter has no credentials configured yet. */
export class ProviderNotConfiguredError extends ProviderError {
  constructor(providerName: string) {
    super(`GST provider "${providerName}" is not configured`, 'PROVIDER_NOT_CONFIGURED');
  }
}

/** The provider did not respond in time. */
export class ProviderTimeoutError extends ProviderError {
  constructor(providerName: string) {
    super(`GST provider "${providerName}" timed out`, 'PROVIDER_TIMEOUT');
  }
}

/** The provider is unreachable or returned an unusable response. */
export class ProviderUnavailableError extends ProviderError {
  constructor(providerName: string, cause?: unknown) {
    super(`GST provider "${providerName}" is unavailable`, 'PROVIDER_UNAVAILABLE', cause);
  }
}
