/**
 * GSTVerifyProvider — the real provider adapter.
 * Inert until credentials arrive (see docs/GST_PROVIDER.md). In M10 this maps the
 * provider's request/response to RawVerification and reuses normalizeVerificationResult.
 */
import type { GSTVerificationProvider, GSTVerificationResult } from './provider';
import { ProviderNotConfiguredError } from './provider';

export class GSTVerifyProvider implements GSTVerificationProvider {
  readonly name = 'gstverify';

  verifyGSTIN(_gstin: string): Promise<GSTVerificationResult> {
    // TODO(M10): call GST_API_URL with GST_API_KEY, map response → RawVerification,
    // then normalizeVerificationResult(raw, this.name).
    throw new ProviderNotConfiguredError(this.name);
  }
}
