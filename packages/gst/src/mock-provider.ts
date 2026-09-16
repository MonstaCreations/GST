/**
 * MockGSTProvider — deterministic verification for development and tests.
 *
 * Behavior:
 *  - A GSTIN present in the fixtures returns (or, if `timeout`, throws) that case.
 *  - Any other GSTIN synthesizes an ACTIVE result, deriving the state from the
 *    GSTIN's state code and a placeholder name from its PAN.
 *
 * Note: the verification service validates format + checksum BEFORE calling a
 * provider, so end-to-end fixtures should use checksum-valid GSTINs (tests build
 * them with `computeGstinCheckDigit`).
 */
import type { GSTVerificationProvider, GSTVerificationResult, GstStatus } from './provider';
import { ProviderTimeoutError } from './provider';
import { normalizeVerificationResult, type RawVerification } from './normalize';
import { panFromGstin } from './gstin';

export interface MockFixture {
  status: GstStatus;
  legalName?: string;
  tradeName?: string;
  registeredAddress?: string;
  city?: string;
  pincode?: string;
  businessType?: string;
  /** When true, verifyGSTIN rejects with a ProviderTimeoutError. */
  timeout?: boolean;
}

const DEFAULT_FIXTURES: Readonly<Record<string, MockFixture>> = {
  // Canonical valid sample used across the test suites (Maharashtra).
  '27AAPFU0939F1ZV': {
    status: 'ACTIVE',
    legalName: 'Universal Instruments Pvt Ltd',
    tradeName: 'Universal Instruments',
    registeredAddress: '12, MIDC Road, Andheri East',
    city: 'Mumbai',
    pincode: '400093',
    businessType: 'Private Limited Company',
  },
};

export class MockGSTProvider implements GSTVerificationProvider {
  readonly name = 'mock';
  private readonly fixtures: Readonly<Record<string, MockFixture>>;

  constructor(fixtures: Readonly<Record<string, MockFixture>> = {}) {
    this.fixtures = { ...DEFAULT_FIXTURES, ...fixtures };
  }

  async verifyGSTIN(gstin: string): Promise<GSTVerificationResult> {
    const fixture = this.fixtures[gstin];
    if (fixture?.timeout) {
      throw new ProviderTimeoutError(this.name);
    }

    const status: GstStatus = fixture?.status ?? 'ACTIVE';
    const raw: RawVerification = {
      gstin,
      status,
      legalName: fixture?.legalName ?? `Mock Traders ${panFromGstin(gstin)}`,
      registeredAddress: fixture?.registeredAddress ?? '1, Example Industrial Estate',
      city: fixture?.city ?? 'Mumbai',
    };
    if (fixture?.tradeName !== undefined) raw.tradeName = fixture.tradeName;
    if (fixture?.pincode !== undefined) raw.pincode = fixture.pincode;
    if (fixture?.businessType !== undefined) raw.businessType = fixture.businessType;

    return normalizeVerificationResult(raw, this.name);
  }
}
