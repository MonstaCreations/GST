/**
 * Pure-logic tests for the order GST capture: claim extraction and snapshot building.
 * The Shopify-calling `persistOrderGst` is covered by manual testing on a dev store.
 */
import { describe, it, expect } from 'vitest';
import {
  buildOrderGstSnapshot,
  readGstClaim,
  orderGidFromPayload,
  type GstClaim,
} from './order-gst.server';
import type { GSTVerificationResult, VerificationOutcome } from '@gst-engine/gst';

const GSTIN = '27AAPFU0939F1ZV';
const CAPTURED_AT = '2026-09-19T10:00:00.000Z';

const CLAIM: GstClaim = {
  gstin: GSTIN,
  legalName: 'Buyer Supplied Name',
  registeredAddress: 'Buyer Supplied Address',
  city: 'Buyer City',
  state: 'Buyer State',
  stateCode: '99',
};

function attrs(pairs: Record<string, string>) {
  return Object.entries(pairs).map(([name, value]) => ({ name, value }));
}

const VERIFIED_RESULT: GSTVerificationResult = {
  gstin: GSTIN,
  legalName: 'Universal Instruments Pvt Ltd',
  tradeName: 'Universal Instruments',
  registeredAddress: '12, MIDC Road, Andheri East',
  city: 'Mumbai',
  state: 'Maharashtra',
  stateCode: '27',
  pincode: '400093',
  status: 'ACTIVE',
  verifiedAt: '2026-09-19T09:59:00.000Z',
  provider: 'finagg',
};

describe('readGstClaim', () => {
  it('reads the claim when the buyer opted in', () => {
    const claim = readGstClaim({
      note_attributes: attrs({
        gst_invoice: 'true',
        gst_gstin: GSTIN,
        gst_legal_name: 'Acme',
        gst_registered_address: '1 Road',
        gst_city: 'Mumbai',
        gst_state: 'Maharashtra',
        gst_state_code: '27',
      }),
    });
    expect(claim).toEqual({
      gstin: GSTIN,
      legalName: 'Acme',
      registeredAddress: '1 Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
    });
  });

  it('returns null when the buyer did not opt in', () => {
    expect(readGstClaim({ note_attributes: attrs({ gst_gstin: GSTIN }) })).toBeNull();
  });

  it('returns null when opted in but no GSTIN was supplied', () => {
    expect(readGstClaim({ note_attributes: attrs({ gst_invoice: 'true' }) })).toBeNull();
  });

  it('tolerates a missing or malformed note_attributes field', () => {
    expect(readGstClaim({})).toBeNull();
    expect(readGstClaim({ note_attributes: 'nope' })).toBeNull();
    expect(readGstClaim({ note_attributes: [{ name: 1, value: 2 }] })).toBeNull();
  });
});

describe('orderGidFromPayload', () => {
  it('reads the admin GraphQL id', () => {
    expect(orderGidFromPayload({ admin_graphql_api_id: 'gid://shopify/Order/1' })).toBe(
      'gid://shopify/Order/1',
    );
  });

  it('returns null when absent', () => {
    expect(orderGidFromPayload({})).toBeNull();
  });
});

describe('buildOrderGstSnapshot', () => {
  it('takes every authoritative field from the provider, not from the buyer', () => {
    const outcome: VerificationOutcome = { kind: 'verified', result: VERIFIED_RESULT };
    const snapshot = buildOrderGstSnapshot(outcome, CLAIM, CAPTURED_AT);

    expect(snapshot).toEqual({
      gstin: GSTIN,
      legalName: 'Universal Instruments Pvt Ltd',
      tradeName: 'Universal Instruments',
      registeredAddress: '12, MIDC Road, Andheri East',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '400093',
      verificationStatus: 'ACTIVE',
      verifiedAt: '2026-09-19T09:59:00.000Z',
      provider: 'finagg',
      capturedAt: CAPTURED_AT,
    });
    // The forged buyer values must not survive anywhere in a verified snapshot.
    expect(JSON.stringify(snapshot)).not.toContain('Buyer Supplied');
    expect(snapshot.claimed).toBeUndefined();
  });

  it('records a cancelled taxpayer as authoritative but not active', () => {
    const outcome: VerificationOutcome = {
      kind: 'inactive',
      result: { ...VERIFIED_RESULT, status: 'CANCELLED' },
    };
    const snapshot = buildOrderGstSnapshot(outcome, CLAIM, CAPTURED_AT);
    expect(snapshot.verificationStatus).toBe('CANCELLED');
    expect(snapshot.provider).toBe('finagg');
  });

  it.each([
    [{ kind: 'not_found', gstin: GSTIN } as VerificationOutcome, 'NOT_FOUND'],
    [
      { kind: 'invalid', gstin: GSTIN, reason: 'provider_rejected' } as VerificationOutcome,
      'INVALID',
    ],
    [
      { kind: 'unavailable', gstin: GSTIN, message: 'x' } as VerificationOutcome,
      'UNVERIFIED',
    ],
  ])('quarantines the buyer claim when the outcome is %#', (outcome, expected) => {
    const snapshot = buildOrderGstSnapshot(outcome, CLAIM, CAPTURED_AT);

    expect(snapshot.verificationStatus).toBe(expected);
    expect(snapshot.verifiedAt).toBeNull();
    expect(snapshot.provider).toBeNull();
    // Authoritative fields stay empty; the claim is kept separately and marked as such.
    expect(snapshot.legalName).toBe('');
    expect(snapshot.registeredAddress).toBe('');
    expect(snapshot.city).toBe('');
    expect(snapshot.claimed).toEqual(CLAIM);
    // State code still comes from the GSTIN itself, never from the buyer's "99".
    expect(snapshot.stateCode).toBe('27');
  });
});
