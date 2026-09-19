/**
 * FinAGGProvider tests. Every HTTP interaction is a stub — the real FinAGG API is
 * never called from the test suite.
 */
import { describe, it, expect, vi } from 'vitest';
import { FinAGGProvider } from './finagg-provider';
import { buildFinaggSearchUrl, maskGstin, type FetchLike } from './finagg-client';
import type { FinaggConfig } from './finagg-config';
import { createVerificationService } from './verify-service';
import {
  ProviderInvalidGstinError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from './provider';

const GSTIN = '27AAPFU0939F1ZV';

const CONFIG: FinaggConfig = {
  apiKey: 'test-key-do-not-log',
  baseUrl: 'https://gsp.finagg.in',
  finaggVersion: 'fin-v1',
  gspVersion: 'v1.1',
  timeoutMs: 50,
  retryOnce: false,
};

interface Call {
  url: string;
  headers: Record<string, string>;
}

/** A stub `fetch` that answers with a fixed status + body and records its calls. */
function stubFetch(status: number, body: string): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, headers: { ...init.headers } });
    return Promise.resolve({ status, text: () => Promise.resolve(body) });
  };
  return { fetch, calls };
}

function jsonFetch(status: number, body: unknown): { fetch: FetchLike; calls: Call[] } {
  return stubFetch(status, JSON.stringify(body));
}

function provider(fetch: FetchLike, config: Partial<FinaggConfig> = {}): FinAGGProvider {
  return new FinAGGProvider({ ...CONFIG, ...config }, { fetch });
}

/** GSTN SEARCHGSTIN passthrough payload, as the FinAGG docs describe the success case. */
function gstnPayload(sts: string): unknown {
  return {
    status_cd: '1',
    data: {
      gstin: GSTIN,
      lgnm: 'Universal Instruments Pvt Ltd',
      tradeNam: 'Universal Instruments',
      ctb: 'Private Limited Company',
      sts,
      pradr: {
        adr: '12, MIDC Road, Andheri East, Mumbai',
        addr: {
          bno: '12',
          st: 'MIDC Road',
          loc: 'Andheri East',
          city: 'Mumbai',
          dst: 'Mumbai Suburban',
          stcd: 'Maharashtra',
          pncd: '400093',
        },
      },
    },
  };
}

describe('FinAGG request shape', () => {
  it('calls the documented search endpoint with action=SEARCHGSTIN and the x-api-key header', async () => {
    const { fetch, calls } = jsonFetch(200, gstnPayload('Active'));
    await provider(fetch).verifyGSTIN(GSTIN);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(
      'https://gsp.finagg.in/basic/gstn/fin-v1/commonapi/v1.1/search' +
        `?action=SEARCHGSTIN&gstin=${GSTIN}`,
    );
    expect(call.headers['x-api-key']).toBe(CONFIG.apiKey);
    // The key must never travel in the URL.
    expect(call.url).not.toContain(CONFIG.apiKey);
  });

  it('accepts a base URL written with the documented /basic/gstn suffix without duplicating it', () => {
    const url = buildFinaggSearchUrl({ ...CONFIG, baseUrl: 'https://gsp.finagg.in' }, GSTIN);
    expect(url).toContain('/basic/gstn/fin-v1/commonapi/v1.1/search');
    expect(url.match(/basic\/gstn/g)).toHaveLength(1);
  });
});

