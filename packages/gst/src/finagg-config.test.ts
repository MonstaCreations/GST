import { describe, it, expect } from 'vitest';
import {
  FINAGG_PRODUCTION_BASE_URL,
  FINAGG_DEFAULT_TIMEOUT_MS,
  GstProviderConfigError,
  loadFinaggConfig,
  normalizeFinaggBaseUrl,
  resolveGstProviderSelection,
  validateGstProviderConfig,
  type EnvLike,
} from './finagg-config';

const COMPLETE: EnvLike = {
  GST_PROVIDER: 'finagg',
  FINAGG_API_KEY: 'a-key',
  FINAGG_BASE_URL: FINAGG_PRODUCTION_BASE_URL,
  FINAGG_FINAGG_VERSION: 'fin-v1',
  FINAGG_GSP_VERSION: 'v1.1',
};

describe('normalizeFinaggBaseUrl', () => {
  it.each([
    ['https://gsp.finagg.in', 'https://gsp.finagg.in'],
    ['https://gsp.finagg.in/', 'https://gsp.finagg.in'],
    ['https://gsp.finagg.in/basic/gstn', 'https://gsp.finagg.in'],
    ['https://gsp.finagg.in/basic/gstn/', 'https://gsp.finagg.in'],
    ['  https://sandbox-gsp.finagg.in/basic/gstn/  ', 'https://sandbox-gsp.finagg.in'],
  ])('reduces %s to its origin', (input, expected) => {
    expect(normalizeFinaggBaseUrl(input)).toBe(expected);
  });
});

describe('loadFinaggConfig', () => {
  it('builds a config from a complete environment', () => {
    expect(loadFinaggConfig(COMPLETE)).toEqual({
      apiKey: 'a-key',
      baseUrl: FINAGG_PRODUCTION_BASE_URL,
      finaggVersion: 'fin-v1',
      gspVersion: 'v1.1',
      timeoutMs: FINAGG_DEFAULT_TIMEOUT_MS,
      retryOnce: true,
    });
  });

  it('reports every missing variable at once, without echoing any secret', () => {
    let caught: unknown;
    try {
      loadFinaggConfig({ GST_PROVIDER: 'finagg' });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(GstProviderConfigError);
    const error = caught as GstProviderConfigError;
    expect(error.problems).toHaveLength(4);
    expect(error.message).toContain('FINAGG_API_KEY');
    expect(error.message).toContain('FINAGG_BASE_URL');
    expect(error.message).toContain('FINAGG_FINAGG_VERSION');
    expect(error.message).toContain('FINAGG_GSP_VERSION');
  });

  it('never puts the API key in the error message', () => {
    try {
      loadFinaggConfig({ ...COMPLETE, FINAGG_API_KEY: 'a-key', FINAGG_GSP_VERSION: '' });
      throw new Error('expected a config error');
    } catch (err) {
      expect((err as Error).message).not.toContain('a-key');
    }
  });

  it('rejects a non-absolute base URL', () => {
    expect(() => loadFinaggConfig({ ...COMPLETE, FINAGG_BASE_URL: 'gsp.finagg.in' })).toThrow(
      GstProviderConfigError,
    );
  });

  it('rejects a non-numeric timeout', () => {
    expect(() => loadFinaggConfig({ ...COMPLETE, FINAGG_TIMEOUT_MS: 'soon' })).toThrow(
      GstProviderConfigError,
    );
  });

  it('honours an explicit timeout and retry opt-out', () => {
    const config = loadFinaggConfig({
      ...COMPLETE,
      FINAGG_TIMEOUT_MS: '2500',
      FINAGG_RETRY: 'false',
    });
    expect(config.timeoutMs).toBe(2500);
    expect(config.retryOnce).toBe(false);
  });
});

describe('resolveGstProviderSelection', () => {
  it('defaults to mock when GST_PROVIDER is unset', () => {
    expect(resolveGstProviderSelection({})).toEqual({ provider: 'mock' });
  });

  it('selects mock explicitly', () => {
    expect(resolveGstProviderSelection({ GST_PROVIDER: 'mock' })).toEqual({ provider: 'mock' });
  });

  it('keeps the legacy gstverify stub selectable', () => {
    expect(resolveGstProviderSelection({ GST_PROVIDER: 'gstverify' })).toEqual({
      provider: 'gstverify',
    });
  });

  it('selects finagg with its config', () => {
    const selection = resolveGstProviderSelection(COMPLETE);
    expect(selection.provider).toBe('finagg');
    if (selection.provider === 'finagg') {
      expect(selection.config.gspVersion).toBe('v1.1');
    }
  });

  it('never falls back to mock when the FinAGG config is incomplete', () => {
    expect(() => resolveGstProviderSelection({ GST_PROVIDER: 'finagg' })).toThrow(
      GstProviderConfigError,
    );
  });

  it('rejects an unrecognised provider name instead of silently using mock', () => {
    expect(() => resolveGstProviderSelection({ GST_PROVIDER: 'finaggg' })).toThrow(
      GstProviderConfigError,
    );
  });
});

describe('validateGstProviderConfig', () => {
  it('passes for a complete finagg environment', () => {
    expect(() => validateGstProviderConfig(COMPLETE)).not.toThrow();
  });

  it('fails fast for an incomplete one', () => {
    expect(() =>
      validateGstProviderConfig({ GST_PROVIDER: 'finagg', FINAGG_API_KEY: 'k' }),
    ).toThrow(GstProviderConfigError);
  });
});
