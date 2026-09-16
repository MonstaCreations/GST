import { describe, it, expect } from 'vitest';
import { createVerificationService } from './verify-service';
import { MockGSTProvider } from './mock-provider';
import { computeGstinCheckDigit } from './gstin';
import type { GSTVerificationProvider } from './provider';
import { ProviderTimeoutError } from './provider';

const VALID = '27AAPFU0939F1ZV';

function validGstin(first14: string): string {
  return first14 + computeGstinCheckDigit(first14);
}

describe('verification service', () => {
  const service = createVerificationService(new MockGSTProvider());

  it('verifies a valid, active GSTIN (and normalizes messy input)', async () => {
    const outcome = await service.verify('  27aapfu0939f1zv ');
    expect(outcome.kind).toBe('verified');
    if (outcome.kind === 'verified') {
      expect(outcome.result.gstin).toBe(VALID);
      expect(outcome.result.stateCode).toBe('27');
      expect(outcome.result.state).toBe('Maharashtra');
    }
  });

  it('flags an invalid format without calling the provider', async () => {
    const outcome = await service.verify('not-a-gstin');
    expect(outcome).toMatchObject({ kind: 'invalid', reason: 'format' });
  });

  it('flags a bad checksum', async () => {
    const outcome = await service.verify('27AAPFU0939F1ZX');
    expect(outcome).toMatchObject({ kind: 'invalid', reason: 'checksum' });
  });

  it('maps NOT_FOUND', async () => {
    const g = validGstin('27AAPFU0939F2Z');
    const svc = createVerificationService(new MockGSTProvider({ [g]: { status: 'NOT_FOUND' } }));
    const outcome = await svc.verify(g);
    expect(outcome.kind).toBe('not_found');
  });

  it('maps INACTIVE / CANCELLED to inactive', async () => {
    const g = validGstin('27AAPFU0939F3Z');
    const svc = createVerificationService(new MockGSTProvider({ [g]: { status: 'INACTIVE' } }));
    const outcome = await svc.verify(g);
    expect(outcome.kind).toBe('inactive');
  });

  it('returns unavailable when the provider fails (checkout must not block)', async () => {
    const g = validGstin('27AAPFU0939F4Z');
    const failing: GSTVerificationProvider = {
      name: 'failing',
      verifyGSTIN: () => Promise.reject(new ProviderTimeoutError('failing')),
    };
    const outcome = await createVerificationService(failing).verify(g);
    expect(outcome).toMatchObject({ kind: 'unavailable' });
  });
});