describe('FinAGG response mapping', () => {
  // A. successful GSTIN response
  it('A: maps an active taxpayer to a verified result', async () => {
    const { fetch } = jsonFetch(200, gstnPayload('Active'));
    const result = await provider(fetch).verifyGSTIN(GSTIN);

    expect(result).toMatchObject({
      gstin: GSTIN,
      legalName: 'Universal Instruments Pvt Ltd',
      tradeName: 'Universal Instruments',
      registeredAddress: '12, MIDC Road, Andheri East, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '400093',
      status: 'ACTIVE',
      businessType: 'Private Limited Company',
      provider: 'finagg',
    });
    expect(result.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('A2: maps the FinAGG SuccessResponse summary shape too', async () => {
    const { fetch } = jsonFetch(200, {
      status_cd: '200',
      status_desc: 'Success',
      data: { gstin: GSTIN, legalName: 'Example Entity', state: 'Maharashtra', sts: 'Active' },
    });
    const result = await provider(fetch).verifyGSTIN(GSTIN);
    expect(result).toMatchObject({
      legalName: 'Example Entity',
      status: 'ACTIVE',
      stateCode: '27',
    });
  });

  // B. inactive GSTIN
  it.each([
    ['Inactive', 'INACTIVE'],
    ['Suspended', 'INACTIVE'],
    ['Provisional', 'INACTIVE'],
    ['Cancelled', 'CANCELLED'],
  ])('B: maps status "%s" to %s', async (label, expected) => {
    const { fetch } = jsonFetch(200, gstnPayload(label));
    const result = await provider(fetch).verifyGSTIN(GSTIN);
    expect(result.status).toBe(expected);
  });

  // C. GSTIN not found
  it('C: maps an empty data object to NOT_FOUND', async () => {
    const { fetch } = jsonFetch(200, { status_cd: '1', data: {} });
    const result = await provider(fetch).verifyGSTIN(GSTIN);
    expect(result.status).toBe('NOT_FOUND');
  });

  it('C2: maps an empty 200 body to NOT_FOUND', async () => {
    const { fetch } = stubFetch(200, '');
    const result = await provider(fetch).verifyGSTIN(GSTIN);
    expect(result.status).toBe('NOT_FOUND');
  });

  it('C3: maps a "no record found" error envelope to NOT_FOUND', async () => {
    const { fetch } = jsonFetch(200, {
      status_cd: '0',
      error: { error_cd: 'SWEB_9035', message: 'No records found for the given GSTIN' },
    });
    const result = await provider(fetch).verifyGSTIN(GSTIN);
    expect(result.status).toBe('NOT_FOUND');
  });

  // D. invalid response/request
  it('D: maps a 400 naming the GSTIN as invalid to ProviderInvalidGstinError', async () => {
    const { fetch } = jsonFetch(400, {
      status_cd: '0',
      error: { error_cd: 'SWEB_9035', message: 'Invalid GSTIN / UID' },
    });
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderInvalidGstinError,
    );
  });

  it('D2: maps a 400 "Malformed Request" (our fault, not the GSTIN) to unavailable', async () => {
    const { fetch } = jsonFetch(400, {
      status_cd: '0',
      error: { error_cd: 'GEN5007', message: 'Malformed Request' },
    });
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('D3: maps an unparseable 400 body to unavailable rather than blaming the GSTIN', async () => {
    const { fetch } = stubFetch(400, '<html>Bad Request</html>');
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('D4: maps a 200 error envelope naming the GSTIN as invalid to ProviderInvalidGstinError', async () => {
    const { fetch } = jsonFetch(200, {
      status_cd: '0',
      error: { error_cd: 'SWEB_9035', message: 'Invalid GSTIN' },
    });
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderInvalidGstinError,
    );
  });
});

describe('FinAGG transport failures', () => {
  // E/F/G/H: auth, access, rate limit, server errors
  it.each([401, 403, 404, 429, 500, 502, 503])(
    'E–H: maps HTTP %i to ProviderUnavailableError',
    async (status) => {
      const { fetch } = jsonFetch(status, {
        status_cd: '0',
        error: { error_cd: 'GEN5007', message: 'Malformed Request' },
      });
      await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
        ProviderUnavailableError,
      );
    },
  );

  // I. network timeout
  it('I: maps a timeout to ProviderTimeoutError', async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });

    await expect(provider(fetch, { timeoutMs: 10 }).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderTimeoutError,
    );
  });

  it('I2: maps a network failure to ProviderUnavailableError', async () => {
    const fetch: FetchLike = () => Promise.reject(new Error('ECONNREFUSED'));
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  // J. malformed / partial provider response
  it('J: maps an unparseable 200 body to unavailable', async () => {
    const { fetch } = stubFetch(200, 'not json at all');
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('J2: maps a partial response (taxpayer present, status missing) to unavailable', async () => {
    const { fetch } = jsonFetch(200, { status_cd: '1', data: { gstin: GSTIN, lgnm: 'Acme Ltd' } });
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('J3: maps an unrecognised status label to unavailable rather than guessing', async () => {
    const { fetch } = jsonFetch(200, gstnPayload('Wibble'));
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('J4: maps a JSON array body to unavailable', async () => {
    const { fetch } = jsonFetch(200, [1, 2, 3]);
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });
});

describe('FinAGG retry policy', () => {
  it('retries a 503 exactly once when enabled', async () => {
    const { fetch, calls } = jsonFetch(503, { status_cd: '0' });
    await expect(provider(fetch, { retryOnce: true }).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
    expect(calls).toHaveLength(2);
  });

  it('does not retry a 429', async () => {
    const { fetch, calls } = jsonFetch(429, { status_cd: '0' });
    await expect(provider(fetch, { retryOnce: true }).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
    expect(calls).toHaveLength(1);
  });

  it('does not retry a 500', async () => {
    const { fetch, calls } = jsonFetch(500, { status_cd: '0' });
    await expect(provider(fetch, { retryOnce: true }).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
    expect(calls).toHaveLength(1);
  });

  it('makes a single attempt when retry is disabled', async () => {
    const { fetch, calls } = jsonFetch(503, { status_cd: '0' });
    await expect(provider(fetch).verifyGSTIN(GSTIN)).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
    expect(calls).toHaveLength(1);
  });
});

describe('FinAGG logging hygiene', () => {
  it('never logs the API key, the headers, or the full GSTIN', async () => {
    const info = vi.fn();
    const logger = { debug: vi.fn(), info, warn: vi.fn(), error: vi.fn() };
    const { fetch } = jsonFetch(200, gstnPayload('Active'));

    await new FinAGGProvider(CONFIG, { fetch, logger }).verifyGSTIN(GSTIN);

    expect(info).toHaveBeenCalled();
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain(CONFIG.apiKey);
    expect(logged).not.toContain('x-api-key');
    expect(logged).not.toContain(GSTIN);
    expect(logged).toContain(maskGstin(GSTIN));
    // Taxpayer detail must not be logged either.
    expect(logged).not.toContain('Universal Instruments');
  });

  it('masks a GSTIN down to its state code and tail', () => {
    expect(maskGstin(GSTIN)).toBe('27*********F1ZV');
  });
});

describe('FinAGG through the verification service', () => {
  const service = (fetch: FetchLike) => createVerificationService(provider(fetch));

  it('surfaces a verified outcome', async () => {
    const { fetch } = jsonFetch(200, gstnPayload('Active'));
    expect((await service(fetch).verify(GSTIN)).kind).toBe('verified');
  });

  it('surfaces an inactive outcome', async () => {
    const { fetch } = jsonFetch(200, gstnPayload('Cancelled'));
    expect((await service(fetch).verify(GSTIN)).kind).toBe('inactive');
  });

  it('surfaces a not_found outcome', async () => {
    const { fetch } = jsonFetch(200, { status_cd: '1', data: {} });
    expect((await service(fetch).verify(GSTIN)).kind).toBe('not_found');
  });

  it('surfaces an invalid outcome when FinAGG rejects the GSTIN', async () => {
    const { fetch } = jsonFetch(400, {
      status_cd: '0',
      error: { error_cd: 'SWEB_9035', message: 'Invalid GSTIN / UID' },
    });
    expect(await service(fetch).verify(GSTIN)).toMatchObject({
      kind: 'invalid',
      reason: 'provider_rejected',
    });
  });

  it.each([401, 403, 429, 500, 503])(
    'surfaces an unavailable outcome for HTTP %i without leaking provider detail',
    async (status) => {
      const { fetch } = jsonFetch(status, {
        status_cd: '0',
        error: { error_cd: 'GEN5007', message: 'Malformed Request' },
      });
      const outcome = await service(fetch).verify(GSTIN);
      expect(outcome.kind).toBe('unavailable');
      if (outcome.kind === 'unavailable') {
        expect(outcome.message).not.toContain('GEN5007');
        expect(outcome.message).not.toContain('Malformed Request');
      }
    },
  );
});
