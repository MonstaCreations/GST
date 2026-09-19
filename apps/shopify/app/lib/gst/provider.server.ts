/**
 * Selects the GST verification provider from env and builds the verification
 * service. Reuses @gst-engine/gst — no verification logic is duplicated here.
 *
 * GST_PROVIDER=mock (default) | finagg | gstverify (legacy stub).
 *
 * The configuration is resolved once at module load, so a misconfigured FinAGG
 * environment fails at boot with a clear message instead of during a customer's
 * checkout. `finagg` never silently degrades to the mock provider.
 *
 * FINAGG_API_KEY is read here, server-side only; it is never sent to the browser,
 * the theme extension, or the customer-account extension.
 */
import { serverLogger } from '../logger.server';
import {
  createVerificationService,
  resolveGstProviderSelection,
  FinAGGProvider,
  MockGSTProvider,
  GSTVerifyProvider,
  type GstProviderSelection,
  type GSTVerificationProvider,
  type VerificationService,
} from '@gst-engine/gst';

// Throws GstProviderConfigError at boot if the environment is unusable.
// eslint-disable-next-line no-undef
const selection: GstProviderSelection = resolveGstProviderSelection(process.env);

let cached: VerificationService | undefined;

function createProvider(): GSTVerificationProvider {
  switch (selection.provider) {
    case 'finagg':
      return new FinAGGProvider(selection.config, { logger: serverLogger });
    case 'gstverify':
      return new GSTVerifyProvider();
    case 'mock':
      return new MockGSTProvider();
  }
}

export function getVerificationService(): VerificationService {
  cached ??= createVerificationService(createProvider());
  return cached;
}

/** The active provider's name, safe to render in the admin UI. Never includes credentials. */
export function getGstProviderName(): GstProviderSelection['provider'] {
  return selection.provider;
}

/**
 * Non-secret description of the active provider, for the admin diagnostics page.
 * Deliberately reports only *whether* an API key is present, never its value.
 */
export function describeGstProvider(): {
  provider: GstProviderSelection['provider'];
  endpoint: string | null;
  apiKeyConfigured: boolean;
} {
  if (selection.provider !== 'finagg') {
    return { provider: selection.provider, endpoint: null, apiKeyConfigured: false };
  }
  const { baseUrl, finaggVersion, gspVersion, apiKey } = selection.config;
  return {
    provider: 'finagg',
    endpoint: `${baseUrl}/basic/gstn/${finaggVersion}/commonapi/${gspVersion}/search`,
    apiKeyConfigured: apiKey.length > 0,
  };
}
