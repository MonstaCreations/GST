/**
 * Selects the GST verification provider from env and builds the verification
 * service. Reuses @gst-engine/gst — no verification logic is duplicated here.
 *
 * GST_PROVIDER=mock (default) | gstverify. The real provider stays inert until
 * credentials arrive (M10); the rest of the app does not change when it does.
 */
import {
  createVerificationService,
  MockGSTProvider,
  GSTVerifyProvider,
  type GSTVerificationProvider,
  type VerificationService,
} from '@gst-engine/gst';

let cached: VerificationService | undefined;

function selectProvider(): GSTVerificationProvider {
  const name = (process.env.GST_PROVIDER ?? 'mock').toLowerCase();
  switch (name) {
    case 'gstverify':
      return new GSTVerifyProvider();
    case 'mock':
    default:
      return new MockGSTProvider();
  }
}

export function getVerificationService(): VerificationService {
  cached ??= createVerificationService(selectProvider());
  return cached;
}
